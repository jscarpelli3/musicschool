-- A replacement lesson is funded by exactly one service entitlement. Scheduling
-- and consuming it is one transaction so it cannot be billed or used twice.

alter table public.lesson_events
  add column service_entitlement_id uuid unique;
alter table public.lesson_service_entitlements
  add column scheduled_lesson_event_id uuid unique,
  add column scheduled_at timestamptz,
  add foreign key(school_id,scheduled_lesson_event_id) references public.lesson_events(school_id,id) on delete restrict;
alter table public.lesson_events
  add foreign key(school_id,service_entitlement_id) references public.lesson_service_entitlements(school_id,id) on delete restrict;

create index lesson_service_entitlements_waiting_idx
  on public.lesson_service_entitlements(school_id,created_at)
  where status='waiting_to_schedule';

create or replace function public.compute_lesson_event_billing_disposition(
  p_school_id uuid,p_lesson_event_id uuid,p_as_of timestamptz default now()
) returns jsonb language plpgsql stable set search_path='' as $$
declare override_row public.lesson_accounting_overrides%rowtype; entitlement_id uuid;
begin
  select event.service_entitlement_id into entitlement_id from public.lesson_events event
  where event.school_id=p_school_id and event.id=p_lesson_event_id;
  if entitlement_id is not null then
    return jsonb_build_object('lesson_event_id',p_lesson_event_id,'state','resolved','disposition','waive',
      'reason_code','funded_service_entitlement','service_entitlement_id',entitlement_id,
      'policy_version_id',null,'policy_disposition',null,'request_decision_id',null,'decision_revision_id',null);
  end if;
  select * into override_row from public.lesson_accounting_overrides
  where school_id=p_school_id and lesson_event_id=p_lesson_event_id;
  if found then
    return jsonb_build_object('lesson_event_id',p_lesson_event_id,'state','resolved',
      'disposition',override_row.disposition,'reason_code',override_row.reason_code,
      'policy_version_id',null,'policy_disposition',null,
      'request_decision_id',override_row.request_decision_id,'decision_revision_id',override_row.decision_revision_id);
  end if;
  return public.compute_policy_lesson_event_billing_disposition(p_school_id,p_lesson_event_id,p_as_of);
end $$;
revoke all on function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz) to service_role;

create function public.schedule_service_entitlement(
  p_school_id uuid,p_entitlement_id uuid,p_teacher_id uuid,p_place_id uuid,
  p_local_start timestamp without time zone,p_notes text default null,
  p_allow_outside_availability boolean default false,p_override_reason text default null
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); entitlement public.lesson_service_entitlements%rowtype;
  source_event public.lesson_events%rowtype; product_duration integer; event_id uuid; request_row public.lesson_change_requests%rowtype;
  school_timezone text; scheduled_start timestamptz;
begin
  if actor is null or not public.has_school_role(p_school_id,array['owner','admin']) then raise exception 'not_authorized'; end if;
  select * into entitlement from public.lesson_service_entitlements
  where school_id=p_school_id and id=p_entitlement_id for update;
  if not found then raise exception 'entitlement_not_found'; end if;
  if entitlement.status<>'waiting_to_schedule' then raise exception 'entitlement_already_used'; end if;
  if entitlement.expires_at is not null and entitlement.expires_at<now() then raise exception 'entitlement_expired'; end if;
  if entitlement.assigned_teacher_id is not null and entitlement.assigned_teacher_id<>p_teacher_id then raise exception 'entitlement_teacher_required'; end if;
  select * into source_event from public.lesson_events
  where school_id=p_school_id and id=entitlement.source_lesson_event_id;
  if not found then raise exception 'source_lesson_not_found'; end if;
  select duration_minutes into product_duration from public.service_products
  where school_id=p_school_id and id=source_event.product_id and status='active';
  if product_duration is null then raise exception 'invalid_school_or_offering'; end if;
  if product_duration<>entitlement.duration_minutes then raise exception 'entitlement_duration_mismatch'; end if;

  event_id:=public.create_single_lesson(p_school_id,source_event.product_id,p_teacher_id,entitlement.student_id,
    p_place_id,p_local_start,p_notes,p_allow_outside_availability,p_override_reason);
  update public.lesson_events set service_entitlement_id=entitlement.id where id=event_id and school_id=p_school_id;
  if not found then raise exception 'replacement_link_failed'; end if;
  update public.lesson_service_entitlements set status='scheduled',scheduled_lesson_event_id=event_id,scheduled_at=now()
  where id=entitlement.id and status='waiting_to_schedule';
  if not found then raise exception 'entitlement_transition_failed'; end if;
  select * into request_row from public.lesson_change_requests where id=entitlement.source_request_id and school_id=p_school_id;
  select timezone into school_timezone from public.schools where id=p_school_id;
  select starts_at into scheduled_start from public.lesson_events where id=event_id;
  if request_row.requester_email is not null then
    insert into public.lesson_request_email_outbox(school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key)
    values(p_school_id,request_row.id,'requester',request_row.requester_email,'Your replacement lesson is scheduled',
      'Your replacement lesson has been scheduled for '||to_char(scheduled_start at time zone school_timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')||'.',
      'entitlement-scheduled/'||entitlement.id||'/requester') on conflict(idempotency_key) do nothing;
  end if;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor,'lesson.entitlement_scheduled','lesson_service_entitlement',entitlement.id,
    jsonb_build_object('lesson_event_id',event_id,'source_lesson_event_id',source_event.id,'teacher_id',p_teacher_id));
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'lesson_service_entitlement.scheduled','lesson_service_entitlement',entitlement.id,actor,
    (select role from public.school_members where school_id=p_school_id and profile_id=actor and status='active' limit 1),
    'owner_app',jsonb_build_object('lesson_event_id',event_id,'source_lesson_event_id',source_event.id));
  return event_id;
end $$;
revoke all on function public.schedule_service_entitlement(uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) from public,anon;
grant execute on function public.schedule_service_entitlement(uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) to authenticated;

create or replace function public.route_lesson_request_notification()
returns trigger language plpgsql set search_path='' as $$
declare entitlement_id uuid;
begin
  if new.entity_type='lesson_change_request' and new.entity_id is not null then
    if coalesce((new.metadata->>'automatic')::boolean,false) then
      select entitlement.id into entitlement_id from public.lesson_service_entitlements entitlement
      where entitlement.school_id=new.school_id and entitlement.source_request_id=new.entity_id;
      new.href:='/schools/'||new.school_id||'/lessons/new?entitlement='||entitlement_id;
    else
      new.href:='/schools/'||new.school_id||'/approvals?request='||new.entity_id;
    end if;
  end if;
  return new;
end $$;

update public.owner_notifications notification set href='/schools/'||notification.school_id||'/lessons/new?entitlement='||entitlement.id
from public.lesson_service_entitlements entitlement
where notification.school_id=entitlement.school_id and notification.entity_type='lesson_change_request'
  and notification.entity_id=entitlement.source_request_id and coalesce((notification.metadata->>'automatic')::boolean,false);
