-- Replacement scheduling must leave an owner-facing trail that identifies both
-- the new occurrence and the lesson it replaced. The generic lesson-created
-- notification is inserted synchronously by create_single_lesson, so enrich it
-- after the entitlement has been linked to the new event.

create or replace function public.schedule_service_entitlement(
  p_school_id uuid,p_entitlement_id uuid,p_teacher_id uuid,p_place_id uuid,
  p_local_start timestamp without time zone,p_notes text default null,
  p_allow_outside_availability boolean default false,p_override_reason text default null
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); entitlement public.lesson_service_entitlements%rowtype;
  source_event public.lesson_events%rowtype; product_duration integer; event_id uuid; request_row public.lesson_change_requests%rowtype;
  school_timezone text; scheduled_start timestamptz; scheduled_end timestamptz; student_name text;
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
  select starts_at,ends_at into scheduled_start,scheduled_end from public.lesson_events where id=event_id;
  select coalesce(nullif(trim(person.preferred_name),''),trim(person.first_name))||' '||trim(person.last_name)
    into student_name from public.people person where person.school_id=p_school_id and person.id=entitlement.student_id;

  update public.owner_notifications notification set
    title='Replacement lesson scheduled for '||student_name,
    message='New time: '||to_char(scheduled_start at time zone school_timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')
      ||'–'||to_char(scheduled_end at time zone school_timezone,'FMHH12:MI AM')
      ||'. This replaces the lesson originally scheduled for '
      ||to_char(source_event.starts_at at time zone school_timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')||'.',
    href='/schools/'||p_school_id||'?lesson='||event_id||'#school-calendar',
    metadata=coalesce(notification.metadata,'{}'::jsonb)||jsonb_build_object(
      'replacement',true,'source_lesson_event_id',source_event.id,'starts_at',scheduled_start,'ends_at',scheduled_end)
  where notification.school_id=p_school_id and notification.entity_type='lesson_event' and notification.entity_id=event_id;

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

-- Repair already-created replacement notifications, including the staging
-- occurrence used to expose this gap.
update public.owner_notifications notification set
  title='Replacement lesson scheduled for '||coalesce(nullif(trim(student.preferred_name),''),trim(student.first_name))||' '||trim(student.last_name),
  message='New time: '||to_char(replacement.starts_at at time zone school.timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')
    ||'–'||to_char(replacement.ends_at at time zone school.timezone,'FMHH12:MI AM')
    ||'. This replaces the lesson originally scheduled for '
    ||to_char(original.starts_at at time zone school.timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')||'.',
  href='/schools/'||notification.school_id||'?lesson='||replacement.id||'#school-calendar',
  metadata=coalesce(notification.metadata,'{}'::jsonb)||jsonb_build_object(
    'replacement',true,'source_lesson_event_id',original.id,'starts_at',replacement.starts_at,'ends_at',replacement.ends_at)
from public.lesson_events replacement
join public.lesson_service_entitlements entitlement
  on entitlement.school_id=replacement.school_id and entitlement.id=replacement.service_entitlement_id
join public.lesson_events original
  on original.school_id=entitlement.school_id and original.id=entitlement.source_lesson_event_id
join public.schools school on school.id=replacement.school_id
join public.people student on student.school_id=replacement.school_id and student.id=replacement.student_id
where notification.school_id=replacement.school_id
  and notification.entity_type='lesson_event' and notification.entity_id=replacement.id;
