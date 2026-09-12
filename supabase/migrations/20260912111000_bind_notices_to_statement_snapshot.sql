create function public.billing_statement_fingerprint(p_billing_period_id uuid)
returns text language sql stable security definer set search_path=''
as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'period_id',period.id,'period_start',period.period_start,'period_end',period.period_end,
    'currency',period.currency,'amount_due_cents',period.amount_due_cents,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',item.id,'source_type',item.source_type,'source_id',item.source_id,
      'description',item.description,'service_date',item.service_date,'quantity',item.quantity,
      'unit_amount_cents',item.unit_amount_cents,'amount_cents',item.amount_cents,
      'charge_category_code',item.charge_category_code,'metadata',item.metadata
    ) order by item.id) from public.billing_line_items item where item.billing_period_id=period.id),'[]'::jsonb)
  )::text,'UTF8'),'sha256'),'hex')
  from public.billing_periods period where period.id=p_billing_period_id
$$;
revoke all on function public.billing_statement_fingerprint(uuid) from public,anon,authenticated;
grant execute on function public.billing_statement_fingerprint(uuid) to service_role;

alter table public.billing_statement_notice_deliveries add column statement_sha256 text;
update public.billing_statement_notice_deliveries notice
set statement_sha256=public.billing_statement_fingerprint(notice.billing_period_id);
alter table public.billing_statement_notice_deliveries alter column statement_sha256 set not null;
alter table public.billing_statement_notice_deliveries add constraint billing_statement_notice_statement_hash_check
check(statement_sha256~'^[0-9a-f]{64}$');

create function public.assign_billing_statement_notice_fingerprint()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.statement_sha256:=public.billing_statement_fingerprint(new.billing_period_id);
  if new.statement_sha256 is null then raise exception 'billing_statement_snapshot_required'; end if;
  return new;
end;
$$;
create trigger billing_statement_notice_assign_fingerprint before insert on public.billing_statement_notice_deliveries
for each row execute function public.assign_billing_statement_notice_fingerprint();
revoke all on function public.assign_billing_statement_notice_fingerprint() from public,anon,authenticated;

create or replace function public.get_billing_collection_readiness(p_school_id uuid,p_billing_period_id uuid)
returns table(readiness text,authorization_source text,reason text,mandate_id uuid,
  approval_request_id uuid,amount_cents bigint,currency text,monthly_cap_cents bigint,
  advance_notice_days smallint,uncovered_categories text[])
language plpgsql stable security definer set search_path='' as $$
declare base record; notice_row public.billing_statement_notice_deliveries%rowtype; current_fingerprint text;
begin
  select * into base from public.get_billing_collection_readiness_before_notice(p_school_id,p_billing_period_id);
  if base.readiness is distinct from 'notice_required' then
    return query select base.readiness,base.authorization_source,base.reason,base.mandate_id,
      base.approval_request_id,base.amount_cents,base.currency,base.monthly_cap_cents,
      base.advance_notice_days,base.uncovered_categories; return;
  end if;
  current_fingerprint:=public.billing_statement_fingerprint(p_billing_period_id);
  select * into notice_row from public.billing_statement_notice_deliveries notice
  where notice.school_id=p_school_id and notice.billing_period_id=p_billing_period_id
    and notice.mandate_id=base.mandate_id and notice.amount_cents=base.amount_cents
    and notice.currency=base.currency and notice.notice_days=base.advance_notice_days
    and notice.statement_sha256=current_fingerprint
    and notice.charge_categories=(select array_agg(distinct item.charge_category_code order by item.charge_category_code)
      from public.billing_line_items item where item.billing_period_id=p_billing_period_id)
  order by notice.attempt_number desc limit 1;
  if not found then
    return query select 'notice_required'::text,'active_mandate'::text,'advance_notice_required'::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,base.advance_notice_days,base.uncovered_categories;
  elsif notice_row.status in ('failed','bounced','complained','suppressed','cancelled') then
    return query select 'notice_failed'::text,'active_mandate'::text,'advance_notice_delivery_failed'::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,base.advance_notice_days,base.uncovered_categories;
  elsif notice_row.status<>'delivered' or notice_row.delivered_at is null then
    return query select 'notice_pending'::text,'active_mandate'::text,'advance_notice_not_delivered'::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,base.advance_notice_days,base.uncovered_categories;
  elsif notice_row.delivered_at+make_interval(days=>notice_row.notice_days)>now() then
    return query select 'notice_waiting'::text,'active_mandate'::text,'advance_notice_interval_active'::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,base.advance_notice_days,base.uncovered_categories;
  else return query select 'ready'::text,'active_mandate'::text,null::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,base.advance_notice_days,base.uncovered_categories;
  end if;
end;
$$;
revoke all on function public.get_billing_collection_readiness(uuid,uuid) from public,anon;
grant execute on function public.get_billing_collection_readiness(uuid,uuid) to authenticated;

do $$ begin
  if position('statement_sha256=current_fingerprint' in replace(pg_get_functiondef('public.get_billing_collection_readiness(uuid,uuid)'::regprocedure),' ',''))=0
  then raise exception 'collection readiness must bind notice to the current statement fingerprint'; end if;
end $$;

comment on column public.billing_statement_notice_deliveries.statement_sha256 is
  'Canonical fingerprint of the exact period and itemized line content at notice preparation; readiness rejects a stale fingerprint even when the total is unchanged.';
