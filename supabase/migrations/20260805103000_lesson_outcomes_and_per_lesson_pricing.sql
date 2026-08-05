-- Monthly reporting needs occurrence outcomes; offerings quote per-lesson prices.

alter table public.lesson_events drop constraint lesson_events_status_check;
alter table public.lesson_events
  add constraint lesson_events_status_check check (status in ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  add column cancellation_timing text constraint lesson_events_cancellation_timing_value_check
    check (cancellation_timing is null or cancellation_timing in ('timely', 'late')),
  add column rescheduled_to_event_id uuid references public.lesson_events(id) on delete set null,
  add constraint lesson_events_cancellation_timing_check check (
    (status = 'cancelled' and cancellation_timing is not null)
    or (status <> 'cancelled' and cancellation_timing is null)
  );

-- The current catalog is demo data whose fixed monthly figures were based on
-- four lessons. Convert those values to their per-lesson equivalents.
update public.service_products
set price_cents = round(price_cents / 4.0), pricing_model = 'per_session'
where pricing_model = 'fixed_monthly';

alter table public.service_products
  alter column pricing_model set default 'per_session';

-- Give the current demo month varied outcomes for the roster visualization.
with ranked as (
  select
    event.id,
    row_number() over (partition by event.student_id order by event.starts_at) as occurrence_number
  from public.lesson_events event
  join public.people student on student.id = event.student_id
  where student.external_ref like 'demo-student-%'
    and event.starts_at < now()
)
update public.lesson_events event
set
  status = case
    when ranked.occurrence_number % 11 = 0 then 'no_show'
    when ranked.occurrence_number % 7 = 0 then 'cancelled'
    when ranked.occurrence_number % 5 = 0 then 'rescheduled'
    else 'completed'
  end,
  cancellation_timing = case
    when ranked.occurrence_number % 7 = 0 and ranked.occurrence_number % 2 = 0 then 'timely'
    when ranked.occurrence_number % 7 = 0 then 'late'
    else null
  end,
  outcome = case
    when ranked.occurrence_number % 11 = 0 then 'no_show'
    when ranked.occurrence_number % 7 = 0 then 'student_cancelled'
    when ranked.occurrence_number % 5 = 0 then null
    else 'completed'
  end,
  actual_starts_at = case
    when ranked.occurrence_number % 11 <> 0
      and ranked.occurrence_number % 7 <> 0
      and ranked.occurrence_number % 5 <> 0 then event.starts_at
    else null
  end,
  actual_ends_at = case
    when ranked.occurrence_number % 11 <> 0
      and ranked.occurrence_number % 7 <> 0
      and ranked.occurrence_number % 5 <> 0 then event.ends_at
    else null
  end,
  actual_place_id = case
    when ranked.occurrence_number % 11 <> 0
      and ranked.occurrence_number % 7 <> 0
      and ranked.occurrence_number % 5 <> 0 then event.place_id
    else null
  end
from ranked
where event.id = ranked.id;

revoke update on public.lesson_events from authenticated;
grant update (product_id, teacher_id, student_id, starts_at, ends_at, status, notes, place_id, lesson_series_id, is_series_exception, exception_reason, actual_starts_at, actual_ends_at, actual_place_id, outcome, staff_notes, cancellation_timing, rescheduled_to_event_id) on public.lesson_events to authenticated;
