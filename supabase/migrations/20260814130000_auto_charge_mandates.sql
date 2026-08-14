create table public.billing_collection_mandates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  payment_method_id uuid not null,
  mandate_type text not null default 'automatic_charge' check (mandate_type = 'automatic_charge'),
  status text not null default 'active' check (status in ('active','revoked','superseded')),
  monthly_cap_cents bigint check (monthly_cap_cents is null or monthly_cap_cents > 0),
  advance_notice_days smallint not null check (advance_notice_days between 1 and 14),
  scope text not null default 'itemized_school_charges' check (scope = 'itemized_school_charges'),
  terms_version text not null,
  terms_text text not null,
  terms_sha256 text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
  channel text not null check (channel in ('approval_link','payer_portal')),
  source_approval_request_id uuid not null,
  evidence jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null,
  revoked_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete restrict,
  foreign key (school_id, payment_method_id, billing_account_id)
    references public.billing_payment_methods(school_id, id, billing_account_id) on delete restrict,
  foreign key (school_id, source_approval_request_id)
    references public.billing_approval_requests(school_id, id) on delete restrict,
  check ((status = 'active' and revoked_at is null and superseded_at is null)
    or (status = 'revoked' and revoked_at is not null)
    or (status = 'superseded' and superseded_at is not null))
);

create unique index billing_collection_mandates_one_active_idx
  on public.billing_collection_mandates(billing_account_id) where status = 'active';
create trigger billing_collection_mandates_set_updated_at before update on public.billing_collection_mandates
for each row execute function public.set_updated_at();

create table public.billing_collection_mandate_events (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete restrict,
  mandate_id uuid not null,
  event_type text not null check (event_type in ('accepted','revoked','superseded')),
  channel text not null,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (school_id, mandate_id)
    references public.billing_collection_mandates(school_id, id) on delete restrict
);

alter table public.billing_collection_mandates enable row level security;
alter table public.billing_collection_mandate_events enable row level security;
create policy billing_collection_mandates_admin_select on public.billing_collection_mandates for select to authenticated
using (public.has_school_role(school_id, array['owner','admin']));
create policy billing_collection_mandate_events_admin_select on public.billing_collection_mandate_events for select to authenticated
using (public.has_school_role(school_id, array['owner','admin']));
grant select on public.billing_collection_mandates, public.billing_collection_mandate_events to authenticated;

create or replace function public.get_auto_charge_enrollment(raw_token text)
returns table (
  eligible boolean,
  reason text,
  school_name text,
  billing_account_name text,
  payment_method_label text,
  payment_method_last_four text,
  current_amount_cents bigint,
  currency text,
  active_mandate_id uuid,
  monthly_cap_cents bigint,
  advance_notice_days smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  with request as (
    select approval.*, school.name as school_name, account.name as account_name
    from public.billing_approval_requests approval
    join public.schools school on school.id = approval.school_id
    join public.billing_accounts account on account.id = approval.billing_account_id
    where approval.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
      and approval.approval_status = 'approved' and approval.expires_at > now()
    limit 1
  ), method as (
    select payment.* from public.billing_payment_methods payment join request
      on request.school_id = payment.school_id and request.billing_account_id = payment.billing_account_id
    where payment.status = 'active' and payment.is_default and exists (
      select 1 from public.payment_method_consents consent
      where consent.school_id = payment.school_id and consent.billing_account_id = payment.billing_account_id
        and consent.payment_method_id = payment.id and consent.usage_scope = 'off_session' and consent.revoked_at is null
    ) limit 1
  ), mandate as (
    select active.* from public.billing_collection_mandates active join request
      on request.school_id = active.school_id and request.billing_account_id = active.billing_account_id
    where active.status = 'active' limit 1
  )
  select method.id is not null,
    case when method.id is null then 'active_saved_method_required' else null end,
    request.school_name, request.account_name, method.display_label, method.last_four,
    request.amount_cents, request.currency, mandate.id, mandate.monthly_cap_cents, mandate.advance_notice_days
  from request left join method on true left join mandate on true;
$$;

create or replace function public.enroll_auto_charge_mandate(
  raw_token text,
  p_monthly_cap_cents bigint,
  p_advance_notice_days smallint,
  p_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row record;
  method public.billing_payment_methods%rowtype;
  prior_id uuid;
  mandate_id uuid;
  terms text;
  terms_version constant text := 'automatic-monthly-itemized-v1';
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  select approval.*, school.name as school_name, account.name as account_name into request_row
  from public.billing_approval_requests approval
  join public.schools school on school.id = approval.school_id
  join public.billing_accounts account on account.id = approval.billing_account_id
  where approval.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex') for update of approval;
  if not found then raise exception 'approval_request_not_found'; end if;
  if request_row.approval_status <> 'approved' or request_row.expires_at <= now() then raise exception 'approved_current_link_required'; end if;
  if p_advance_notice_days not between 1 and 14 then raise exception 'invalid_notice_days'; end if;
  if p_monthly_cap_cents is not null and p_monthly_cap_cents < request_row.amount_cents then raise exception 'cap_below_current_amount'; end if;

  select payment.* into method from public.billing_payment_methods payment
  where payment.school_id = request_row.school_id and payment.billing_account_id = request_row.billing_account_id
    and payment.status = 'active' and payment.is_default and exists (
      select 1 from public.payment_method_consents consent
      where consent.school_id = payment.school_id and consent.billing_account_id = payment.billing_account_id
        and consent.payment_method_id = payment.id and consent.usage_scope = 'off_session' and consent.revoked_at is null
    ) for update;
  if not found then raise exception 'active_saved_method_required'; end if;

  terms := 'I authorize ' || request_row.school_name || ' to automatically charge the saved payment method ending in ' || coalesce(method.last_four, 'the displayed digits')
    || ' for itemized monthly school charges on ' || request_row.account_name || '. I will receive the itemized statement at least '
    || p_advance_notice_days || ' day(s) before collection. '
    || case when p_monthly_cap_cents is null then 'I have not set a monthly maximum.'
      else 'The total automatic charge may not exceed ' || to_char(p_monthly_cap_cents / 100.0, 'FM999999990.00') || ' ' || upper(request_row.currency) || ' per month.' end
    || ' I can revoke this authorization for future charges.';

  select id into prior_id from public.billing_collection_mandates
  where billing_account_id = request_row.billing_account_id and status = 'active' for update;
  if prior_id is not null then
    update public.billing_collection_mandates set status = 'superseded', superseded_at = now() where id = prior_id;
    insert into public.billing_collection_mandate_events (school_id, mandate_id, event_type, channel, evidence)
    values (request_row.school_id, prior_id, 'superseded', 'approval_link', jsonb_build_object('source_approval_request_id', request_row.id));
  end if;

  insert into public.billing_collection_mandates (
    school_id, billing_account_id, payment_method_id, monthly_cap_cents, advance_notice_days,
    terms_version, terms_text, terms_sha256, channel, source_approval_request_id, evidence, accepted_at
  ) values (
    request_row.school_id, request_row.billing_account_id, method.id, p_monthly_cap_cents, p_advance_notice_days,
    terms_version, terms, encode(extensions.digest(terms, 'sha256'), 'hex'), 'approval_link', request_row.id,
    coalesce(p_evidence, '{}'::jsonb) || jsonb_build_object('payment_method_last_four', method.last_four), now()
  ) returning id into mandate_id;
  insert into public.billing_collection_mandate_events (school_id, mandate_id, event_type, channel, evidence)
  values (request_row.school_id, mandate_id, 'accepted', 'approval_link', jsonb_build_object(
    'terms_version', terms_version, 'terms_sha256', encode(extensions.digest(terms, 'sha256'), 'hex'),
    'monthly_cap_cents', p_monthly_cap_cents, 'advance_notice_days', p_advance_notice_days
  ));
  return mandate_id;
end;
$$;

revoke all on function public.get_auto_charge_enrollment(text) from public;
grant execute on function public.get_auto_charge_enrollment(text) to anon, authenticated;
revoke all on function public.enroll_auto_charge_mandate(text,bigint,smallint,jsonb) from public, anon, authenticated;
grant execute on function public.enroll_auto_charge_mandate(text,bigint,smallint,jsonb) to service_role;

comment on table public.billing_collection_mandates is
  'Payer-held standing collection authorization, separate from saved-method consent and exact per-period approval.';
