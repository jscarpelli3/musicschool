create table public.platform_plans(
 key text primary key check(key~'^[a-z][a-z0-9_]{1,39}$'),
 name text not null check(length(name) between 1 and 80),
 monthly_price_cents integer not null check(monthly_price_cents>=50),
 currency text not null default 'usd' check(currency~'^[a-z]{3}$'),
 trial_days integer not null default 7 check(trial_days between 0 and 90),
 status text not null default 'active' check(status in('active','retired')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
insert into public.platform_plans(key,name,monthly_price_cents,currency,trial_days)
values('main','Main',1000,'usd',7);

create table public.school_platform_subscriptions(
 school_id uuid primary key references public.schools(id) on delete cascade,
 plan_key text not null default 'main' references public.platform_plans(key),
 billing_terms text not null default 'standard' check(billing_terms in('standard','custom','complimentary')),
 access_status text not null default 'payment_setup_required' check(access_status in('payment_setup_required','trialing','active','complimentary','past_due','canceled')),
 custom_monthly_price_cents integer check(custom_monthly_price_cents is null or custom_monthly_price_cents>=50),
 complimentary_reason text check(complimentary_reason is null or length(trim(complimentary_reason)) between 1 and 500),
 complimentary_started_at timestamptz,
 complimentary_ends_at timestamptz,
 complimentary_granted_by uuid references public.profiles(id) on delete restrict,
 stripe_customer_id text unique,
 stripe_subscription_id text unique,
 stripe_checkout_session_id text unique,
 stripe_status text,
 trial_ends_at timestamptz,
 current_period_ends_at timestamptz,
 cancel_at_period_end boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((billing_terms='custom')=(custom_monthly_price_cents is not null)),
 check((billing_terms='complimentary')=(complimentary_started_at is not null and complimentary_granted_by is not null)),
 check(complimentary_ends_at is null or complimentary_ends_at>complimentary_started_at)
);
create trigger platform_plans_set_updated_at before update on public.platform_plans for each row execute function public.set_updated_at();
create trigger school_platform_subscriptions_set_updated_at before update on public.school_platform_subscriptions for each row execute function public.set_updated_at();
alter table public.platform_plans enable row level security;
alter table public.school_platform_subscriptions enable row level security;
revoke all on public.platform_plans,public.school_platform_subscriptions from public,anon,authenticated;
grant select on public.platform_plans to authenticated;

insert into public.school_platform_subscriptions(school_id)
select id from public.schools on conflict(school_id) do nothing;

create function public.initialize_school_platform_subscription()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.school_platform_subscriptions(school_id) values(new.id) on conflict(school_id) do nothing;
 return new;
end;$$;
create trigger schools_initialize_platform_subscription after insert on public.schools
for each row execute function public.initialize_school_platform_subscription();
revoke all on function public.initialize_school_platform_subscription() from public,anon,authenticated;

create function public.set_school_platform_billing_terms(
 p_school_id uuid,p_terms text,p_actor_profile_id uuid,p_reason text default null,
 p_ends_at timestamptz default null,p_custom_monthly_price_cents integer default null
) returns void language plpgsql security definer set search_path='' as $$
declare before_row jsonb;after_row jsonb;
begin
 if auth.role()<>'service_role'
  or not (
   exists(select 1 from public.platform_admins where profile_id=p_actor_profile_id and status='active')
   or exists(select 1 from public.profiles where id=p_actor_profile_id and lower(email)='scarpelli.jon@gmail.com')
  )
  or p_terms not in('standard','custom','complimentary')
  or (p_terms='complimentary' and (nullif(trim(p_reason),'') is null or (p_ends_at is not null and p_ends_at<=now())))
  or (p_terms='custom' and (p_custom_monthly_price_cents is null or p_custom_monthly_price_cents<50)) then
  raise exception 'invalid_platform_billing_terms';
 end if;
 select to_jsonb(subscription) into before_row from public.school_platform_subscriptions subscription where school_id=p_school_id for update;
 if before_row is null then
  insert into public.school_platform_subscriptions(school_id) values(p_school_id);
  select to_jsonb(subscription) into before_row from public.school_platform_subscriptions subscription where school_id=p_school_id for update;
 end if;
 update public.school_platform_subscriptions set
  billing_terms=p_terms,
  access_status=case when p_terms='complimentary' then 'complimentary' when stripe_status='trialing' then 'trialing' when stripe_status='active' then 'active' else 'payment_setup_required' end,
  custom_monthly_price_cents=case when p_terms='custom' then p_custom_monthly_price_cents else null end,
  complimentary_reason=case when p_terms='complimentary' then trim(p_reason) else null end,
  complimentary_started_at=case when p_terms='complimentary' then now() else null end,
  complimentary_ends_at=case when p_terms='complimentary' then p_ends_at else null end,
  complimentary_granted_by=case when p_terms='complimentary' then p_actor_profile_id else null end
 where school_id=p_school_id returning to_jsonb(school_platform_subscriptions) into after_row;
 insert into public.platform_audit_log(actor_profile_id,action,entity_type,entity_id,metadata)
 values(p_actor_profile_id,'school.platform_billing_terms_changed','school',p_school_id,jsonb_build_object('before',before_row,'after',after_row));
end;$$;
revoke all on function public.set_school_platform_billing_terms(uuid,text,uuid,text,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.set_school_platform_billing_terms(uuid,text,uuid,text,timestamptz,integer) to service_role;

comment on table public.school_platform_subscriptions is
 'What a school pays Common Time. This is deliberately separate from school-to-family payment collection.';
