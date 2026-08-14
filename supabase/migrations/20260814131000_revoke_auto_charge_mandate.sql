create or replace function public.revoke_auto_charge_mandate(
  raw_token text,
  p_evidence jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row record;
  mandate_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  select approval.school_id, approval.billing_account_id into request_row
  from public.billing_approval_requests approval
  where approval.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex');
  if not found then return 'not_found'; end if;

  select id into mandate_id from public.billing_collection_mandates
  where school_id = request_row.school_id and billing_account_id = request_row.billing_account_id
    and status = 'active' for update;
  if not found then return 'already_inactive'; end if;

  update public.billing_collection_mandates
  set status = 'revoked', revoked_at = now(), evidence = evidence || jsonb_build_object('revocation', coalesce(p_evidence, '{}'::jsonb))
  where id = mandate_id;
  insert into public.billing_collection_mandate_events (school_id, mandate_id, event_type, channel, evidence)
  values (request_row.school_id, mandate_id, 'revoked', 'approval_link', coalesce(p_evidence, '{}'::jsonb));
  return 'revoked';
end;
$$;

revoke all on function public.revoke_auto_charge_mandate(text,jsonb) from public, anon, authenticated;
grant execute on function public.revoke_auto_charge_mandate(text,jsonb) to service_role;

comment on function public.revoke_auto_charge_mandate(text,jsonb) is
  'Immediately revokes a standing mandate through a school/account-bound bearer link; no provider call is required.';
