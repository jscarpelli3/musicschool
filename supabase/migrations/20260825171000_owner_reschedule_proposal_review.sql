alter table public.lesson_schedule_proposals
  add column original_starts_at timestamptz,
  add column original_ends_at timestamptz;

create or replace function public.capture_reschedule_proposal_original_time()
returns trigger language plpgsql set search_path='' as $$
declare event_row public.lesson_events%rowtype;
begin
  if new.proposal_kind='reschedule' then
    select * into event_row from public.lesson_events where school_id=new.school_id and id=new.lesson_event_id;
    if not found then raise exception 'lesson_not_found'; end if;
    new.original_starts_at:=event_row.starts_at;
    new.original_ends_at:=event_row.ends_at;
    new.status:='pending_owner';
  end if;
  return new;
end $$;

create trigger lesson_schedule_proposals_capture_original
before insert on public.lesson_schedule_proposals for each row execute function public.capture_reschedule_proposal_original_time();

update public.lesson_schedule_proposals p set original_starts_at=e.starts_at,original_ends_at=e.ends_at
from public.lesson_events e where p.school_id=e.school_id and p.lesson_event_id=e.id and p.proposal_kind='reschedule' and p.original_starts_at is null;

update public.owner_notifications n set href='/schools/'||n.school_id||'/notifications?proposal='||n.entity_id
where n.entity_type='lesson_schedule_proposal' and exists(
  select 1 from public.lesson_schedule_proposals p where p.id=n.entity_id and p.school_id=n.school_id and p.proposal_kind='reschedule'
);

create or replace function public.route_reschedule_proposal_notification()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.entity_type='lesson_schedule_proposal' and exists(select 1 from public.lesson_schedule_proposals p where p.school_id=new.school_id and p.id=new.entity_id and p.proposal_kind='reschedule' and p.status='pending_owner') then
    new.href:='/schools/'||new.school_id||'/notifications?proposal='||new.entity_id;
  end if;
  return new;
end $$;
create trigger owner_notifications_route_reschedule_proposal before insert on public.owner_notifications for each row execute function public.route_reschedule_proposal_notification();

create or replace function public.decide_teacher_reschedule_proposal(p_school_id uuid,p_proposal_id uuid,p_decision text,p_note text default null)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); proposal public.lesson_schedule_proposals%rowtype; event_row public.lesson_events%rowtype; teacher_profile uuid;
begin
  if actor is null or p_decision not in('accept','decline') or length(coalesce(trim(p_note),''))>500 then raise exception 'invalid_decision'; end if;
  if not public.has_school_role(p_school_id,array['owner','admin']) then raise exception 'not_authorized'; end if;
  select * into proposal from public.lesson_schedule_proposals where school_id=p_school_id and id=p_proposal_id and proposal_kind='reschedule' for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if proposal.status<>'pending_owner' then return proposal.status; end if;
  select profile_id into teacher_profile from public.people where school_id=p_school_id and id=proposal.teacher_id and status='active';
  if p_decision='decline' then
    update public.lesson_schedule_proposals set status='declined',decided_by=actor,decided_at=now(),decision_note=nullif(trim(p_note),''),updated_at=now() where id=proposal.id;
    insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
      values(p_school_id,'lesson_reschedule_proposal.declined','lesson_schedule_proposal',proposal.id,actor,'owner','owner_notifications',jsonb_build_object('lesson_event_id',proposal.lesson_event_id,'note',nullif(trim(p_note),'')));
    if teacher_profile is not null then insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
      values(p_school_id,teacher_profile,'lesson_created','Reschedule proposal declined','The lesson remains at its original time.','/schools/'||p_school_id||'/teacher','teacher-reschedule-declined:'||proposal.id,'lesson_schedule_proposal',proposal.id,jsonb_build_object('status','declined')) on conflict(recipient_profile_id,dedupe_key) do nothing; end if;
    return 'declined';
  end if;
  select * into event_row from public.lesson_events where school_id=p_school_id and id=proposal.lesson_event_id for update;
  if not found or event_row.status<>'scheduled' or event_row.starts_at<>proposal.original_starts_at or event_row.ends_at<>proposal.original_ends_at then raise exception 'proposal_stale'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text,0));
  if exists(select 1 from public.lesson_events e where e.school_id=p_school_id and e.id<>event_row.id and e.status not in('cancelled','rescheduled') and (e.teacher_id=event_row.teacher_id or e.student_id=event_row.student_id) and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(proposal.proposed_starts_at,proposal.proposed_ends_at,'[)')) then raise exception 'lesson_conflict'; end if;
  update public.lesson_events set starts_at=proposal.proposed_starts_at,ends_at=proposal.proposed_ends_at,is_series_exception=true,exception_reason='Owner approved teacher proposal: '||proposal.reason where id=event_row.id;
  insert into public.lesson_event_changes(school_id,lesson_event_id,change_type,previous_values,new_values,actor_profile_id,actor_role,source,reason,policy_result)
    values(p_school_id,event_row.id,'rescheduled',jsonb_build_object('teacher_id',event_row.teacher_id,'place_id',event_row.place_id,'starts_at',event_row.starts_at,'ends_at',event_row.ends_at),jsonb_build_object('teacher_id',event_row.teacher_id,'place_id',event_row.place_id,'starts_at',proposal.proposed_starts_at,'ends_at',proposal.proposed_ends_at),actor,'owner','lesson_detail',proposal.reason,'owner_approved_teacher_proposal');
  update public.lesson_schedule_proposals set status='applied',decided_by=actor,decided_at=now(),decision_note=nullif(trim(p_note),''),applied_entity_type='lesson_event',applied_entity_id=event_row.id,updated_at=now() where id=proposal.id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor,'lesson.reschedule_proposal_approved','lesson_event',event_row.id,jsonb_build_object('proposal_id',proposal.id));
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
    values(p_school_id,'lesson_reschedule_proposal.applied','lesson_schedule_proposal',proposal.id,actor,'owner','owner_notifications',jsonb_build_object('lesson_event_id',event_row.id,'starts_at',proposal.proposed_starts_at));
  if teacher_profile is not null then insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
    values(p_school_id,teacher_profile,'lesson_created','Reschedule proposal approved','The lesson has moved to your proposed time.','/schools/'||p_school_id||'/teacher','teacher-reschedule-approved:'||proposal.id,'lesson_schedule_proposal',proposal.id,jsonb_build_object('status','applied','starts_at',proposal.proposed_starts_at)) on conflict(recipient_profile_id,dedupe_key) do nothing; end if;
  return 'applied';
end $$;

revoke all on function public.decide_teacher_reschedule_proposal(uuid,uuid,text,text) from public,anon;
grant execute on function public.decide_teacher_reschedule_proposal(uuid,uuid,text,text) to authenticated;
