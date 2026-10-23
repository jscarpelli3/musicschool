-- Recurrence describes a calendar series, not the thing being sold. Keep
-- pricing/duration on the offering and choose one-time versus repeating when
-- an owner schedules the lesson.
alter table public.service_products
  drop column default_schedule_type,
  drop column sessions_per_interval,
  drop column interval_count,
  drop column interval_unit;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='service_products'
      and column_name in ('default_schedule_type','sessions_per_interval','interval_count','interval_unit')
  ) then
    raise exception 'Offering cadence columns still exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='lesson_series' and column_name='recurrence_rule'
  ) then
    raise exception 'Calendar series recurrence is missing';
  end if;
end $$;
