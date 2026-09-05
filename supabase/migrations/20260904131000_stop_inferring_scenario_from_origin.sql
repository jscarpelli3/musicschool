-- Origin answers who initiated an interaction. Scenario answers what happened.
-- They are deliberately not derivable from one another.
create or replace function public.derive_lesson_change_request_scenario()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.scenario is null then
    if new.origin_kind<>'family' then
      raise exception 'lesson_change_scenario_required';
    end if;
    -- Compatibility for the existing family portal RPC. Its explicit request
    -- action is sufficient to distinguish these two legacy scenarios.
    new.scenario:=case new.request_type
      when 'reschedule' then 'student_reschedule'
      when 'cancellation' then 'student_cancellation'
      else null
    end;
  end if;
  if new.scenario is null then raise exception 'invalid_lesson_change_scenario'; end if;
  return new;
end $$;

comment on function public.derive_lesson_change_request_scenario() is
  'Legacy family compatibility only. Non-family callers must state scenario explicitly; origin never determines business outcome.';
