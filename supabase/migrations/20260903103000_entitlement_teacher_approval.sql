-- Outside-hours replacement lessons use the existing proposal lifecycle. The
-- entitlement remains waiting until acceptance applies the proposal atomically.

alter table public.lesson_schedule_proposals
  add column service_entitlement_id uuid,
  add foreign key(school_id,service_entitlement_id) references public.lesson_service_entitlements(school_id,id) on delete restrict;
create index lesson_schedule_proposals_entitlement_idx on public.lesson_schedule_proposals(service_entitlement_id)
  where service_entitlement_id is not null;

create function public.create_outside_availability_entitlement_proposal(
  p_school_id uuid,p_entitlement_id uuid,p_teacher_id uuid,p_place_id uuid,
  p_local_start timestamp without time zone,p_notes text,p_reason text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare entitlement public.lesson_service_entitlements%rowtype; source_event public.lesson_events%rowtype; proposal_id uuid;
begin
  if auth.uid() is null or not public.has_school_role(p_school_id,array['owner','admin']) then raise exception 'not_authorized'; end if;
  select * into entitlement from public.lesson_service_entitlements where school_id=p_school_id and id=p_entitlement_id for update;
  if not found then raise exception 'entitlement_not_found'; end if;
  if entitlement.status<>'waiting_to_schedule' then raise exception 'entitlement_already_used'; end if;
  if entitlement.expires_at is not null and entitlement.expires_at<now() then raise exception 'entitlement_expired'; end if;
  if entitlement.assigned_teacher_id is not null and entitlement.assigned_teacher_id<>p_teacher_id then raise exception 'entitlement_teacher_required'; end if;
  if exists(select 1 from public.lesson_schedule_proposals where service_entitlement_id=entitlement.id and status in('pending_teacher','pending_owner')) then raise exception 'entitlement_proposal_pending'; end if;
  select * into source_event from public.lesson_events where school_id=p_school_id and id=entitlement.source_lesson_event_id;
  if not found then raise exception 'source_lesson_not_found'; end if;
  proposal_id:=public.create_outside_availability_lesson_proposal(p_school_id,source_event.product_id,p_teacher_id,
    entitlement.student_id,p_place_id,p_local_start,'one_time',p_local_start::date,p_notes,p_reason);
  update public.lesson_schedule_proposals set service_entitlement_id=entitlement.id where id=proposal_id;
  return proposal_id;
end $$;
revoke all on function public.create_outside_availability_entitlement_proposal(uuid,uuid,uuid,uuid,timestamp without time zone,text,text) from public,anon;
grant execute on function public.create_outside_availability_entitlement_proposal(uuid,uuid,uuid,uuid,timestamp without time zone,text,text) to authenticated;

create function public.carry_entitlement_to_replacement_proposal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.replaces_proposal_id is not null and new.service_entitlement_id is null then
    select old.service_entitlement_id into new.service_entitlement_id from public.lesson_schedule_proposals old
    where old.school_id=new.school_id and old.id=new.replaces_proposal_id;
  end if;
  return new;
end $$;
create trigger lesson_proposal_carry_entitlement before insert on public.lesson_schedule_proposals
for each row execute function public.carry_entitlement_to_replacement_proposal();
revoke all on function public.carry_entitlement_to_replacement_proposal() from public,anon,authenticated;

create function public.consume_entitlement_on_proposal_apply()
returns trigger language plpgsql security definer set search_path='' as $$
declare entitlement public.lesson_service_entitlements%rowtype; event_row public.lesson_events%rowtype;
  source_event public.lesson_events%rowtype; request_row public.lesson_change_requests%rowtype; school_timezone text;
begin
  if new.status<>'applied' or old.status='applied' or new.service_entitlement_id is null then return new; end if;
  if new.schedule_type<>'one_time' or new.applied_entity_type<>'lesson_event' or new.applied_entity_id is null then raise exception 'invalid_entitlement_application'; end if;
  select * into entitlement from public.lesson_service_entitlements where school_id=new.school_id and id=new.service_entitlement_id for update;
  if not found then raise exception 'entitlement_not_found'; end if;
  if entitlement.status<>'waiting_to_schedule' then raise exception 'entitlement_already_used'; end if;
  if entitlement.expires_at is not null and entitlement.expires_at<now() then raise exception 'entitlement_expired'; end if;
  select * into event_row from public.lesson_events where school_id=new.school_id and id=new.applied_entity_id for update;
  select * into source_event from public.lesson_events where school_id=new.school_id and id=entitlement.source_lesson_event_id;
  if not found or event_row.student_id<>entitlement.student_id or event_row.product_id<>source_event.product_id
    or event_row.teacher_id<>new.teacher_id or (entitlement.assigned_teacher_id is not null and event_row.teacher_id<>entitlement.assigned_teacher_id)
    or extract(epoch from(event_row.ends_at-event_row.starts_at))::integer/60<>entitlement.duration_minutes then
    raise exception 'entitlement_application_mismatch';
  end if;
  update public.lesson_events set service_entitlement_id=entitlement.id where id=event_row.id;
  update public.lesson_service_entitlements set status='scheduled',scheduled_lesson_event_id=event_row.id,scheduled_at=now()
    where id=entitlement.id and status='waiting_to_schedule';
  if not found then raise exception 'entitlement_transition_failed'; end if;
  select * into request_row from public.lesson_change_requests where school_id=new.school_id and id=entitlement.source_request_id;
  select timezone into school_timezone from public.schools where id=new.school_id;
  if request_row.requester_email is not null then
    insert into public.lesson_request_email_outbox(school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key)
    values(new.school_id,request_row.id,'requester',request_row.requester_email,'Your replacement lesson is scheduled',
      'Your replacement lesson has been scheduled for '||to_char(event_row.starts_at at time zone school_timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')||'.',
      'entitlement-scheduled/'||entitlement.id||'/requester') on conflict(idempotency_key) do nothing;
  end if;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(new.school_id,new.decided_by,'lesson.entitlement_scheduled','lesson_service_entitlement',entitlement.id,
    jsonb_build_object('lesson_event_id',event_row.id,'proposal_id',new.id,'source_lesson_event_id',source_event.id));
  return new;
end $$;
create trigger lesson_proposal_consume_entitlement before update of status on public.lesson_schedule_proposals
for each row execute function public.consume_entitlement_on_proposal_apply();
revoke all on function public.consume_entitlement_on_proposal_apply() from public,anon,authenticated;

