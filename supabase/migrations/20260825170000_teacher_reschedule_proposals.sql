alter table public.lesson_schedule_proposals
  add column lesson_event_id uuid,
  add column proposal_kind text not null default 'new_lesson' check (proposal_kind in ('new_lesson','reschedule')),
  add foreign key (school_id, lesson_event_id) references public.lesson_events(school_id, id) on delete restrict;

alter table public.lesson_schedule_proposals drop constraint lesson_schedule_proposals_status_check;
alter table public.lesson_schedule_proposals add constraint lesson_schedule_proposals_status_check
  check (status in ('pending_teacher','pending_owner','accepted','declined','withdrawn','expired','applied','failed'));

create unique index lesson_schedule_proposals_one_pending_reschedule
  on public.lesson_schedule_proposals(school_id, lesson_event_id)
  where proposal_kind='reschedule' and status in ('pending_owner','pending_teacher');

create or replace function public.propose_or_reschedule_assigned_lesson_as_teacher(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_local_start timestamp,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid(); event_row public.lesson_events%rowtype; school_tz text;
  authority text; starts timestamptz; finishes timestamptz; duration interval;
  previous_values jsonb; new_values jsonb; proposal_id uuid; owner_row record;
  student_name text;
begin
  if actor is null or nullif(trim(p_reason),'') is null or length(trim(p_reason))>500 then raise exception 'invalid_request'; end if;
  select e.* into event_row from public.lesson_events e where e.school_id=p_school_id and e.id=p_lesson_event_id for update;
  if not found then raise exception 'lesson_not_found'; end if;
  if event_row.status<>'scheduled' or event_row.starts_at<=now() then raise exception 'lesson_is_not_reschedulable'; end if;
  if not event_row.reschedule_allowed then raise exception 'lesson_reschedule_blocked'; end if;
  select t.scheduling_authority into authority
  from public.teachers t join public.people p on p.school_id=t.school_id and p.id=t.person_id
  join public.school_members m on m.school_id=p.school_id and m.profile_id=p.profile_id and m.status='active'
  where t.school_id=p_school_id and t.person_id=event_row.teacher_id and p.profile_id=actor and p.status='active' and m.role in ('teacher','owner','admin');
  if authority is null then raise exception 'not_authorized'; end if;
  select timezone into school_tz from public.schools where id=p_school_id;
  starts:=p_local_start at time zone school_tz;
  duration:=event_row.ends_at-event_row.starts_at;
  finishes:=starts+duration;
  if starts<=now() then raise exception 'new_lesson_time_must_be_future'; end if;
  if starts=event_row.starts_at then raise exception 'lesson_time_is_unchanged'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text,0));
  if exists(select 1 from public.lesson_events e where e.school_id=p_school_id and e.id<>event_row.id and e.status not in('cancelled','rescheduled') and (e.teacher_id=event_row.teacher_id or e.student_id=event_row.student_id) and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(starts,finishes,'[)')) then raise exception 'lesson_conflict'; end if;

  if authority='manage_assigned_lessons' then
    previous_values:=jsonb_build_object('teacher_id',event_row.teacher_id,'place_id',event_row.place_id,'starts_at',event_row.starts_at,'ends_at',event_row.ends_at);
    new_values:=jsonb_build_object('teacher_id',event_row.teacher_id,'place_id',event_row.place_id,'starts_at',starts,'ends_at',finishes);
    update public.lesson_events set starts_at=starts,ends_at=finishes,is_series_exception=true,exception_reason='Teacher rescheduled: '||trim(p_reason) where id=event_row.id;
    insert into public.lesson_event_changes(school_id,lesson_event_id,change_type,previous_values,new_values,actor_profile_id,actor_role,source,reason,policy_result)
      values(p_school_id,event_row.id,'rescheduled',previous_values,new_values,actor,'teacher','calendar',trim(p_reason),'teacher_authorized_reschedule');
    insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
      values(p_school_id,actor,'lesson.rescheduled','lesson_event',event_row.id,jsonb_build_object('source','teacher_calendar','scheduling_authority',authority));
    insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
      values(p_school_id,'lesson.rescheduled','lesson_event',event_row.id,actor,'teacher','teacher_schedule',jsonb_build_object('previous_starts_at',event_row.starts_at,'starts_at',starts));
    for owner_row in select profile_id from public.school_members where school_id=p_school_id and status='active' and role in('owner','admin') and profile_id<>actor loop
      insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
        values(p_school_id,owner_row.profile_id,'lesson_created','Teacher rescheduled a lesson','The assigned teacher moved a lesson. The calendar and lesson history have been updated.','/schools/'||p_school_id,'teacher-rescheduled:'||event_row.id||':'||extract(epoch from starts)::bigint,'lesson_event',event_row.id,jsonb_build_object('starts_at',starts));
    end loop;
    return jsonb_build_object('outcome','applied','lesson_event_id',event_row.id);
  end if;

  if exists(select 1 from public.lesson_schedule_proposals where school_id=p_school_id and lesson_event_id=event_row.id and status in('pending_owner','pending_teacher')) then raise exception 'proposal_already_pending'; end if;
  insert into public.lesson_schedule_proposals(school_id,teacher_id,student_id,product_id,place_id,schedule_type,proposed_local_start,proposed_starts_at,proposed_ends_at,notes,reason,status,created_by,lesson_event_id,proposal_kind)
    values(p_school_id,event_row.teacher_id,event_row.student_id,event_row.product_id,event_row.place_id,'one_time',p_local_start,starts,finishes,event_row.notes,trim(p_reason),'pending_owner',actor,event_row.id,'reschedule') returning id into proposal_id;
  select coalesce(nullif(trim(p.preferred_name),''),p.first_name)||' '||p.last_name into student_name from public.people p where p.school_id=p_school_id and p.id=event_row.student_id;
  for owner_row in select profile_id from public.school_members where school_id=p_school_id and status='active' and role in('owner','admin') loop
    insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
      values(p_school_id,owner_row.profile_id,'lesson_created','Teacher proposed a new lesson time',coalesce(student_name,'A student')||' remains at the original time until you approve or decline the teacher’s proposal.','/schools/'||p_school_id,'teacher-reschedule-proposal:'||proposal_id,'lesson_schedule_proposal',proposal_id,jsonb_build_object('lesson_event_id',event_row.id,'proposed_starts_at',starts,'status','pending_owner'));
  end loop;
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
    values(p_school_id,'lesson_reschedule_proposal.created','lesson_schedule_proposal',proposal_id,actor,'teacher','teacher_schedule',jsonb_build_object('lesson_event_id',event_row.id,'original_starts_at',event_row.starts_at,'proposed_starts_at',starts));
  return jsonb_build_object('outcome','pending_owner','proposal_id',proposal_id);
end $$;

revoke all on function public.propose_or_reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp,text) from public,anon;
grant execute on function public.propose_or_reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp,text) to authenticated;
