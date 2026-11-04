create function public.create_empty_family_billing_draft(
  p_school_id uuid,p_billing_account_id uuid,p_month date
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid(); month_start date:=date_trunc('month',p_month)::date;
  month_end date:=(date_trunc('month',p_month)+interval '1 month - 1 day')::date;
  school_currency text; period_id uuid; invoice_number integer;
begin
  if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized'; end if;
  if p_month<>month_start then raise exception 'billing_month_must_be_first_day'; end if;
  select currency into school_currency from public.schools where id=p_school_id;
  if school_currency is null then raise exception 'school_not_found'; end if;
  if not exists(select 1 from public.billing_accounts where school_id=p_school_id and id=p_billing_account_id and status='active') then raise exception 'active_billing_account_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_billing_account_id::text||':'||month_start::text,0));
  select id into period_id from public.billing_periods
  where school_id=p_school_id and billing_account_id=p_billing_account_id
    and period_start=month_start and period_end=month_end and status in('draft','review')
  order by created_at desc limit 1 for update;
  if period_id is not null then raise exception 'editable_invoice_already_exists'; end if;

  select count(*)+1 into invoice_number from public.billing_periods
  where billing_account_id=p_billing_account_id and period_start=month_start and period_end=month_end;
  insert into public.billing_periods(school_id,billing_account_id,period_start,period_end,label,currency,status,created_by)
  values(p_school_id,p_billing_account_id,month_start,month_end,
    to_char(month_start,'FMMonth YYYY')||case when invoice_number>1 then ' · Invoice '||invoice_number else '' end,
    school_currency,'draft',actor_id)
  returning id into period_id;

  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'billing_period.empty_draft_created','billing_period',period_id,
    jsonb_build_object('period_start',month_start,'period_end',month_end));
  return period_id;
end; $$;

revoke all on function public.create_empty_family_billing_draft(uuid,uuid,date) from public,anon;
grant execute on function public.create_empty_family_billing_draft(uuid,uuid,date) to authenticated;

comment on function public.create_empty_family_billing_draft(uuid,uuid,date) is
  'Creates an explicitly empty editable invoice without auto-populating eligible lessons. It never clears an existing draft.';

do $$
begin
  if has_function_privilege('anon','public.create_empty_family_billing_draft(uuid,uuid,date)','EXECUTE')
    or not has_function_privilege('authenticated','public.create_empty_family_billing_draft(uuid,uuid,date)','EXECUTE')
    or position('editable_invoice_already_exists' in pg_get_functiondef('public.create_empty_family_billing_draft(uuid,uuid,date)'::regprocedure))=0
  then raise exception 'empty_invoice_draft_contract_incorrect'; end if;
end $$;
