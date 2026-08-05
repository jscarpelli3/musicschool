-- Make the current demo roster useful for monthly outcome and payer UI work.

update public.student_contacts contact
set relationship = case payer.external_ref
  when 'demo-payer-rachel' then 'mother'
  when 'demo-payer-dana' then 'father'
  when 'demo-payer-priya' then 'mother'
  when 'demo-payer-jordan' then 'guardian'
  when 'demo-payer-elise' then 'mother'
  when 'demo-payer-renee' then 'father'
  when 'demo-payer-marisol' then 'mother'
  when 'demo-payer-daniel' then 'father'
  else contact.relationship
end
from public.people payer
where payer.id = contact.contact_person_id
  and payer.external_ref like 'demo-payer-%';

with current_month_occurrences as (
  select
    event.id,
    student.external_ref,
    row_number() over (partition by event.student_id order by event.starts_at) as month_occurrence
  from public.lesson_events event
  join public.people student on student.id = event.student_id
  where student.external_ref like 'demo-student-%'
    and event.starts_at >= date_trunc('month', now())
    and event.starts_at < date_trunc('month', now()) + interval '1 month'
), display_outcomes as (
  select
    id,
    case external_ref
      when 'demo-student-maya' then 'completed'
      when 'demo-student-leo' then 'rescheduled'
      when 'demo-student-noah' then 'cancelled'
      when 'demo-student-sophie' then 'cancelled'
      when 'demo-student-amelia' then 'no_show'
      else 'completed'
    end as display_status,
    case external_ref
      when 'demo-student-noah' then 'timely'
      when 'demo-student-sophie' then 'late'
      else null
    end as display_cancellation_timing
  from current_month_occurrences
  where month_occurrence = 1
)
update public.lesson_events event
set
  status = display.display_status,
  cancellation_timing = display.display_cancellation_timing,
  outcome = case display.display_status
    when 'completed' then 'completed'
    when 'cancelled' then 'student_cancelled'
    when 'no_show' then 'no_show'
    else null
  end,
  actual_starts_at = case when display.display_status = 'completed' then event.starts_at else null end,
  actual_ends_at = case when display.display_status = 'completed' then event.ends_at else null end,
  actual_place_id = case when display.display_status = 'completed' then event.place_id else null end
from display_outcomes display
where event.id = display.id;
