alter table public.platform_plans
 add column stripe_test_price_id text unique,
 add column stripe_live_price_id text unique;

update public.platform_plans
set stripe_test_price_id='price_1UYcUzLLzDLOXsLhvHLztDDe',
 stripe_live_price_id='price_1UYqV4LLzDLOXsLhdNNK4AQ4'
where key='main';

comment on column public.platform_plans.stripe_test_price_id is
 'The verified Stripe recurring Price used by non-live subscription checkout.';
comment on column public.platform_plans.stripe_live_price_id is
 'The separately verified Stripe recurring Price used by live subscription checkout.';

do $$
begin
 if not exists(
  select 1 from public.platform_plans
  where key='main' and monthly_price_cents=1000 and currency='usd' and trial_days=7
   and stripe_test_price_id='price_1UYcUzLLzDLOXsLhvHLztDDe'
   and stripe_live_price_id='price_1UYqV4LLzDLOXsLhdNNK4AQ4'
 ) then raise exception 'Main platform plan is not bound to the verified Stripe test price'; end if;
end;$$;
