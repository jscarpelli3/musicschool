alter table public.lesson_events
  add column reschedule_reason_code text,
  add column reschedule_reason_detail text,
  add constraint lesson_events_reschedule_reason_code_check check (
    reschedule_reason_code is null or reschedule_reason_code in (
      'family_request', 'teacher_request', 'school_closure', 'illness', 'schedule_conflict', 'other'
    )
  ),
  add constraint lesson_events_other_reschedule_reason_check check (
    reschedule_reason_code is distinct from 'other'
    or nullif(trim(reschedule_reason_detail), '') is not null
  );

alter table public.lesson_event_changes
  add column reason_code text,
  add constraint lesson_event_changes_reason_code_check check (
    reason_code is null or reason_code in (
      'family_request', 'teacher_request', 'school_closure', 'illness', 'schedule_conflict', 'other'
    )
  );

create or replace function public.normalize_reschedule_reason()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  encoded text;
  code text;
  detail text;
  label text;
begin
  if tg_table_name = 'lesson_events' then
    encoded := substring(new.exception_reason from length('Rescheduled: ') + 1);
  else
    encoded := new.reason;
  end if;

  if position('::' in coalesce(encoded, '')) = 0 then return new; end if;
  code := split_part(encoded, '::', 1);
  detail := nullif(trim(substring(encoded from position('::' in encoded) + 2)), '');
  label := case code
    when 'family_request' then 'Family requested another time'
    when 'teacher_request' then 'Teacher requested another time'
    when 'school_closure' then 'School closure or holiday'
    when 'illness' then 'Illness'
    when 'schedule_conflict' then 'Schedule conflict'
    when 'other' then detail
  end;
  if label is null then raise exception 'invalid_reschedule_reason'; end if;

  if tg_table_name = 'lesson_events' then
    new.reschedule_reason_code := code;
    new.reschedule_reason_detail := detail;
    new.exception_reason := 'Rescheduled: ' || label;
  else
    new.reason_code := code;
    new.reason := label;
  end if;
  return new;
end;
$$;

create trigger lesson_events_normalize_reschedule_reason
before update of exception_reason on public.lesson_events
for each row
when (new.exception_reason like 'Rescheduled: %::%')
execute function public.normalize_reschedule_reason();

create trigger lesson_event_changes_normalize_reschedule_reason
before insert on public.lesson_event_changes
for each row
when (new.change_type = 'rescheduled' and new.reason like '%::%')
execute function public.normalize_reschedule_reason();

comment on column public.lesson_events.reschedule_reason_code is
  'Structured reason for the most recent reschedule of this occurrence.';
comment on column public.lesson_events.reschedule_reason_detail is
  'Owner-entered detail when the structured reschedule reason is other.';
