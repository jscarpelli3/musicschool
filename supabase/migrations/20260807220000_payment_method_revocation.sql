alter table public.billing_payment_methods
  drop constraint billing_payment_methods_status_check;

alter table public.billing_payment_methods
  add constraint billing_payment_methods_status_check
  check (status in ('active', 'expired', 'detaching', 'detached'));

create or replace function public.begin_payment_method_revocation(p_payment_method_id uuid)
returns table(provider_payment_method_id text, provider_account_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_method public.billing_payment_methods%rowtype;
begin
  select * into target_method
  from public.billing_payment_methods
  where id = p_payment_method_id
  for update;

  if not found then raise exception 'Payment method not found'; end if;
  if target_method.status = 'detached' then raise exception 'Payment method is already detached'; end if;

  update public.payment_method_consents
  set revoked_at = coalesce(revoked_at, now())
  where payment_method_id = target_method.id and revoked_at is null;

  update public.billing_payment_methods
  set status = 'detaching', is_default = false
  where id = target_method.id;

  if not exists (
    select 1 from public.billing_payment_methods
    where provider_customer_id = target_method.provider_customer_id
      and status = 'active' and is_default
  ) then
    update public.billing_payment_methods
    set is_default = true
    where id = (
      select id from public.billing_payment_methods
      where provider_customer_id = target_method.provider_customer_id
        and status = 'active' and id <> target_method.id
      order by created_at desc
      limit 1
    );
  end if;

  return query
  select target_method.provider_payment_method_id, connection.provider_account_id
  from public.billing_provider_customers customer
  join public.school_payment_connections connection on connection.id = customer.payment_connection_id
  where customer.id = target_method.provider_customer_id;
end;
$$;

create or replace function public.complete_payment_method_revocation(p_payment_method_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_payment_methods
  set status = 'detached', is_default = false
  where id = p_payment_method_id and status = 'detaching';
  if not found then raise exception 'Payment method is not pending detachment'; end if;
end;
$$;

revoke all on function public.begin_payment_method_revocation(uuid) from public, anon, authenticated;
revoke all on function public.complete_payment_method_revocation(uuid) from public, anon, authenticated;
grant execute on function public.begin_payment_method_revocation(uuid) to service_role;
grant execute on function public.complete_payment_method_revocation(uuid) to service_role;

comment on function public.begin_payment_method_revocation(uuid) is
  'Revokes off-session consent before external detachment and selects a safe fallback default.';
