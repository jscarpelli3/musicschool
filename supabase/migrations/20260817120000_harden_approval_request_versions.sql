-- Request generation already serializes by period. These constraints make the
-- version and single-pending guarantees independent of any one code path.

create unique index billing_approval_requests_period_version_unique
  on public.billing_approval_requests(billing_period_id, request_version)
  where billing_period_id is not null;

create unique index billing_approval_requests_one_pending_per_period
  on public.billing_approval_requests(billing_period_id)
  where billing_period_id is not null and approval_status = 'pending';

drop function public.get_billing_approval(text);
create function public.get_billing_approval(raw_token text)
returns table (
  school_name text,
  billing_account_name text,
  period_label text,
  line_items jsonb,
  amount_cents integer,
  currency text,
  approval_status text,
  payment_status text,
  collection_action text,
  expires_at timestamptz,
  approved_at timestamptz,
  has_newer_request boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    school.name,
    account.name,
    request.period_label,
    request.line_items,
    request.amount_cents,
    request.currency,
    case when request.approval_status = 'pending' and request.expires_at <= now()
      then 'expired' else request.approval_status end,
    request.payment_status,
    request.collection_action,
    request.expires_at,
    request.approved_at,
    exists (
      select 1 from public.billing_approval_requests newer
      where newer.billing_period_id = request.billing_period_id
        and newer.request_version > request.request_version
    )
  from public.billing_approval_requests request
  join public.schools school on school.id = request.school_id
  join public.billing_accounts account on account.id = request.billing_account_id
  where request.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  limit 1;
$$;

revoke all on function public.get_billing_approval(text) from public;
grant execute on function public.get_billing_approval(text) to anon, authenticated;

comment on function public.get_billing_approval(text) is
  'Returns only the exact immutable proposal addressed by the token plus whether a later version exists; it never reveals a replacement token.';

