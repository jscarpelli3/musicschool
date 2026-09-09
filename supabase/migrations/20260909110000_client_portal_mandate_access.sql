create or replace function public.get_client_portal_collection_accounts()
returns table (
  school_id uuid,
  school_name text,
  billing_account_id uuid,
  billing_account_name text,
  currency text,
  payment_method_label text,
  payment_method_last_four text,
  mandate_id uuid,
  mandate_status text,
  monthly_cap_cents bigint,
  advance_notice_days smallint,
  accepted_at timestamptz
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
    account.school_id,
    school.name,
    account.id,
    account.name,
    approval.currency,
    payment.display_label,
    payment.last_four,
    mandate.id,
    mandate.status,
    mandate.monthly_cap_cents,
    mandate.advance_notice_days,
    mandate.accepted_at
  from identity
  join public.payer_portal_authorizations portal_auth
    on portal_auth.normalized_email=identity.email
  join public.billing_accounts account
    on account.school_id=portal_auth.school_id
    and account.id=portal_auth.billing_account_id
    and account.status='active'
  join public.schools school on school.id=account.school_id
  left join public.billing_collection_mandates mandate
    on mandate.school_id=account.school_id
    and mandate.billing_account_id=account.id
    and mandate.status='active'
  left join public.billing_approval_requests approval
    on approval.school_id=mandate.school_id
    and approval.id=mandate.source_approval_request_id
  left join public.billing_payment_methods payment
    on payment.school_id=mandate.school_id
    and payment.id=mandate.payment_method_id
    and payment.billing_account_id=mandate.billing_account_id
  order by school.name,account.name;
$$;

create or replace function public.revoke_client_portal_auto_charge_mandate(
  p_school_id uuid,
  p_billing_account_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mandate_row public.billing_collection_mandates%rowtype;
  actor_email text := lower(nullif(trim(auth.jwt()->>'email'),''));
begin
  if auth.role()<>'authenticated'
    or public.current_client_portal_access_state()<>'ready'
    or not exists (
      select 1
      from public.payer_portal_authorizations portal_auth
      join public.billing_accounts account
        on account.school_id=portal_auth.school_id
        and account.id=portal_auth.billing_account_id
        and account.status='active'
      where portal_auth.school_id=p_school_id
        and portal_auth.billing_account_id=p_billing_account_id
        and portal_auth.normalized_email=actor_email
    )
  then
    raise exception 'not_authorized';
  end if;

  select mandate.* into mandate_row
  from public.billing_collection_mandates mandate
  where mandate.school_id=p_school_id
    and mandate.billing_account_id=p_billing_account_id
    and mandate.status='active'
  for update;

  if not found then return 'already_inactive'; end if;

  update public.billing_collection_mandates
  set status='revoked',
      revoked_at=now(),
      evidence=evidence || jsonb_build_object(
        'revocation',jsonb_build_object('channel','payer_portal','actor_user_id',auth.uid())
      )
  where id=mandate_row.id;

  insert into public.billing_collection_mandate_events (
    school_id,mandate_id,event_type,channel,evidence
  ) values (
    mandate_row.school_id,
    mandate_row.id,
    'revoked',
    'payer_portal',
    jsonb_build_object('actor_user_id',auth.uid())
  );

  return 'revoked';
end;
$$;

revoke all on function public.get_client_portal_collection_accounts() from public,anon;
grant execute on function public.get_client_portal_collection_accounts() to authenticated;
revoke all on function public.revoke_client_portal_auto_charge_mandate(uuid,uuid) from public,anon;
grant execute on function public.revoke_client_portal_auto_charge_mandate(uuid,uuid) to authenticated;

comment on function public.get_client_portal_collection_accounts() is
  'Returns collection preferences only for billing accounts authorized to the current authenticated payer email.';
comment on function public.revoke_client_portal_auto_charge_mandate(uuid,uuid) is
  'Immediately revokes an active mandate through durable authenticated payer-portal authority.';
