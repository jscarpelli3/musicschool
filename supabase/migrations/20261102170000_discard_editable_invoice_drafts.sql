create function public.discard_editable_billing_period(
  p_school_id uuid,
  p_billing_account_id uuid,
  p_billing_period_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  period_status text;
begin
  if actor_id is null or not public.has_school_capability(p_school_id, 'school.billing.manage') then
    raise exception 'not_authorized';
  end if;

  select status into period_status
  from public.billing_periods
  where id = p_billing_period_id
    and school_id = p_school_id
    and billing_account_id = p_billing_account_id
  for update;

  if period_status is null then raise exception 'billing_period_not_found'; end if;
  if period_status not in ('draft', 'review') then raise exception 'invoice_is_not_editable'; end if;

  update public.billing_periods
  set status = 'void'
  where id = p_billing_period_id;

  insert into public.audit_log(school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    p_school_id,
    actor_id,
    'billing_period.draft_discarded',
    'billing_period',
    p_billing_period_id,
    jsonb_build_object('previous_status', period_status)
  );
end;
$$;

revoke all on function public.discard_editable_billing_period(uuid, uuid, uuid) from public, anon;
grant execute on function public.discard_editable_billing_period(uuid, uuid, uuid) to authenticated;

comment on function public.discard_editable_billing_period(uuid, uuid, uuid) is
  'Voids an editable invoice draft and releases its invoice allocations through the billing-period status triggers.';

do $$
begin
  if has_function_privilege('anon', 'public.discard_editable_billing_period(uuid,uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.discard_editable_billing_period(uuid,uuid,uuid)', 'EXECUTE')
  then
    raise exception 'discard_editable_billing_period_privileges_incorrect';
  end if;
end
$$;
