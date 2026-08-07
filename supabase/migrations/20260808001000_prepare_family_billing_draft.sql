-- Idempotent monthly family draft preparation. The function either replaces
-- all generated lesson lines as one transaction or leaves the prior draft intact.

create unique index billing_account_students_one_account_per_student
  on public.billing_account_students(school_id, student_id);

create or replace function public.prepare_family_billing_draft(
  p_school_id uuid,
  p_billing_account_id uuid,
  p_month date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  month_start date := date_trunc('month', p_month)::date;
  month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  next_month date := (date_trunc('month', p_month) + interval '1 month')::date;
  school_timezone text;
  school_currency text;
  period_id uuid;
  period_status text;
  event_row record;
  series_row record;
  result jsonb;
  disposition text;
  reason_code text;
  line_amount bigint;
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then
    raise exception 'not_authorized';
  end if;
  if p_month <> month_start then
    raise exception 'billing_month_must_be_first_day';
  end if;

  select timezone, currency into school_timezone, school_currency
  from public.schools where id = p_school_id;
  if school_timezone is null then raise exception 'school_not_found'; end if;

  if not exists (
    select 1 from public.billing_accounts
    where school_id = p_school_id and id = p_billing_account_id and status = 'active'
  ) then raise exception 'active_billing_account_not_found'; end if;

  if not exists (
    select 1 from public.billing_account_students
    where school_id = p_school_id and billing_account_id = p_billing_account_id
  ) then raise exception 'billing_account_has_no_students'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_school_id::text || ':' || p_billing_account_id::text || ':' || month_start::text,
    0
  ));

  select id, status into period_id, period_status
  from public.billing_periods
  where billing_account_id = p_billing_account_id
    and period_start = month_start
    and period_end = month_end
  for update;

  if found and period_status not in ('draft', 'review') then
    raise exception 'billing_period_is_not_refreshable';
  end if;

  if period_id is null then
    insert into public.billing_periods (
      school_id, billing_account_id, period_start, period_end,
      label, currency, status, created_by
    ) values (
      p_school_id, p_billing_account_id, month_start, month_end,
      to_char(month_start, 'FMMonth YYYY'), school_currency, 'draft', actor_id
    ) returning id into period_id;
  elsif period_status = 'review' then
    update public.billing_periods set status = 'draft' where id = period_id;
  end if;

  -- Generated lines are safe to rebuild. Owner-entered adjustments survive.
  delete from public.billing_line_items
  where billing_period_id = period_id
    and source_type in ('lesson', 'lesson_series');

  -- Fixed-monthly agreements generate one base line per series. Partial first or
  -- final months and mid-month term changes require an explicit owner decision.
  for series_row in
    select
      series.id as lesson_series_id,
      series.starts_on,
      series.ends_on,
      term.id as billing_terms_id,
      term.amount_cents,
      term.currency,
      term.offering_name,
      term.effective_from,
      term.effective_until
    from public.lesson_series series
    join public.billing_account_students mapping
      on mapping.school_id = series.school_id
     and mapping.student_id = series.student_id
     and mapping.billing_account_id = p_billing_account_id
    join public.lesson_series_billing_terms term
      on term.school_id = series.school_id
     and term.lesson_series_id = series.id
     and term.billing_mode = 'fixed_monthly'
     and term.effective_from <= month_start
     and (term.effective_until is null or term.effective_until >= month_start)
    where series.school_id = p_school_id
      and series.status in ('active', 'paused', 'ended')
      and series.starts_on <= month_end
      and (series.ends_on is null or series.ends_on >= month_start)
  loop
    if series_row.currency <> school_currency then raise exception 'mixed_billing_currency'; end if;
    if series_row.starts_on > month_start
      or (series_row.ends_on is not null and series_row.ends_on < month_end)
      or (series_row.effective_until is not null and series_row.effective_until < month_end)
    then raise exception 'fixed_monthly_partial_period_requires_owner_review'; end if;
    if exists (
      select 1 from public.lesson_series_billing_terms other_term
      where other_term.school_id = p_school_id
        and other_term.lesson_series_id = series_row.lesson_series_id
        and other_term.id <> series_row.billing_terms_id
        and other_term.effective_from <= month_end
        and (other_term.effective_until is null or other_term.effective_until >= month_start)
    ) then raise exception 'fixed_monthly_terms_change_inside_period'; end if;

    insert into public.billing_line_items (
      school_id, billing_period_id, source_type, source_id, description,
      service_date, unit_amount_cents, metadata, created_by, billing_terms_id
    ) values (
      p_school_id, period_id, 'lesson_series', series_row.lesson_series_id,
      series_row.offering_name || ' · monthly tuition', month_start,
      series_row.amount_cents,
      jsonb_build_object('billing_mode', 'fixed_monthly', 'disposition', 'charge'),
      actor_id, series_row.billing_terms_id
    );
  end loop;

  for event_row in
    select
      event.id as lesson_event_id,
      event.starts_at,
      event.lesson_series_id,
      snapshot.id as snapshot_id,
      snapshot.series_billing_terms_id,
      snapshot.billing_mode,
      snapshot.amount_cents,
      snapshot.currency,
      snapshot.offering_name,
      (event.starts_at at time zone school_timezone)::date as service_date
    from public.lesson_events event
    join public.billing_account_students mapping
      on mapping.school_id = event.school_id
     and mapping.student_id = event.student_id
     and mapping.billing_account_id = p_billing_account_id
    join public.lesson_event_price_snapshots snapshot
      on snapshot.school_id = event.school_id
     and snapshot.lesson_event_id = event.id
    where event.school_id = p_school_id
      and event.starts_at >= (month_start::timestamp at time zone school_timezone)
      and event.starts_at < (next_month::timestamp at time zone school_timezone)
    order by event.starts_at, event.id
  loop
    if event_row.currency <> school_currency then raise exception 'mixed_billing_currency'; end if;

    result := public.compute_lesson_event_billing_disposition(
      p_school_id, event_row.lesson_event_id, now()
    );

    if result ->> 'state' = 'not_ready' then
      disposition := 'charge';
      reason_code := 'scheduled_upcoming';
    else
      disposition := result ->> 'disposition';
      reason_code := result ->> 'reason_code';
    end if;

    if disposition = 'owner_review' or disposition is null then
      raise exception 'lesson_requires_owner_review:%:%', event_row.lesson_event_id, reason_code;
    end if;

    if event_row.billing_mode = 'fixed_monthly' then
      if event_row.series_billing_terms_id is null or event_row.lesson_series_id is null then
        raise exception 'fixed_monthly_lesson_missing_series_terms';
      end if;
      if disposition = 'credit' then
        raise exception 'fixed_monthly_credit_requires_owner_review:%', event_row.lesson_event_id;
      end if;
      line_amount := 0;
    elsif disposition = 'charge' then
      line_amount := event_row.amount_cents;
    else
      -- A per-session occurrence that is waived or credited before collection
      -- contributes zero; there is no prior charge in this draft to reverse.
      line_amount := 0;
    end if;

    insert into public.billing_line_items (
      school_id, billing_period_id, source_type, source_id, description,
      service_date, unit_amount_cents, metadata, created_by,
      billing_terms_id, lesson_event_price_snapshot_id
    ) values (
      p_school_id, period_id, 'lesson', event_row.lesson_event_id,
      event_row.offering_name || ' · ' || to_char(event_row.service_date, 'Mon FMDD'),
      event_row.service_date, line_amount,
      jsonb_build_object(
        'billing_mode', event_row.billing_mode,
        'disposition', disposition,
        'reason_code', reason_code,
        'policy_version_id', result ->> 'policy_version_id',
        'policy_disposition', result ->> 'policy_disposition',
        'listed_amount_cents', event_row.amount_cents
      ),
      actor_id, event_row.series_billing_terms_id, event_row.snapshot_id
    );
  end loop;

  insert into public.audit_log (
    school_id, actor_profile_id, action, entity_type, entity_id, metadata
  ) values (
    p_school_id, actor_id, 'billing_period.draft_prepared', 'billing_period', period_id,
    jsonb_build_object('period_start', month_start, 'period_end', month_end)
  );

  return period_id;
end;
$$;

revoke all on function public.prepare_family_billing_draft(uuid, uuid, date) from public, anon;
grant execute on function public.prepare_family_billing_draft(uuid, uuid, date) to authenticated;

comment on function public.prepare_family_billing_draft(uuid, uuid, date) is
  'Atomically creates or refreshes generated lesson lines for one family/month. Manual adjustments survive; unresolved facts abort the transaction.';
