drop function public.get_billing_approval(text);

create function public.get_billing_approval(raw_token text)
returns table (
  school_name text,
  billing_account_name text,
  student_names text[],
  period_label text,
  period_start date,
  period_end date,
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
    coalesce((
      select array_agg(
        trim(coalesce(nullif(person.preferred_name, ''), person.first_name) || ' ' || person.last_name)
        order by person.last_name, person.first_name
      )
      from public.billing_account_students link
      join public.people person on person.id = link.student_id and person.school_id = link.school_id
      where link.school_id = request.school_id
        and link.billing_account_id = request.billing_account_id
    ), array[]::text[]),
    request.period_label,
    period.period_start,
    period.period_end,
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
  left join public.billing_periods period on period.id = request.billing_period_id
  where request.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  limit 1;
$$;

revoke all on function public.get_billing_approval(text) from public, anon, authenticated;
grant execute on function public.get_billing_approval(text) to service_role;

comment on function public.get_billing_approval(text) is
  'Returns the exact immutable proposal addressed by the token, its display context, and whether a later version exists; it never reveals a replacement token.';
