create table public.billing_statement_notice_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  billing_period_id uuid not null,
  mandate_id uuid not null,
  recipient_email text not null check(recipient_email=lower(trim(recipient_email)) and length(recipient_email)<=320),
  provider text not null default 'resend' check(provider='resend'),
  provider_email_id text,
  from_address text not null,
  subject text not null check(length(subject) between 1 and 300),
  body_sha256 text not null check(body_sha256~'^[0-9a-f]{64}$'),
  idempotency_key text not null unique check(length(idempotency_key) between 1 and 256),
  status text not null default 'pending' check(status in (
    'pending','accepted','sent','delivered','delayed','failed','bounced',
    'complained','suppressed','reconciliation_required','cancelled'
  )),
  amount_cents bigint not null check(amount_cents>0),
  currency text not null check(currency~'^[A-Z]{3}$'),
  charge_categories text[] not null check(cardinality(charge_categories)>0),
  notice_days smallint not null check(notice_days between 1 and 14),
  accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,id),
  unique(billing_period_id,mandate_id),
  unique(provider,provider_email_id),
  foreign key(school_id,billing_account_id,billing_period_id)
    references public.billing_periods(school_id,billing_account_id,id) on delete restrict,
  foreign key(school_id,mandate_id)
    references public.billing_collection_mandates(school_id,id) on delete restrict
);
create index billing_statement_notice_school_status_idx
  on public.billing_statement_notice_deliveries(school_id,status,created_at desc);
create trigger billing_statement_notice_deliveries_set_updated_at
before update on public.billing_statement_notice_deliveries
for each row execute function public.set_updated_at();

alter table public.billing_statement_notice_deliveries enable row level security;
create policy billing_statement_notice_deliveries_manage_select
on public.billing_statement_notice_deliveries for select to authenticated
using(public.has_school_capability(school_id,'school.billing.manage'));
grant select on public.billing_statement_notice_deliveries to authenticated;
revoke insert,update,delete on public.billing_statement_notice_deliveries from public,anon,authenticated;

insert into public.email_delivery_source_types(source_kind,source_table,records_sent_at)
values('billing_statement_notice','billing_statement_notice_deliveries',false);

create trigger billing_statement_notice_register_provider_identity
after insert or update of provider_email_id on public.billing_statement_notice_deliveries
for each row when(new.provider_email_id is not null)
execute function public.register_email_delivery_projection();

alter function public.get_billing_collection_readiness(uuid,uuid)
rename to get_billing_collection_readiness_before_notice;
revoke all on function public.get_billing_collection_readiness_before_notice(uuid,uuid) from public,anon,authenticated;

create function public.get_billing_collection_readiness(p_school_id uuid,p_billing_period_id uuid)
returns table(
  readiness text,authorization_source text,reason text,mandate_id uuid,
  approval_request_id uuid,amount_cents bigint,currency text,
  monthly_cap_cents bigint,advance_notice_days smallint,uncovered_categories text[]
)
language plpgsql stable security definer set search_path=''
as $$
declare base record; notice_row public.billing_statement_notice_deliveries%rowtype;
begin
  select * into base from public.get_billing_collection_readiness_before_notice(p_school_id,p_billing_period_id);
  if base.readiness is distinct from 'notice_required' then
    return query select base.readiness,base.authorization_source,base.reason,base.mandate_id,
      base.approval_request_id,base.amount_cents,base.currency,base.monthly_cap_cents,
      base.advance_notice_days,base.uncovered_categories;
    return;
  end if;

  select * into notice_row from public.billing_statement_notice_deliveries notice
  where notice.school_id=p_school_id and notice.billing_period_id=p_billing_period_id
    and notice.mandate_id=base.mandate_id
    and notice.amount_cents=base.amount_cents and notice.currency=base.currency
    and notice.notice_days=base.advance_notice_days
  order by notice.created_at desc limit 1;

  if not found then
    return query select 'notice_required'::text,'active_mandate'::text,'advance_notice_required'::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,
      base.advance_notice_days,base.uncovered_categories;
  elsif notice_row.status in ('failed','bounced','complained','suppressed','cancelled') then
    return query select 'notice_failed'::text,'active_mandate'::text,'advance_notice_delivery_failed'::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,
      base.advance_notice_days,base.uncovered_categories;
  elsif notice_row.status<>'delivered' or notice_row.delivered_at is null then
    return query select 'notice_pending'::text,'active_mandate'::text,'advance_notice_not_delivered'::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,
      base.advance_notice_days,base.uncovered_categories;
  elsif notice_row.delivered_at+make_interval(days=>notice_row.notice_days)>now() then
    return query select 'notice_waiting'::text,'active_mandate'::text,'advance_notice_interval_active'::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,
      base.advance_notice_days,base.uncovered_categories;
  else
    return query select 'ready'::text,'active_mandate'::text,null::text,
      base.mandate_id,null::uuid,base.amount_cents,base.currency,base.monthly_cap_cents,
      base.advance_notice_days,base.uncovered_categories;
  end if;
end;
$$;

create function public.prepare_billing_statement_notice(
  p_school_id uuid,p_billing_period_id uuid,p_from_address text,
  p_subject text,p_body_sha256 text
) returns table(
  notice_delivery_id uuid,idempotency_key text,recipient_email text
)
language plpgsql security definer set search_path=''
as $$
declare actor_id uuid:=auth.uid(); readiness_row record; period_row public.billing_periods%rowtype;
  mandate_row public.billing_collection_mandates%rowtype; normalized_email text; delivery_id uuid; delivery_key text;
begin
  if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized'; end if;
  if p_body_sha256!~'^[0-9a-f]{64}$' or length(trim(p_subject)) not between 1 and 300
    or length(trim(p_from_address)) not between 3 and 320 then raise exception 'invalid_notice_message'; end if;
  perform pg_advisory_xact_lock(hashtextextended('billing-statement-notice:'||p_billing_period_id::text,0));
  select * into period_row from public.billing_periods where school_id=p_school_id and id=p_billing_period_id for update;
  if not found then raise exception 'billing_period_not_found'; end if;
  select * into readiness_row from public.get_billing_collection_readiness(p_school_id,p_billing_period_id);
  if readiness_row.readiness not in ('notice_required','notice_failed') then raise exception 'statement_notice_not_eligible:%',readiness_row.readiness; end if;
  select * into mandate_row from public.billing_collection_mandates where id=readiness_row.mandate_id and status='active' for update;
  if not found then raise exception 'active_mandate_required'; end if;
  select lower(trim(person.email)) into normalized_email from public.billing_accounts account
  join public.people person on person.school_id=account.school_id and person.id=account.billing_contact_person_id and person.status='active'
  where account.school_id=p_school_id and account.id=period_row.billing_account_id and account.status='active';
  if normalized_email is null or normalized_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'valid_payer_email_required'; end if;
  if exists(select 1 from public.email_suppressions where recipient_email=normalized_email) then raise exception 'recipient_suppressed'; end if;
  delivery_key:='billing-statement-notice/'||period_row.id::text||'/'||mandate_row.id::text;
  insert into public.billing_statement_notice_deliveries(
    school_id,billing_account_id,billing_period_id,mandate_id,recipient_email,
    from_address,subject,body_sha256,idempotency_key,amount_cents,currency,
    charge_categories,notice_days,created_by
  ) select p_school_id,period_row.billing_account_id,period_row.id,mandate_row.id,normalized_email,
    trim(p_from_address),trim(p_subject),p_body_sha256,delivery_key,period_row.amount_due_cents,
    period_row.currency,array_agg(distinct item.charge_category_code order by item.charge_category_code),
    mandate_row.advance_notice_days,actor_id
  from public.billing_line_items item where item.billing_period_id=period_row.id
  on conflict(billing_period_id,mandate_id) do update set
    recipient_email=excluded.recipient_email,from_address=excluded.from_address,
    subject=excluded.subject,body_sha256=excluded.body_sha256,status='pending',
    provider_email_id=null,accepted_at=null,delivered_at=null,failed_at=null,updated_at=now()
  where public.billing_statement_notice_deliveries.status in ('failed','bounced','suppressed')
  returning id into delivery_id;
  if delivery_id is null then raise exception 'statement_notice_already_prepared'; end if;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'billing_statement_notice.prepared','billing_period',period_row.id,
    jsonb_build_object('notice_delivery_id',delivery_id,'mandate_id',mandate_row.id,'amount_cents',period_row.amount_due_cents,'notice_days',mandate_row.advance_notice_days));
  return query select delivery_id,delivery_key,normalized_email;
end;
$$;

create function public.complete_billing_statement_notice_submission(p_delivery_id uuid,p_provider_email_id text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  if nullif(trim(p_provider_email_id),'') is null then raise exception 'invalid_provider_email_id'; end if;
  update public.billing_statement_notice_deliveries set provider_email_id=trim(p_provider_email_id),status='accepted',accepted_at=now()
  where id=p_delivery_id and status='pending';
  if not found then raise exception 'statement_notice_not_pending'; end if;
end;
$$;

create function public.fail_billing_statement_notice_submission(p_delivery_id uuid,p_code text default null)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  update public.billing_statement_notice_deliveries set status='failed',failed_at=now()
  where id=p_delivery_id and status='pending';
end;
$$;

revoke all on function public.get_billing_collection_readiness(uuid,uuid) from public,anon;
grant execute on function public.get_billing_collection_readiness(uuid,uuid) to authenticated;
revoke all on function public.prepare_billing_statement_notice(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.prepare_billing_statement_notice(uuid,uuid,text,text,text) to authenticated;
revoke all on function public.complete_billing_statement_notice_submission(uuid,text),public.fail_billing_statement_notice_submission(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_billing_statement_notice_submission(uuid,text),public.fail_billing_statement_notice_submission(uuid,text) to service_role;

comment on table public.billing_statement_notice_deliveries is
  'Durable advance-statement delivery bound to one immutable period and the exact active mandate that authorizes it.';
