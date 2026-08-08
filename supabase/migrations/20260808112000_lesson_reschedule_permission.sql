alter table public.lesson_events
  add column reschedule_allowed boolean not null default true,
  add column reschedule_blocked_reason text,
  add constraint lesson_reschedule_block_reason_check check (
    reschedule_allowed or length(trim(reschedule_blocked_reason)) between 1 and 300
  );

create or replace function public.guard_blocked_lesson_reschedule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not old.reschedule_allowed and (
    new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.teacher_id is distinct from old.teacher_id
    or new.place_id is distinct from old.place_id
  ) then
    raise exception 'lesson_reschedule_blocked';
  end if;
  return new;
end;
$$;

create trigger lesson_events_guard_blocked_reschedule
before update of starts_at, ends_at, teacher_id, place_id on public.lesson_events
for each row execute function public.guard_blocked_lesson_reschedule();

create or replace function public.set_lesson_reschedule_permission(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_allowed boolean,
  p_blocked_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  member_role text;
  event_teacher_id uuid;
begin
  select member.role into member_role
  from public.school_members member
  where member.school_id = p_school_id and member.profile_id = actor_id and member.status = 'active';

  select event.teacher_id into event_teacher_id
  from public.lesson_events event
  where event.school_id = p_school_id and event.id = p_lesson_event_id
  for update;
  if event_teacher_id is null then raise exception 'lesson_not_found'; end if;

  if member_role not in ('owner', 'admin') and not (
    member_role = 'teacher' and exists (
      select 1 from public.people person
      where person.school_id = p_school_id
        and person.id = event_teacher_id
        and person.profile_id = actor_id
    )
  ) then raise exception 'not_authorized'; end if;
  if not p_allowed and nullif(trim(p_blocked_reason), '') is null then
    raise exception 'blocked_reason_required';
  end if;

  update public.lesson_events
  set reschedule_allowed = p_allowed,
      reschedule_blocked_reason = case when p_allowed then null else left(trim(p_blocked_reason), 300) end
  where school_id = p_school_id and id = p_lesson_event_id;

  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    p_school_id, actor_id,
    case when p_allowed then 'lesson.reschedule_enabled' else 'lesson.reschedule_blocked' end,
    'lesson_event', p_lesson_event_id,
    jsonb_build_object('allowed', p_allowed, 'blocked_reason', case when p_allowed then null else trim(p_blocked_reason) end)
  );
end;
$$;

revoke all on function public.set_lesson_reschedule_permission(uuid,uuid,boolean,text) from public, anon;
grant execute on function public.set_lesson_reschedule_permission(uuid,uuid,boolean,text) to authenticated;

comment on column public.lesson_events.reschedule_allowed is
  'Explicit per-occurrence policy permission; time/status eligibility is evaluated separately.';
