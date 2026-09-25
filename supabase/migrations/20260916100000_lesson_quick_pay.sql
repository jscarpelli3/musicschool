-- Lesson-backed, payer-present Checkout collection. A request is independent of
-- a billing period, while its successful payment is allocated to one immutable
-- per-session lesson price snapshot.

create table public.lesson_payment_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  lesson_event_id uuid not null,
  lesson_event_price_snapshot_id uuid not null,
  billing_account_id uuid not null,
  payment_connection_id uuid not null,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created' check (status in ('created','open','succeeded','expired','failed')),
  provider_checkout_session_id text unique,
  provider_payment_intent_id text unique,
  provider_charge_id text unique,
  checkout_url text,
  expires_at timestamptz not null,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'succeeded' or (provider_checkout_session_id is not null and provider_payment_intent_id is not null and provider_charge_id is not null and succeeded_at is not null)),
  unique (school_id, id),
  foreign key (school_id, lesson_event_id) references public.lesson_events(school_id, id) on delete restrict,
  foreign key (school_id, lesson_event_price_snapshot_id) references public.lesson_event_price_snapshots(school_id, id) on delete restrict,
  foreign key (school_id, billing_account_id) references public.billing_accounts(school_id, id) on delete restrict,
  foreign key (school_id, payment_connection_id) references public.school_payment_connections(school_id, id) on delete restrict
);

create unique index lesson_payment_requests_one_succeeded
  on public.lesson_payment_requests(lesson_event_id) where status='succeeded';
create unique index lesson_payment_requests_one_open
  on public.lesson_payment_requests(lesson_event_id) where status in ('created','open');
create index lesson_payment_requests_school_status
  on public.lesson_payment_requests(school_id,status,created_at desc);
create trigger lesson_payment_requests_set_updated_at before update on public.lesson_payment_requests
for each row execute function public.set_updated_at();

alter table public.lesson_payment_requests enable row level security;
create policy lesson_payment_requests_billing_select on public.lesson_payment_requests for select to authenticated
  using (public.has_school_capability(school_id,'school.billing.manage'));
revoke all on public.lesson_payment_requests from public, anon;
grant select on public.lesson_payment_requests to authenticated;
revoke insert,update,delete on public.lesson_payment_requests from authenticated;

create or replace function public.complete_lesson_payment_request(
  p_request_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_provider_event_id text,
  p_succeeded_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare target public.lesson_payment_requests%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(trim(p_checkout_session_id),'') is null or nullif(trim(p_payment_intent_id),'') is null or nullif(trim(p_charge_id),'') is null then raise exception 'provider_identity_required'; end if;
  select * into target from public.lesson_payment_requests where id=p_request_id for update;
  if not found then raise exception 'payment_request_not_found'; end if;
  if target.provider_checkout_session_id is not null and target.provider_checkout_session_id is distinct from p_checkout_session_id then raise exception 'checkout_session_mismatch'; end if;
  if target.status='succeeded' then
    if target.provider_payment_intent_id is distinct from p_payment_intent_id then raise exception 'payment_intent_mismatch'; end if;
    return target.id;
  end if;
  if target.status not in ('created','open') then raise exception 'payment_request_not_payable'; end if;
  update public.lesson_payment_requests set status='succeeded',provider_checkout_session_id=p_checkout_session_id,provider_payment_intent_id=p_payment_intent_id,
    provider_charge_id=p_charge_id,checkout_url=null,succeeded_at=p_succeeded_at where id=target.id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
    values(target.school_id,null,'lesson_payment.succeeded','lesson_payment_request',target.id,
      jsonb_build_object('lesson_event_id',target.lesson_event_id,'amount_cents',target.amount_cents,'currency',target.currency,'provider_event_id',p_provider_event_id));
  return target.id;
end; $$;
revoke all on function public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz) to service_role;

comment on table public.lesson_payment_requests is
  'A payer-present Stripe Checkout request allocated to one per-session lesson. Provider webhooks alone establish succeeded state.';

-- Draft generation consults successful lesson allocations. The occurrence stays
-- visible on the statement, but contributes zero to the new amount due.
create or replace function public.prepare_family_billing_draft(p_school_id uuid, p_billing_account_id uuid, p_month date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid(); month_start date := date_trunc('month',p_month)::date;
  month_end date := (date_trunc('month',p_month)+interval '1 month - 1 day')::date;
  school_timezone text; school_currency text; local_today date; period_id uuid; period_status text;
  event_row record; series_row record; result jsonb; disposition text; reason_code text; line_amount bigint; separate_payment record;
begin
  if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized'; end if;
  if p_month <> month_start then raise exception 'billing_month_must_be_first_day'; end if;
  select timezone,currency,(now() at time zone timezone)::date into school_timezone,school_currency,local_today from public.schools where id=p_school_id;
  if school_timezone is null then raise exception 'school_not_found'; end if;
  if not exists(select 1 from public.billing_accounts where school_id=p_school_id and id=p_billing_account_id and status='active') then raise exception 'active_billing_account_not_found'; end if;
  if not exists(select 1 from public.billing_account_students where school_id=p_school_id and billing_account_id=p_billing_account_id) then raise exception 'billing_account_has_no_students'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_billing_account_id::text||':'||month_start::text,0));
  select id,status into period_id,period_status from public.billing_periods where billing_account_id=p_billing_account_id and period_start=month_start and period_end=month_end for update;
  if found and period_status not in ('draft','review') then raise exception 'billing_period_is_not_refreshable'; end if;
  if period_id is null then
    insert into public.billing_periods(school_id,billing_account_id,period_start,period_end,label,currency,status,created_by)
    values(p_school_id,p_billing_account_id,month_start,month_end,to_char(month_start,'FMMonth YYYY'),school_currency,'draft',actor_id) returning id into period_id;
  elsif period_status='review' then update public.billing_periods set status='draft' where id=period_id; end if;
  delete from public.billing_line_items where billing_period_id=period_id and source_type in ('lesson','lesson_series');

  for series_row in
    select series.id lesson_series_id,series.starts_on,series.ends_on,term.id billing_terms_id,term.amount_cents,term.currency,term.offering_name,term.effective_from,term.effective_until,term.billing_timing
    from public.lesson_series series join public.billing_account_students mapping on mapping.school_id=series.school_id and mapping.student_id=series.student_id and mapping.billing_account_id=p_billing_account_id
    join public.lesson_series_billing_terms term on term.school_id=series.school_id and term.lesson_series_id=series.id and term.billing_mode='fixed_monthly' and term.effective_from<=month_start and (term.effective_until is null or term.effective_until>=month_start)
    where series.school_id=p_school_id and series.status in ('active','paused','ended') and series.starts_on<=month_end and (series.ends_on is null or series.ends_on>=month_start)
  loop
    if series_row.currency<>school_currency then raise exception 'mixed_billing_currency'; end if;
    if series_row.billing_timing='after_service' and month_end>=local_today then raise exception 'after_service_period_is_not_complete'; end if;
    if series_row.starts_on>month_start or (series_row.ends_on is not null and series_row.ends_on<month_end) or (series_row.effective_until is not null and series_row.effective_until<month_end) then raise exception 'fixed_monthly_partial_period_requires_owner_review'; end if;
    if exists(select 1 from public.lesson_series_billing_terms t where t.school_id=p_school_id and t.lesson_series_id=series_row.lesson_series_id and t.id<>series_row.billing_terms_id and t.effective_from<=month_end and (t.effective_until is null or t.effective_until>=month_start)) then raise exception 'fixed_monthly_terms_change_inside_period'; end if;
    insert into public.billing_line_items(school_id,billing_period_id,source_type,source_id,description,service_date,unit_amount_cents,metadata,created_by,billing_terms_id)
    values(p_school_id,period_id,'lesson_series',series_row.lesson_series_id,series_row.offering_name||' · monthly tuition',month_start,series_row.amount_cents,
      jsonb_build_object('billing_mode','fixed_monthly','billing_timing',series_row.billing_timing,'disposition','charge'),actor_id,series_row.billing_terms_id);
  end loop;

  for event_row in
    select event.id lesson_event_id,event.starts_at operational_starts_at,event.status,event.lesson_series_id,snapshot.id snapshot_id,snapshot.series_billing_terms_id,
      snapshot.billing_mode,snapshot.billing_timing,snapshot.amount_cents,snapshot.currency,snapshot.offering_name,snapshot.billing_service_date service_date
    from public.lesson_events event join public.billing_account_students mapping on mapping.school_id=event.school_id and mapping.student_id=event.student_id and mapping.billing_account_id=p_billing_account_id
    join public.lesson_event_price_snapshots snapshot on snapshot.school_id=event.school_id and snapshot.lesson_event_id=event.id
    where event.school_id=p_school_id and snapshot.billing_service_date between month_start and month_end order by snapshot.billing_service_date,event.starts_at,event.id
  loop
    if event_row.currency<>school_currency then raise exception 'mixed_billing_currency'; end if;
    result:=public.compute_lesson_event_billing_disposition(p_school_id,event_row.lesson_event_id,now());
    if event_row.billing_timing='before_service' and event_row.status='scheduled' then disposition:='charge'; reason_code:='scheduled_obligation';
    elsif result->>'state'='not_ready' then raise exception 'after_service_period_is_not_complete:%',event_row.lesson_event_id;
    else disposition:=result->>'disposition'; reason_code:=result->>'reason_code'; end if;
    if disposition='owner_review' or disposition is null then raise exception 'lesson_requires_owner_review:%:%',event_row.lesson_event_id,reason_code; end if;
    select id,amount_cents,succeeded_at into separate_payment from public.lesson_payment_requests
      where school_id=p_school_id and billing_account_id=p_billing_account_id and lesson_event_id=event_row.lesson_event_id and status='succeeded';
    if event_row.billing_mode='fixed_monthly' then
      if event_row.series_billing_terms_id is null or event_row.lesson_series_id is null then raise exception 'fixed_monthly_lesson_missing_series_terms'; end if;
      if disposition='credit' then raise exception 'fixed_monthly_credit_requires_owner_review:%',event_row.lesson_event_id; end if;
      line_amount:=0;
    elsif separate_payment.id is not null then line_amount:=0; disposition:='paid_separately'; reason_code:='quick_payment_succeeded';
    elsif disposition='charge' then line_amount:=event_row.amount_cents; else line_amount:=0; end if;
    insert into public.billing_line_items(school_id,billing_period_id,source_type,source_id,description,service_date,unit_amount_cents,metadata,created_by,billing_terms_id,lesson_event_price_snapshot_id)
    values(p_school_id,period_id,'lesson',event_row.lesson_event_id,event_row.offering_name||' · '||to_char(event_row.service_date,'Mon FMDD'),event_row.service_date,line_amount,
      jsonb_build_object('billing_mode',event_row.billing_mode,'billing_timing',event_row.billing_timing,'disposition',disposition,'reason_code',reason_code,
        'policy_version_id',result->>'policy_version_id','policy_disposition',result->>'policy_disposition','listed_amount_cents',event_row.amount_cents,
        'operational_starts_at',event_row.operational_starts_at,'paid_separately_amount_cents',case when separate_payment.id is null then null else separate_payment.amount_cents end,
        'lesson_payment_request_id',separate_payment.id,'paid_separately_at',separate_payment.succeeded_at),actor_id,event_row.series_billing_terms_id,event_row.snapshot_id);
  end loop;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'billing_period.draft_prepared','billing_period',period_id,jsonb_build_object('period_start',month_start,'period_end',month_end));
  return period_id;
end; $$;
revoke all on function public.prepare_family_billing_draft(uuid,uuid,date) from public,anon;
grant execute on function public.prepare_family_billing_draft(uuid,uuid,date) to authenticated;
