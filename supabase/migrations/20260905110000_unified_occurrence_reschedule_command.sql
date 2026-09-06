-- Moving an existing occurrence is one domain operation regardless of which
-- authorized interaction initiated it. Public wrappers prove authority and
-- state their origin; this private core owns calendar and history truth.

create function public.reschedule_lesson_occurrence_core(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_teacher_id uuid,
  p_place_id uuid,
  p_local_start timestamp without time zone,
  p_reason text,
  p_actor_profile_id uuid,
  p_actor_role text,
  p_origin_kind text,
  p_interaction_channel text,
  p_enforce_teacher_availability boolean,
  p_allow_outside_availability boolean,
  p_policy_result text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  event_row public.lesson_events%rowtype;
  school_timezone text;
  local_day date:=p_local_start::date;
  local_start_time time:=p_local_start::time;
  local_weekday integer:=extract(dow from p_local_start)::integer;
  duration interval;
  local_end timestamp without time zone;
  starts_at_utc timestamptz;
  ends_at_utc timestamptz;
  effective_policy_version_id uuid;
  previous_values jsonb;
  new_values jsonb;
  clean_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if p_school_id is null or p_lesson_event_id is null or p_teacher_id is null or p_place_id is null
    or p_actor_profile_id is null or clean_reason is null or length(clean_reason)>500
    or nullif(trim(coalesce(p_actor_role,'')),'') is null
    or p_origin_kind not in ('teacher','owner','system')
    or p_interaction_channel not in ('calendar','lesson_detail','teacher_schedule','system')
    or nullif(trim(coalesce(p_policy_result,'')),'') is null
    or (p_allow_outside_availability and not p_enforce_teacher_availability)
  then raise exception 'invalid_reschedule_command'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_lesson_event_id::text,0));
  select * into event_row from public.lesson_events event
  where event.school_id=p_school_id and event.id=p_lesson_event_id for update;
  if not found then raise exception 'lesson_not_found'; end if;
  if event_row.status<>'scheduled' then raise exception 'lesson_is_not_reschedulable'; end if;
  if event_row.starts_at<=now() then raise exception 'past_lesson_is_not_reschedulable'; end if;
  if not event_row.reschedule_allowed then raise exception 'lesson_reschedule_blocked'; end if;
  if p_origin_kind='teacher' and p_teacher_id<>event_row.teacher_id then
    raise exception 'assigned_teacher_changed';
  end if;

  select school.timezone into school_timezone from public.schools school where school.id=p_school_id;
  if school_timezone is null then raise exception 'school_not_found'; end if;
  if not exists(select 1 from public.teachers teacher
    join public.people person on person.school_id=teacher.school_id and person.id=teacher.person_id
    where teacher.school_id=p_school_id and teacher.person_id=p_teacher_id and person.status='active')
  then raise exception 'invalid_teacher'; end if;
  if not exists(select 1 from public.lesson_places place
    where place.school_id=p_school_id and place.id=p_place_id and place.status='active')
  then raise exception 'invalid_place'; end if;

  duration:=event_row.ends_at-event_row.starts_at;
  local_end:=p_local_start+duration;
  starts_at_utc:=p_local_start at time zone school_timezone;
  ends_at_utc:=local_end at time zone school_timezone;
  if starts_at_utc<=now() then raise exception 'new_lesson_time_must_be_future'; end if;

  if p_enforce_teacher_availability and not p_allow_outside_availability and not exists(
    select 1 from public.teacher_availability_rules rule
    where rule.school_id=p_school_id and rule.teacher_id=p_teacher_id
      and rule.weekday=local_weekday and rule.effective_from<=local_day
      and (rule.effective_until is null or rule.effective_until>=local_day)
      and rule.start_time<=local_start_time and rule.end_time>=local_end::time
  ) then raise exception 'outside_teacher_availability'; end if;

  if exists(select 1 from public.lesson_events conflict
    where conflict.school_id=p_school_id and conflict.id<>event_row.id
      and conflict.teacher_id=p_teacher_id and conflict.status not in ('cancelled','rescheduled')
      and tstzrange(conflict.starts_at,conflict.ends_at,'[)')&&tstzrange(starts_at_utc,ends_at_utc,'[)'))
  then raise exception 'teacher_conflict'; end if;
  if exists(select 1 from public.lesson_events conflict
    where conflict.school_id=p_school_id and conflict.id<>event_row.id
      and conflict.student_id=event_row.student_id and conflict.status not in ('cancelled','rescheduled')
      and tstzrange(conflict.starts_at,conflict.ends_at,'[)')&&tstzrange(starts_at_utc,ends_at_utc,'[)'))
  then raise exception 'student_conflict'; end if;

  select version.id into effective_policy_version_id
  from public.school_policies policy
  join public.school_policy_versions version on version.school_id=policy.school_id and version.policy_id=policy.id
  where policy.school_id=p_school_id and policy.kind='cancellation' and policy.status='active'
    and policy.id=coalesce(
      (select selection.policy_id from public.service_product_policy_selections selection
       where selection.school_id=p_school_id and selection.product_id=event_row.product_id
         and selection.policy_kind='cancellation' and not selection.use_school_default),
      (select default_policy.id from public.school_policies default_policy
       where default_policy.school_id=p_school_id and default_policy.kind='cancellation'
         and default_policy.status='active' and default_policy.is_default))
    and version.published_at is not null
    and coalesce(version.effective_from,version.published_at)<=event_row.starts_at
  order by coalesce(version.effective_from,version.published_at) desc,version.version_number desc limit 1;

  previous_values:=jsonb_build_object('teacher_id',event_row.teacher_id,'place_id',event_row.place_id,
    'starts_at',event_row.starts_at,'ends_at',event_row.ends_at);
  new_values:=jsonb_build_object('teacher_id',p_teacher_id,'place_id',p_place_id,
    'starts_at',starts_at_utc,'ends_at',ends_at_utc);
  if previous_values=new_values then raise exception 'lesson_time_is_unchanged'; end if;

  update public.lesson_events set teacher_id=p_teacher_id,place_id=p_place_id,
    starts_at=starts_at_utc,ends_at=ends_at_utc,is_series_exception=true,
    exception_reason='Rescheduled: '||clean_reason
  where id=event_row.id;

  insert into public.lesson_event_changes(
    school_id,lesson_event_id,change_type,previous_values,new_values,actor_profile_id,
    actor_role,source,reason,policy_version_id,policy_result,counted_toward_self_service_limit
  ) values(
    p_school_id,event_row.id,'rescheduled',previous_values,new_values,p_actor_profile_id,
    p_actor_role,p_interaction_channel,clean_reason,effective_policy_version_id,p_policy_result,false
  );
  insert into public.domain_events(
    school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload
  ) values(
    p_school_id,'lesson.rescheduled','lesson_event',event_row.id,p_actor_profile_id,p_actor_role,
    p_interaction_channel,jsonb_build_object('origin_kind',p_origin_kind,'previous',previous_values,'current',new_values,
      'policy_version_id',effective_policy_version_id,'policy_result',p_policy_result)
  );
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,p_actor_profile_id,'lesson.rescheduled','lesson_event',event_row.id,
    jsonb_build_object('origin_kind',p_origin_kind,'interaction_channel',p_interaction_channel,
      'teacher_changed',event_row.teacher_id<>p_teacher_id,'place_changed',event_row.place_id<>p_place_id,
      'availability_override',p_allow_outside_availability,'policy_version_id',effective_policy_version_id));

  return jsonb_build_object('outcome','applied','lesson_event_id',event_row.id,
    'starts_at',starts_at_utc,'ends_at',ends_at_utc,'teacher_id',p_teacher_id,'place_id',p_place_id);
end $$;

revoke all on function public.reschedule_lesson_occurrence_core(uuid,uuid,uuid,uuid,timestamp,text,uuid,text,text,text,boolean,boolean,text)
  from public,anon,authenticated;

create or replace function public.reschedule_lesson_as_owner(
  p_school_id uuid,p_lesson_event_id uuid,p_teacher_id uuid,p_place_id uuid,
  p_local_start timestamp without time zone,p_source text,p_reason text,
  p_allow_outside_availability boolean default false
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_role text;
begin
  select member.role into actor_role from public.school_members member
  where member.school_id=p_school_id and member.profile_id=actor_id
    and member.status='active' and member.role in ('owner','admin');
  if actor_id is null or actor_role is null then raise exception 'not_authorized'; end if;
  if p_source not in ('calendar','lesson_detail') then raise exception 'invalid_reschedule_source'; end if;
  if p_allow_outside_availability and length(trim(coalesce(p_reason,'')))<4 then
    raise exception 'override_reason_required';
  end if;
  return public.reschedule_lesson_occurrence_core(
    p_school_id,p_lesson_event_id,p_teacher_id,p_place_id,p_local_start,p_reason,
    actor_id,actor_role,'owner',p_source,true,p_allow_outside_availability,
    case when p_allow_outside_availability then 'owner_availability_override' else 'owner_rescheduled' end
  );
end $$;

revoke all on function public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp,text,text,boolean) from public,anon;
grant execute on function public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp,text,text,boolean) to authenticated;

create or replace function public.propose_or_reschedule_assigned_lesson_as_teacher(
  p_school_id uuid,p_lesson_event_id uuid,p_local_start timestamp,p_reason text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  event_row public.lesson_events%rowtype;
  school_tz text;
  authority text;
  starts timestamptz;
  finishes timestamptz;
  duration interval;
  proposal_id uuid;
  owner_row record;
  student_name text;
  result jsonb;
begin
  if actor is null or nullif(trim(p_reason),'') is null or length(trim(p_reason))>500
  then raise exception 'invalid_request'; end if;
  select event.* into event_row from public.lesson_events event
  where event.school_id=p_school_id and event.id=p_lesson_event_id;
  if not found then raise exception 'lesson_not_found'; end if;
  if event_row.status<>'scheduled' or event_row.starts_at<=now() then raise exception 'lesson_is_not_reschedulable'; end if;
  if not event_row.reschedule_allowed then raise exception 'lesson_reschedule_blocked'; end if;
  select teacher.scheduling_authority into authority
  from public.teachers teacher
  join public.people person on person.school_id=teacher.school_id and person.id=teacher.person_id
  join public.school_members member on member.school_id=person.school_id and member.profile_id=person.profile_id
    and member.status='active'
  where teacher.school_id=p_school_id and teacher.person_id=event_row.teacher_id
    and person.profile_id=actor and person.status='active' and member.role in ('teacher','owner','admin')
  for share of teacher,person,member;
  if authority is null then raise exception 'not_authorized'; end if;

  if authority='manage_assigned_lessons' then
    result:=public.reschedule_lesson_occurrence_core(
      p_school_id,event_row.id,event_row.teacher_id,event_row.place_id,p_local_start,p_reason,
      actor,'teacher','teacher','teacher_schedule',false,false,'teacher_authorized_reschedule'
    );
    for owner_row in select member.profile_id from public.school_members member
      where member.school_id=p_school_id and member.status='active'
        and member.role in ('owner','admin') and member.profile_id<>actor
    loop
      insert into public.owner_notifications(
        school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata
      ) values(
        p_school_id,owner_row.profile_id,'lesson_created','Teacher rescheduled a lesson',
        'The assigned teacher moved a lesson. The calendar and lesson history have been updated.',
        '/schools/'||p_school_id,'teacher-rescheduled:'||event_row.id||':'||extract(epoch from (result->>'starts_at')::timestamptz)::bigint,
        'lesson_event',event_row.id,jsonb_build_object('starts_at',result->>'starts_at')
      ) on conflict(recipient_profile_id,dedupe_key) do nothing;
    end loop;
    return result;
  end if;

  select school.timezone into school_tz from public.schools school where school.id=p_school_id;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text,0));
  select event.* into event_row from public.lesson_events event
  where event.school_id=p_school_id and event.id=p_lesson_event_id for update;
  if not found or event_row.status<>'scheduled' or event_row.starts_at<=now()
  then raise exception 'lesson_is_not_reschedulable'; end if;
  if not event_row.reschedule_allowed then raise exception 'lesson_reschedule_blocked'; end if;
  starts:=p_local_start at time zone school_tz;
  duration:=event_row.ends_at-event_row.starts_at;
  finishes:=starts+duration;
  if starts<=now() then raise exception 'new_lesson_time_must_be_future'; end if;
  if starts=event_row.starts_at then raise exception 'lesson_time_is_unchanged'; end if;
  if exists(select 1 from public.lesson_events conflict
    where conflict.school_id=p_school_id and conflict.id<>event_row.id
      and conflict.status not in ('cancelled','rescheduled')
      and (conflict.teacher_id=event_row.teacher_id or conflict.student_id=event_row.student_id)
      and tstzrange(conflict.starts_at,conflict.ends_at,'[)')&&tstzrange(starts,finishes,'[)'))
  then raise exception 'lesson_conflict'; end if;
  if exists(select 1 from public.lesson_schedule_proposals proposal
    where proposal.school_id=p_school_id and proposal.lesson_event_id=event_row.id
      and proposal.status in ('pending_owner','pending_teacher'))
  then raise exception 'proposal_already_pending'; end if;

  insert into public.lesson_schedule_proposals(
    school_id,teacher_id,student_id,product_id,place_id,schedule_type,proposed_local_start,
    proposed_starts_at,proposed_ends_at,notes,reason,status,created_by,lesson_event_id,proposal_kind
  ) values(
    p_school_id,event_row.teacher_id,event_row.student_id,event_row.product_id,event_row.place_id,'one_time',
    p_local_start,starts,finishes,event_row.notes,trim(p_reason),'pending_owner',actor,event_row.id,'reschedule'
  ) returning id into proposal_id;
  select coalesce(nullif(trim(person.preferred_name),''),person.first_name)||' '||person.last_name into student_name
  from public.people person where person.school_id=p_school_id and person.id=event_row.student_id;
  for owner_row in select member.profile_id from public.school_members member
    where member.school_id=p_school_id and member.status='active' and member.role in ('owner','admin')
  loop
    insert into public.owner_notifications(
      school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata
    ) values(
      p_school_id,owner_row.profile_id,'lesson_created','Teacher proposed a new lesson time',
      coalesce(student_name,'A student')||' remains at the original time until you approve or decline the teacher’s proposal.',
      '/schools/'||p_school_id,'teacher-reschedule-proposal:'||proposal_id,
      'lesson_schedule_proposal',proposal_id,
      jsonb_build_object('lesson_event_id',event_row.id,'proposed_starts_at',starts,'status','pending_owner')
    ) on conflict(recipient_profile_id,dedupe_key) do nothing;
  end loop;
  insert into public.domain_events(
    school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload
  ) values(
    p_school_id,'lesson_reschedule_proposal.created','lesson_schedule_proposal',proposal_id,
    actor,'teacher','teacher_schedule',jsonb_build_object('lesson_event_id',event_row.id,
      'original_starts_at',event_row.starts_at,'proposed_starts_at',starts)
  );
  return jsonb_build_object('outcome','pending_owner','proposal_id',proposal_id);
end $$;

revoke all on function public.propose_or_reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp,text) from public,anon;
grant execute on function public.propose_or_reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp,text) to authenticated;

comment on function public.reschedule_lesson_occurrence_core(uuid,uuid,uuid,uuid,timestamp,text,uuid,text,text,text,boolean,boolean,text) is
  'Private occurrence-move transaction. Authorization wrappers state actor, origin, interaction channel, and availability authority explicitly.';
