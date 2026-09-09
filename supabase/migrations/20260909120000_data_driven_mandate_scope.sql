create table public.billing_charge_categories (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  label text not null check (length(trim(label)) between 1 and 120),
  description text not null check (length(trim(description)) between 1 and 500),
  automatic_charge_eligible boolean not null default true,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger billing_charge_categories_set_updated_at before update on public.billing_charge_categories
for each row execute function public.set_updated_at();

insert into public.billing_charge_categories(code,label,description,automatic_charge_eligible,display_order) values
  ('instruction','Lessons and classes','Scheduled instruction and recurring tuition.',true,10),
  ('school_fee','School fees','Itemized registration, materials, and other school fees.',true,20),
  ('adjustment','Owner-added charges','Explained positive adjustments added during review.',true,30),
  ('credit','Credits and discounts','Reductions that lower, but never broaden, the collected amount.',true,40);

create table public.billing_source_category_defaults (
  source_type text primary key,
  category_code text not null references public.billing_charge_categories(code) on update restrict on delete restrict
);
insert into public.billing_source_category_defaults(source_type,category_code) values
  ('lesson','instruction'),('class','instruction'),('fee','school_fee'),
  ('credit','credit'),('discount','credit'),('manual_adjustment','adjustment');

alter table public.billing_line_items add column charge_category_code text;
alter table public.billing_line_items disable trigger user;
update public.billing_line_items item set charge_category_code=defaults.category_code
from public.billing_source_category_defaults defaults where defaults.source_type=item.source_type;
alter table public.billing_line_items enable trigger user;
alter table public.billing_line_items alter column charge_category_code set not null;
alter table public.billing_line_items add constraint billing_line_items_charge_category_fkey
foreign key(charge_category_code) references public.billing_charge_categories(code) on update restrict on delete restrict;

create or replace function public.assign_billing_line_charge_category()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.charge_category_code is null then
    select defaults.category_code into new.charge_category_code
    from public.billing_source_category_defaults defaults where defaults.source_type=new.source_type;
  end if;
  if new.charge_category_code is null then raise exception 'billing_charge_category_required'; end if;
  return new;
end;
$$;
create trigger billing_line_items_assign_charge_category before insert on public.billing_line_items
for each row execute function public.assign_billing_line_charge_category();

alter table public.billing_collection_mandates add column permitted_charge_categories text[];
update public.billing_collection_mandates set permitted_charge_categories=array(
  select category.code from public.billing_charge_categories category
  where category.active and category.automatic_charge_eligible order by category.display_order,category.code
);
alter table public.billing_collection_mandates alter column permitted_charge_categories set not null;
alter table public.billing_collection_mandates add constraint billing_collection_mandates_categories_nonempty
check (cardinality(permitted_charge_categories)>0);

create or replace function public.assign_mandate_charge_categories()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.permitted_charge_categories is null then
    new.permitted_charge_categories:=array(
      select category.code from public.billing_charge_categories category
      where category.active and category.automatic_charge_eligible order by category.display_order,category.code
    );
  end if;
  if cardinality(new.permitted_charge_categories)=0 or exists(
    select 1 from unnest(new.permitted_charge_categories) code
    left join public.billing_charge_categories category on category.code=code
    where category.code is null or not category.active or not category.automatic_charge_eligible
  ) then raise exception 'invalid_mandate_charge_categories'; end if;
  return new;
end;
$$;
create trigger billing_collection_mandates_assign_categories before insert on public.billing_collection_mandates
for each row execute function public.assign_mandate_charge_categories();

create or replace function public.get_billing_collection_readiness(p_school_id uuid,p_billing_period_id uuid)
returns table(
  readiness text, authorization_source text, reason text, mandate_id uuid,
  approval_request_id uuid, amount_cents bigint, currency text,
  monthly_cap_cents bigint, advance_notice_days smallint, uncovered_categories text[]
)
language plpgsql stable security definer set search_path=''
as $$
declare period_row public.billing_periods%rowtype; mandate_row public.billing_collection_mandates%rowtype;
  approval_id uuid; missing_categories text[];
begin
  if auth.uid() is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized'; end if;
  select * into period_row from public.billing_periods where school_id=p_school_id and id=p_billing_period_id;
  if not found then raise exception 'billing_period_not_found'; end if;
  if period_row.status not in ('locked','approval_pending','approved') then
    return query select 'blocked','none','period_not_locked',null::uuid,null::uuid,period_row.amount_due_cents,period_row.currency,null::bigint,null::smallint,'{}'::text[]; return;
  end if;
  select request.id into approval_id from public.billing_approval_requests request
  where request.school_id=p_school_id and request.billing_period_id=period_row.id
    and request.approval_status='approved' and request.amount_cents=period_row.amount_due_cents
  order by request.request_version desc limit 1;
  if approval_id is not null then
    return query select 'ready','exact_approval',null::text,null::uuid,approval_id,period_row.amount_due_cents,period_row.currency,null::bigint,null::smallint,'{}'::text[]; return;
  end if;
  select * into mandate_row from public.billing_collection_mandates mandate
  where mandate.school_id=p_school_id and mandate.billing_account_id=period_row.billing_account_id and mandate.status='active';
  if not found then
    return query select 'approval_required','none','active_mandate_required',null::uuid,null::uuid,period_row.amount_due_cents,period_row.currency,null::bigint,null::smallint,'{}'::text[]; return;
  end if;
  if not exists(select 1 from public.billing_payment_methods method join public.payment_method_consents consent
    on consent.school_id=method.school_id and consent.billing_account_id=method.billing_account_id and consent.payment_method_id=method.id
    and consent.usage_scope='off_session' and consent.revoked_at is null
    where method.school_id=p_school_id and method.billing_account_id=period_row.billing_account_id
      and method.id=mandate_row.payment_method_id and method.status='active') then
    return query select 'approval_required','none','active_payment_method_required',mandate_row.id,null::uuid,period_row.amount_due_cents,period_row.currency,mandate_row.monthly_cap_cents,mandate_row.advance_notice_days,'{}'::text[]; return;
  end if;
  select coalesce(array_agg(distinct item.charge_category_code order by item.charge_category_code),'{}'::text[]) into missing_categories
  from public.billing_line_items item where item.billing_period_id=period_row.id and item.amount_cents>0
    and not(item.charge_category_code=any(mandate_row.permitted_charge_categories));
  if cardinality(missing_categories)>0 then
    return query select 'approval_required','none','mandate_scope_exceeded',mandate_row.id,null::uuid,period_row.amount_due_cents,period_row.currency,mandate_row.monthly_cap_cents,mandate_row.advance_notice_days,missing_categories; return;
  end if;
  if mandate_row.monthly_cap_cents is not null and period_row.amount_due_cents>mandate_row.monthly_cap_cents then
    return query select 'approval_required','none','mandate_cap_exceeded',mandate_row.id,null::uuid,period_row.amount_due_cents,period_row.currency,mandate_row.monthly_cap_cents,mandate_row.advance_notice_days,'{}'::text[]; return;
  end if;
  return query select 'notice_required','active_mandate','advance_notice_required',mandate_row.id,null::uuid,period_row.amount_due_cents,period_row.currency,mandate_row.monthly_cap_cents,mandate_row.advance_notice_days,'{}'::text[];
end;
$$;

alter table public.billing_charge_categories enable row level security;
alter table public.billing_source_category_defaults enable row level security;
revoke all on public.billing_charge_categories,public.billing_source_category_defaults from public,anon,authenticated;
revoke all on function public.assign_billing_line_charge_category(),public.assign_mandate_charge_categories() from public,anon,authenticated;
revoke all on function public.get_billing_collection_readiness(uuid,uuid) from public,anon;
grant execute on function public.get_billing_collection_readiness(uuid,uuid) to authenticated;

comment on function public.get_billing_collection_readiness(uuid,uuid) is
  'Resolves exact approval, mandate scope, cap, saved-method consent, and notice requirements for one immutable billing period.';
