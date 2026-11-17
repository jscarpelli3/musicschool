-- Offerings may remain local to Common Time while invoices retain an explicit
-- collection choice. Historical invoice lines snapshot the catalog state that
-- existed when the invoice was locked.

alter table public.service_products
  drop constraint service_products_stripe_sync_status_check;
alter table public.service_products
  add constraint service_products_stripe_sync_status_check
  check (stripe_sync_status in ('legacy_unsynced','local_only','synced','reconciliation_required'));

alter table public.stripe_catalog_operations
  drop constraint stripe_catalog_operations_operation_check;
alter table public.stripe_catalog_operations
  add constraint stripe_catalog_operations_operation_check
  check (operation in ('create_offering','archive_offering','replace_price','sync_offering','unsync_offering'));

alter table public.billing_periods
  add column collection_method text not null default 'stripe_or_outside'
  check (collection_method in ('stripe_or_outside','outside_only'));

comment on column public.service_products.stripe_sync_status is
  'local_only intentionally stays out of the Stripe catalog; synced has an active provider catalog binding.';
comment on column public.billing_periods.collection_method is
  'stripe_or_outside permits Stripe or external settlement; outside_only affirmatively blocks Stripe collection.';

create or replace function public.set_invoice_collection_method(
  p_school_id uuid,
  p_billing_period_id uuid,
  p_collection_method text
) returns void
language plpgsql security invoker set search_path = public
as $$
declare actor uuid := auth.uid(); period_row public.billing_periods%rowtype;
begin
  if actor is null or not public.has_school_capability(p_school_id,'school.billing.manage') then
    raise exception 'not_authorized';
  end if;
  if p_collection_method not in ('stripe_or_outside','outside_only') then raise exception 'invalid_collection_method'; end if;
  select * into period_row from public.billing_periods
    where school_id=p_school_id and id=p_billing_period_id for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if period_row.status not in ('draft','review') then raise exception 'invoice_is_not_editable'; end if;
  update public.billing_periods set collection_method=p_collection_method where id=period_row.id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor,'billing_period.collection_method_changed','billing_period',period_row.id,
    jsonb_build_object('from',period_row.collection_method,'to',p_collection_method));
end;$$;
revoke all on function public.set_invoice_collection_method(uuid,uuid,text) from public,anon;
grant execute on function public.set_invoice_collection_method(uuid,uuid,text) to authenticated;

create or replace function public.snapshot_invoice_catalog_state()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.status='locked' and old.status in ('draft','review') then
    update public.billing_line_items line
    set metadata = line.metadata || jsonb_build_object(
      'offering_catalog_state_at_lock', coalesce(product.stripe_sync_status,'not_applicable'),
      'offering_id_at_lock', product.id
    )
    from public.lesson_events event
    left join public.service_products product
      on product.school_id=event.school_id and product.id=event.product_id
    where line.school_id=new.school_id and line.billing_period_id=new.id
      and line.source_type='lesson' and line.source_id=event.id;

    update public.billing_line_items line
    set metadata = line.metadata || jsonb_build_object(
      'offering_catalog_state_at_lock', coalesce(product.stripe_sync_status,'not_applicable'),
      'offering_id_at_lock', product.id
    )
    from public.lesson_series series
    left join public.service_products product
      on product.school_id=series.school_id and product.id=series.product_id
    where line.school_id=new.school_id and line.billing_period_id=new.id
      and line.source_type='lesson_series' and line.source_id=series.id;
  end if;
  return new;
end;$$;
revoke all on function public.snapshot_invoice_catalog_state() from public,anon,authenticated;
create trigger billing_periods_snapshot_catalog_state
  before update of status on public.billing_periods
  for each row execute function public.snapshot_invoice_catalog_state();

drop function public.get_billing_approval(text);
create function public.get_billing_approval(raw_token text)
returns table (
  school_name text,billing_account_name text,student_names text[],period_label text,
  period_start date,period_end date,line_items jsonb,amount_cents integer,currency text,
  approval_status text,payment_status text,collection_action text,expires_at timestamptz,
  approved_at timestamptz,has_newer_request boolean,collection_method text
)
language sql security definer set search_path='' stable
as $$
  select school.name,account.name,coalesce((
    select array_agg(trim(coalesce(nullif(person.preferred_name,''),person.first_name)||' '||person.last_name) order by person.last_name,person.first_name)
    from public.billing_account_students link join public.people person on person.id=link.student_id and person.school_id=link.school_id
    where link.school_id=request.school_id and link.billing_account_id=request.billing_account_id
  ),array[]::text[]),request.period_label,period.period_start,period.period_end,request.line_items,
  request.amount_cents,request.currency,
  case when request.approval_status='pending' and request.expires_at<=now() then 'expired' else request.approval_status end,
  request.payment_status,request.collection_action,request.expires_at,request.approved_at,
  exists(select 1 from public.billing_approval_requests newer where newer.billing_period_id=request.billing_period_id and newer.request_version>request.request_version),
  coalesce(period.collection_method,'stripe_or_outside')
  from public.billing_approval_requests request
  join public.schools school on school.id=request.school_id
  join public.billing_accounts account on account.id=request.billing_account_id
  left join public.billing_periods period on period.id=request.billing_period_id
  where request.token_hash=encode(extensions.digest(raw_token,'sha256'),'hex') limit 1;
$$;
revoke all on function public.get_billing_approval(text) from public,anon,authenticated;
grant execute on function public.get_billing_approval(text) to service_role;

