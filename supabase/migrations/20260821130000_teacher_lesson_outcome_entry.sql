create or replace function public.record_lesson_outcome(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_outcome text,
  p_staff_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  member_role text;
  event_row public.lesson_events%rowtype;
  normalized_notes text := nullif(trim(p_staff_notes), '');
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if p_outcome not in ('completed', 'partial', 'no_show') then raise exception 'invalid_lesson_outcome'; end if;
  if length(coalesce(normalized_notes, '')) > 2000 then raise exception 'staff_notes_too_long'; end if;

  select member.role into member_role
  from public.school_members member
  where member.school_id = p_school_id
    and member.profile_id = actor_id
    and member.status = 'active';

  select event.* into event_row
  from public.lesson_events event
  where event.school_id = p_school_id and event.id = p_lesson_event_id
  for update;

  if event_row.id is null then raise exception 'lesson_not_found'; end if;
  if member_role not in ('owner', 'admin') and not (
    member_role = 'teacher' and exists (
      select 1
      from public.people person
      where person.school_id = p_school_id
        and person.id = event_row.teacher_id
        and person.profile_id = actor_id
        and person.status = 'active'
    )
  ) then raise exception 'not_authorized'; end if;
  if event_row.ends_at > now() then raise exception 'lesson_has_not_ended'; end if;
  if event_row.status <> 'scheduled' or event_row.outcome is not null then
    raise exception 'lesson_outcome_already_recorded';
  end if;

  update public.lesson_events
  set status = case when p_outcome = 'no_show' then 'no_show' else 'completed' end,
      outcome = p_outcome,
      actual_starts_at = case when p_outcome = 'no_show' then null else event_row.starts_at end,
      actual_ends_at = case when p_outcome = 'no_show' then null else event_row.ends_at end,
      actual_place_id = case when p_outcome = 'no_show' then null else event_row.place_id end,
      staff_notes = normalized_notes
  where school_id = p_school_id and id = p_lesson_event_id;

  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    p_school_id,
    actor_id,
    'lesson.outcome_recorded',
    'lesson_event',
    p_lesson_event_id,
    jsonb_build_object(
      'outcome', p_outcome,
      'recorded_by_role', member_role,
      'assigned_teacher_id', event_row.teacher_id,
      'scheduled_starts_at', event_row.starts_at,
      'scheduled_ends_at', event_row.ends_at,
      'has_staff_notes', normalized_notes is not null
    )
  );
end;
$$;

revoke all on function public.record_lesson_outcome(uuid,uuid,text,text) from public, anon;
grant execute on function public.record_lesson_outcome(uuid,uuid,text,text) to authenticated;

comment on function public.record_lesson_outcome(uuid,uuid,text,text) is
  'Records the first post-lesson service outcome for an owner/admin or the assigned teacher, with immutable audit evidence.';
