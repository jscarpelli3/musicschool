alter table public.teachers
  add column can_self_reschedule boolean not null default false;

create or replace function public.reject_partial_lesson_outcome()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.outcome='partial' and old.outcome is distinct from new.outcome then
    raise exception 'partial_lesson_outcome_not_supported';
  end if;
  return new;
end;
$$;

create trigger lesson_events_reject_partial_outcome
before update of outcome on public.lesson_events
for each row execute function public.reject_partial_lesson_outcome();

alter table public.owner_notifications drop constraint owner_notifications_kind_check;
alter table public.owner_notifications add constraint owner_notifications_kind_check
  check (kind in (
    'payer_approved',
    'payer_rejected',
    'payment_failed',
    'lesson_change_requested',
    'teacher_rescheduled',
    'teacher_reschedule_requested'
  ));

create or replace function public.set_teacher_self_reschedule_permission(
  p_school_id uuid,
  p_teacher_id uuid,
  p_allowed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner']) then
    raise exception 'not_authorized';
  end if;

  update public.teachers
  set can_self_reschedule = p_allowed
  where school_id = p_school_id and person_id = p_teacher_id;
  if not found then raise exception 'teacher_not_found'; end if;

  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'teacher.self_reschedule_permission_changed','teacher',p_teacher_id,jsonb_build_object('allowed',p_allowed));
end;
$$;

create or replace function public.reschedule_assigned_lesson_as_teacher(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_local_start timestamp without time zone,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  teacher_id uuid;
  teacher_name text;
  student_name text;
  event_row public.lesson_events%rowtype;
  school_timezone text;
  local_day date := p_local_start::date;
  local_start_time time := p_local_start::time;
  local_weekday integer := extract(dow from p_local_start)::integer;
  duration interval;
  local_end timestamp without time zone;
  starts_at_utc timestamptz;
  ends_at_utc timestamptz;
  previous_values jsonb;
  new_values jsonb;
  recipient record;
begin
  if actor_id is null or nullif(trim(p_reason),'') is null or length(trim(p_reason)) > 500 then
    raise exception 'invalid_teacher_reschedule';
  end if;

  select person.id, coalesce(person.preferred_name,person.first_name)||' '||person.last_name
  into teacher_id, teacher_name
  from public.people person
  join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id
  join public.school_members member on member.school_id=person.school_id and member.profile_id=person.profile_id
  where person.school_id=p_school_id and person.profile_id=actor_id and person.status='active'
    and member.status='active' and member.role='teacher' and teacher.can_self_reschedule;
  if teacher_id is null then raise exception 'teacher_reschedule_not_allowed'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_lesson_event_id::text,0));
  select * into event_row from public.lesson_events
  where school_id=p_school_id and id=p_lesson_event_id for update;
  if not found then raise exception 'lesson_not_found'; end if;
  if event_row.teacher_id<>teacher_id then raise exception 'not_assigned_teacher'; end if;
  if event_row.status<>'scheduled' or event_row.starts_at<=now() or not event_row.reschedule_allowed then
    raise exception 'lesson_is_not_reschedulable';
  end if;

  select timezone into school_timezone from public.schools where id=p_school_id;
  duration:=event_row.ends_at-event_row.starts_at;
  local_end:=p_local_start+duration;
  starts_at_utc:=p_local_start at time zone school_timezone;
  ends_at_utc:=local_end at time zone school_timezone;
  if starts_at_utc<=now() then raise exception 'new_lesson_time_must_be_future'; end if;

  if not exists(
    select 1 from public.teacher_availability_rules rule
    where rule.school_id=p_school_id and rule.teacher_id=teacher_id and rule.weekday=local_weekday
      and rule.effective_from<=local_day and (rule.effective_until is null or rule.effective_until>=local_day)
      and rule.start_time<=local_start_time and rule.end_time>=local_end::time
  ) then raise exception 'outside_teacher_availability'; end if;
  if exists(
    select 1 from public.lesson_events conflict
    where conflict.school_id=p_school_id and conflict.id<>event_row.id and conflict.teacher_id=teacher_id
      and conflict.status not in ('cancelled','rescheduled')
      and tstzrange(conflict.starts_at,conflict.ends_at,'[)')&&tstzrange(starts_at_utc,ends_at_utc,'[)')
  ) then raise exception 'teacher_conflict'; end if;
  if exists(
    select 1 from public.lesson_events conflict
    where conflict.school_id=p_school_id and conflict.id<>event_row.id and conflict.student_id=event_row.student_id
      and conflict.status not in ('cancelled','rescheduled')
      and tstzrange(conflict.starts_at,conflict.ends_at,'[)')&&tstzrange(starts_at_utc,ends_at_utc,'[)')
  ) then raise exception 'student_conflict'; end if;

  previous_values:=jsonb_build_object('teacher_id',event_row.teacher_id,'place_id',event_row.place_id,'starts_at',event_row.starts_at,'ends_at',event_row.ends_at);
  new_values:=jsonb_build_object('teacher_id',event_row.teacher_id,'place_id',event_row.place_id,'starts_at',starts_at_utc,'ends_at',ends_at_utc);
  if previous_values=new_values then raise exception 'lesson_time_is_unchanged'; end if;

  update public.lesson_events set starts_at=starts_at_utc,ends_at=ends_at_utc,is_series_exception=true,
    exception_reason='Teacher rescheduled: '||trim(p_reason)
  where school_id=p_school_id and id=event_row.id;

  insert into public.lesson_event_changes(school_id,lesson_event_id,change_type,previous_values,new_values,actor_profile_id,actor_role,source,reason,policy_result,counted_toward_self_service_limit)
  values(p_school_id,event_row.id,'rescheduled',previous_values,new_values,actor_id,'teacher','lesson_detail',trim(p_reason),'teacher_self_rescheduled',false);
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'lesson.teacher_rescheduled','lesson_event',event_row.id,jsonb_build_object('previous_starts_at',event_row.starts_at,'starts_at',starts_at_utc));

  select coalesce(person.preferred_name,person.first_name)||' '||person.last_name into student_name
  from public.people person where person.school_id=p_school_id and person.id=event_row.student_id;
  for recipient in select profile_id from public.school_members where school_id=p_school_id and status='active' and role in ('owner','admin')
  loop
    insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
    values(p_school_id,recipient.profile_id,'teacher_rescheduled',teacher_name||' rescheduled a lesson',student_name||'''s lesson was moved to '||to_char(starts_at_utc at time zone school_timezone,'FMMonth FMDD at FMHH12:MI AM')||'.','/schools/'||p_school_id,'teacher-rescheduled:'||event_row.id||':'||extract(epoch from starts_at_utc)::bigint,'lesson_event',event_row.id,jsonb_build_object('previous_starts_at',event_row.starts_at,'starts_at',starts_at_utc,'teacher_id',teacher_id))
    on conflict(recipient_profile_id,dedupe_key) do nothing;
  end loop;
  return jsonb_build_object('lesson_event_id',event_row.id,'starts_at',starts_at_utc,'ends_at',ends_at_utc);
end;
$$;

create or replace function public.report_student_reschedule_request_to_owner(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare actor_id uuid:=auth.uid(); teacher_id uuid; teacher_name text; student_name text; event_row public.lesson_events%rowtype; recipient record; clean_note text:=nullif(trim(p_note),'');
begin
  if length(coalesce(clean_note,''))>1000 then raise exception 'note_too_long'; end if;
  select person.id,coalesce(person.preferred_name,person.first_name)||' '||person.last_name into teacher_id,teacher_name
  from public.people person join public.school_members member on member.school_id=person.school_id and member.profile_id=person.profile_id
  where person.school_id=p_school_id and person.profile_id=actor_id and person.status='active' and member.status='active' and member.role='teacher';
  if teacher_id is null then raise exception 'not_authorized'; end if;
  select * into event_row from public.lesson_events where school_id=p_school_id and id=p_lesson_event_id;
  if not found or event_row.teacher_id<>teacher_id or event_row.status<>'scheduled' then raise exception 'lesson_not_available'; end if;
  select coalesce(preferred_name,first_name)||' '||last_name into student_name from public.people where school_id=p_school_id and id=event_row.student_id;
  for recipient in select profile_id from public.school_members where school_id=p_school_id and status='active' and role in ('owner','admin') loop
    insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
    values(p_school_id,recipient.profile_id,'teacher_reschedule_requested',student_name||' requested a reschedule',teacher_name||' recorded the family request.'||case when clean_note is null then '' else ' Note: '||clean_note end,'/schools/'||p_school_id,'teacher-reschedule-request:'||event_row.id,'lesson_event',event_row.id,jsonb_build_object('teacher_id',teacher_id,'note',clean_note))
    on conflict(recipient_profile_id,dedupe_key) do nothing;
  end loop;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'lesson.student_reschedule_requested','lesson_event',event_row.id,jsonb_build_object('note',clean_note));
end;
$$;

revoke all on function public.set_teacher_self_reschedule_permission(uuid,uuid,boolean) from public,anon;
revoke all on function public.reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp without time zone,text) from public,anon;
revoke all on function public.report_student_reschedule_request_to_owner(uuid,uuid,text) from public,anon;
grant execute on function public.set_teacher_self_reschedule_permission(uuid,uuid,boolean) to authenticated;
grant execute on function public.reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp without time zone,text) to authenticated;
grant execute on function public.report_student_reschedule_request_to_owner(uuid,uuid,text) to authenticated;
revoke all on function public.reject_partial_lesson_outcome() from public,anon,authenticated;
