create or replace function public.get_client_portal_statements()
returns table (
  school_id uuid,
  school_name text,
  billing_account_id uuid,
  billing_account_name text,
  billing_period_id uuid,
  period_label text,
  period_start date,
  period_end date,
  amount_due_cents bigint,
  currency text,
  period_status text,
  approval_status text,
  payment_status text,
  line_items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with identity as (
    select lower(nullif(trim(auth.jwt()->>'email'),'')) as email
    where auth.role()='authenticated'
      and public.current_client_portal_access_state()='ready'
  )
  select
    period.school_id,
    school.name,
    period.billing_account_id,
    account.name,
    period.id,
    period.label,
    period.period_start,
    period.period_end,
    period.amount_due_cents,
    period.currency,
    period.status,
    approval.approval_status,
    approval.payment_status,
    coalesce(items.value, '[]'::jsonb)
  from identity
  join public.payer_portal_authorizations portal_auth
    on portal_auth.normalized_email=identity.email
  join public.billing_accounts account
    on account.school_id=portal_auth.school_id
    and account.id=portal_auth.billing_account_id
    and account.status='active'
  join public.schools school on school.id=account.school_id
  join public.billing_periods period
    on period.school_id=account.school_id
    and period.billing_account_id=account.id
    and period.status in ('approval_pending','approved','collecting','paid','payment_failed')
  left join lateral (
    select request.approval_status,request.payment_status
    from public.billing_approval_requests request
    where request.school_id=period.school_id
      and request.billing_account_id=period.billing_account_id
      and request.billing_period_id=period.id
    order by request.request_version desc,request.created_at desc
    limit 1
  ) approval on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'description',item.description,
        'service_date',item.service_date,
        'quantity',item.quantity,
        'unit_amount_cents',item.unit_amount_cents,
        'amount_cents',item.amount_cents
      ) order by item.service_date nulls last,item.created_at,item.id
    ) as value
    from public.billing_line_items item
    where item.school_id=period.school_id
      and item.billing_period_id=period.id
  ) items on true
  order by period.period_start desc,school.name,account.name;
$$;

revoke all on function public.get_client_portal_statements() from public,anon;
grant execute on function public.get_client_portal_statements() to authenticated;

comment on function public.get_client_portal_statements() is
  'Returns itemized sent, approved, collecting, paid, or failed statements only for billing accounts authorized to the current verified payer email.';
