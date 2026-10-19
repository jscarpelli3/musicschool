-- Keep the full draft population contract isolated, then refuse to persist an
-- invoice when it produced no lines. Raising rolls the population transaction
-- back, including creation of the otherwise-empty billing period.

alter function public.prepare_family_billing_draft(uuid,uuid,date)
  rename to prepare_family_billing_draft_populate;

revoke all on function public.prepare_family_billing_draft_populate(uuid,uuid,date) from public,anon,authenticated;

create function public.prepare_family_billing_draft(
  p_school_id uuid,p_billing_account_id uuid,p_month date
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); period_id uuid;
begin
  if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized'; end if;
  period_id:=public.prepare_family_billing_draft_populate(p_school_id,p_billing_account_id,p_month);
  if not exists(select 1 from public.billing_line_items where billing_period_id=period_id) then
    raise exception 'no_unbilled_items_for_month';
  end if;
  return period_id;
end; $$;

revoke all on function public.prepare_family_billing_draft(uuid,uuid,date) from public,anon;
grant execute on function public.prepare_family_billing_draft(uuid,uuid,date) to authenticated;

-- Remove only the exact synthetic staging artifact reported during acceptance.
-- Production and unrelated environments have no matching identity; all guards
-- must match before deletion can occur.
do $$
declare target_id constant uuid:='838e19e5-7aae-4d3b-9994-b8b7e075235d';
begin
  if exists(
    select 1 from public.billing_periods period
    where period.id=target_id
      and period.school_id='fc760892-4b3a-4602-9931-0715c2a033fc'
      and period.billing_account_id='fa7602df-dcaa-46fa-9af4-fcc68b97e50e'
      and period.period_start='2026-11-01' and period.period_end='2026-11-30'
      and period.status='draft' and period.amount_due_cents=0
      and not exists(select 1 from public.billing_line_items item where item.billing_period_id=period.id)
  ) then
    delete from public.billing_periods where id=target_id;
  end if;
end $$;

do $$
declare definition text:=pg_get_functiondef('public.prepare_family_billing_draft(uuid,uuid,date)'::regprocedure);
begin
  if definition not ilike '%no_unbilled_items_for_month%'
    or has_function_privilege('anon','public.prepare_family_billing_draft(uuid,uuid,date)','EXECUTE')
    or not has_function_privilege('authenticated','public.prepare_family_billing_draft(uuid,uuid,date)','EXECUTE')
  then raise exception 'empty_invoice_refusal_contract_incorrect'; end if;
end $$;
