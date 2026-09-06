-- Interaction channel is evidence, not business outcome. Preserve the actual
-- teacher-portal channel instead of coercing it to the legacy calendar label.

alter table public.lesson_event_changes drop constraint lesson_event_changes_source_check;
alter table public.lesson_event_changes add constraint lesson_event_changes_source_check
  check (source in ('calendar','lesson_detail','client_portal','teacher_schedule','system'));

comment on column public.lesson_event_changes.source is
  'Interaction channel that initiated the change; never used to infer actor authority, scenario, or policy outcome.';
