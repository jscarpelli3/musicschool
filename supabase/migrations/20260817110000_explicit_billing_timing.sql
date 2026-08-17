-- Make billing timing an explicit, immutable agreement fact instead of the
-- draft generator's former implicit hybrid behavior.

alter table public.schools
  add column billing_timing_default text not null default 'before_service'
    check (billing_timing_default in ('before_service','after_service')),
  add column billing_day smallint not null default 1 check (billing_day between 1 and 28),
  add column payer_review_days smallint not null default 3 check (payer_review_days between 1 and 14),
  add column intended_charge_day smallint not null default 5 check (intended_charge_day between 1 and 28);

alter table public.service_products
  add column billing_timing_override text
    check (billing_timing_override is null or billing_timing_override in ('before_service','after_service'));

alter table public.lesson_series_billing_terms
  add column billing_timing text not null default 'before_service'
    check (billing_timing in ('before_service','after_service'));

alter table public.lesson_event_price_snapshots
  add column billing_timing text not null default 'before_service'
    check (billing_timing in ('before_service','after_service'));

comment on column public.schools.billing_timing_default is 'Default timing for new agreements; existing term and event snapshots do not change with it.';
comment on column public.service_products.billing_timing_override is 'Optional catalog default override for new agreements and standalone lessons.';
comment on column public.lesson_series_billing_terms.billing_timing is 'Immutable resolved before/after-service timing for this agreement version.';
comment on column public.lesson_event_price_snapshots.billing_timing is 'Immutable resolved billing timing for this lesson occurrence.';

create or replace function public.guard_lesson_series_billing_terms()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Lesson series billing terms cannot be deleted'; end if;
  if old.school_id is distinct from new.school_id
    or old.lesson_series_id is distinct from new.lesson_series_id
    or old.source_product_id is distinct from new.source_product_id
    or old.billing_mode is distinct from new.billing_mode
    or old.billing_timing is distinct from new.billing_timing
    or old.amount_cents is distinct from new.amount_cents
    or old.currency is distinct from new.currency
    or old.offering_name is distinct from new.offering_name
    or old.effective_from is distinct from new.effective_from
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at
  then raise exception 'Lesson series billing term snapshots are immutable'; end if;
  if old.effective_until is not null or new.effective_until is null or new.effective_until < old.effective_from
  then raise exception 'An open billing term may only be closed once'; end if;
  return new;
end; $$;

create or replace function public.capture_lesson_event_price_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  product_row public.service_products%rowtype;
  term_row public.lesson_series_billing_terms%rowtype;
  local_service_date date;
  school_row public.schools%rowtype;
  resolved_timing text;
begin
  select * into strict product_row from public.service_products where school_id = new.school_id and id = new.product_id;
  select * into strict school_row from public.schools where id = new.school_id;
  local_service_date := (new.starts_at at time zone school_row.timezone)::date;
  if new.lesson_series_id is null then
    if product_row.pricing_model <> 'per_session' then raise exception 'standalone_lesson_requires_per_session_price'; end if;
    resolved_timing := coalesce(product_row.billing_timing_override, school_row.billing_timing_default);
    insert into public.lesson_event_price_snapshots (
      school_id, lesson_event_id, source_product_id, billing_mode, billing_timing,
      amount_cents, currency, offering_name, billing_service_date
    ) values (
      new.school_id, new.id, product_row.id, 'per_session', resolved_timing,
      product_row.price_cents, product_row.currency, product_row.name, local_service_date
    );
    return new;
  end if;
  select * into term_row from public.lesson_series_billing_terms term
  where term.school_id = new.school_id and term.lesson_series_id = new.lesson_series_id
    and term.effective_from <= local_service_date
    and (term.effective_until is null or term.effective_until >= local_service_date)
  order by term.effective_from desc limit 1;
  if not found then raise exception 'lesson_series_missing_effective_billing_terms'; end if;
  if term_row.source_product_id <> new.product_id then raise exception 'lesson_event_product_does_not_match_billing_terms'; end if;
  insert into public.lesson_event_price_snapshots (
    school_id, lesson_event_id, source_product_id, series_billing_terms_id,
    billing_mode, billing_timing, amount_cents, currency, offering_name, billing_service_date
  ) values (
    new.school_id, new.id, term_row.source_product_id, term_row.id,
    term_row.billing_mode, term_row.billing_timing, term_row.amount_cents,
    term_row.currency, term_row.offering_name, local_service_date
  );
  return new;
end; $$;

create or replace function public.prepare_family_billing_draft(p_school_id uuid, p_billing_account_id uuid, p_month date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid(); month_start date := date_trunc('month',p_month)::date;
  month_end date := (date_trunc('month',p_month)+interval '1 month - 1 day')::date;
  school_timezone text; school_currency text; local_today date; period_id uuid; period_status text;
  event_row record; series_row record; result jsonb; disposition text; reason_code text; line_amount bigint;
begin
  if actor_id is null or not public.has_school_role(p_school_id,array['owner','admin']) then raise exception 'not_authorized'; end if;
  if p_month <> month_start then raise exception 'billing_month_must_be_first_day'; end if;
  select timezone,currency,(now() at time zone timezone)::date into school_timezone,school_currency,local_today from public.schools where id=p_school_id;
  if school_timezone is null then raise exception 'school_not_found'; end if;
  if not exists(select 1 from public.billing_accounts where school_id=p_school_id and id=p_billing_account_id and status='active') then raise exception 'active_billing_account_not_found'; end if;
  if not exists(select 1 from public.billing_account_students where school_id=p_school_id and billing_account_id=p_billing_account_id) then raise exception 'billing_account_has_no_students'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_billing_account_id::text||':'||month_start::text,0));
  select id,status into period_id,period_status from public.billing_periods
    where billing_account_id=p_billing_account_id and period_start=month_start and period_end=month_end for update;
  if found and period_status not in ('draft','review') then raise exception 'billing_period_is_not_refreshable'; end if;
  if period_id is null then
    insert into public.billing_periods(school_id,billing_account_id,period_start,period_end,label,currency,status,created_by)
    values(p_school_id,p_billing_account_id,month_start,month_end,to_char(month_start,'FMMonth YYYY'),school_currency,'draft',actor_id)
    returning id into period_id;
  elsif period_status='review' then update public.billing_periods set status='draft' where id=period_id; end if;
  delete from public.billing_line_items where billing_period_id=period_id and source_type in ('lesson','lesson_series');

  for series_row in
    select series.id lesson_series_id,series.starts_on,series.ends_on,term.id billing_terms_id,
      term.amount_cents,term.currency,term.offering_name,term.effective_from,term.effective_until,term.billing_timing
    from public.lesson_series series join public.billing_account_students mapping
      on mapping.school_id=series.school_id and mapping.student_id=series.student_id and mapping.billing_account_id=p_billing_account_id
    join public.lesson_series_billing_terms term on term.school_id=series.school_id and term.lesson_series_id=series.id
      and term.billing_mode='fixed_monthly' and term.effective_from<=month_start and (term.effective_until is null or term.effective_until>=month_start)
    where series.school_id=p_school_id and series.status in ('active','paused','ended')
      and series.starts_on<=month_end and (series.ends_on is null or series.ends_on>=month_start)
  loop
    if series_row.currency<>school_currency then raise exception 'mixed_billing_currency'; end if;
    if series_row.billing_timing='after_service' and month_end>=local_today then raise exception 'after_service_period_is_not_complete'; end if;
    if series_row.starts_on>month_start or (series_row.ends_on is not null and series_row.ends_on<month_end)
      or (series_row.effective_until is not null and series_row.effective_until<month_end) then raise exception 'fixed_monthly_partial_period_requires_owner_review'; end if;
    if exists(select 1 from public.lesson_series_billing_terms t where t.school_id=p_school_id and t.lesson_series_id=series_row.lesson_series_id
      and t.id<>series_row.billing_terms_id and t.effective_from<=month_end and (t.effective_until is null or t.effective_until>=month_start))
      then raise exception 'fixed_monthly_terms_change_inside_period'; end if;
    insert into public.billing_line_items(school_id,billing_period_id,source_type,source_id,description,service_date,unit_amount_cents,metadata,created_by,billing_terms_id)
    values(p_school_id,period_id,'lesson_series',series_row.lesson_series_id,series_row.offering_name||' · monthly tuition',month_start,
      series_row.amount_cents,jsonb_build_object('billing_mode','fixed_monthly','billing_timing',series_row.billing_timing,'disposition','charge'),actor_id,series_row.billing_terms_id);
  end loop;

  for event_row in
    select event.id lesson_event_id,event.starts_at operational_starts_at,event.status,event.lesson_series_id,
      snapshot.id snapshot_id,snapshot.series_billing_terms_id,snapshot.billing_mode,snapshot.billing_timing,
      snapshot.amount_cents,snapshot.currency,snapshot.offering_name,snapshot.billing_service_date service_date
    from public.lesson_events event join public.billing_account_students mapping
      on mapping.school_id=event.school_id and mapping.student_id=event.student_id and mapping.billing_account_id=p_billing_account_id
    join public.lesson_event_price_snapshots snapshot on snapshot.school_id=event.school_id and snapshot.lesson_event_id=event.id
    where event.school_id=p_school_id and snapshot.billing_service_date between month_start and month_end
    order by snapshot.billing_service_date,event.starts_at,event.id
  loop
    if event_row.currency<>school_currency then raise exception 'mixed_billing_currency'; end if;
    result:=public.compute_lesson_event_billing_disposition(p_school_id,event_row.lesson_event_id,now());
    if event_row.billing_timing='before_service' and event_row.status='scheduled' then
      disposition:='charge'; reason_code:='scheduled_obligation';
    elsif result->>'state'='not_ready' then
      raise exception 'after_service_period_is_not_complete:%',event_row.lesson_event_id;
    else disposition:=result->>'disposition'; reason_code:=result->>'reason_code'; end if;
    if disposition='owner_review' or disposition is null then raise exception 'lesson_requires_owner_review:%:%',event_row.lesson_event_id,reason_code; end if;
    if event_row.billing_mode='fixed_monthly' then
      if event_row.series_billing_terms_id is null or event_row.lesson_series_id is null then raise exception 'fixed_monthly_lesson_missing_series_terms'; end if;
      if disposition='credit' then raise exception 'fixed_monthly_credit_requires_owner_review:%',event_row.lesson_event_id; end if;
      line_amount:=0;
    elsif disposition='charge' then line_amount:=event_row.amount_cents; else line_amount:=0; end if;
    insert into public.billing_line_items(school_id,billing_period_id,source_type,source_id,description,service_date,unit_amount_cents,metadata,created_by,billing_terms_id,lesson_event_price_snapshot_id)
    values(p_school_id,period_id,'lesson',event_row.lesson_event_id,event_row.offering_name||' · '||to_char(event_row.service_date,'Mon FMDD'),event_row.service_date,line_amount,
      jsonb_build_object('billing_mode',event_row.billing_mode,'billing_timing',event_row.billing_timing,'disposition',disposition,'reason_code',reason_code,
        'policy_version_id',result->>'policy_version_id','policy_disposition',result->>'policy_disposition','listed_amount_cents',event_row.amount_cents,'operational_starts_at',event_row.operational_starts_at),
      actor_id,event_row.series_billing_terms_id,event_row.snapshot_id);
  end loop;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'billing_period.draft_prepared','billing_period',period_id,jsonb_build_object('period_start',month_start,'period_end',month_end));
  return period_id;
end; $$;

revoke all on function public.prepare_family_billing_draft(uuid,uuid,date) from public,anon;
grant execute on function public.prepare_family_billing_draft(uuid,uuid,date) to authenticated;
