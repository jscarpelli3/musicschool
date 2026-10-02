-- Stripe catalog creation and archival are performed only by server actions
-- using the service client. Persistent branch databases do not implicitly
-- grant table access to service_role, so keep this contract explicit and
-- narrower than full table ownership.

revoke all
  on table public.stripe_catalog_operations
  from public, anon;

revoke insert, update, delete
  on table public.stripe_catalog_operations
  from authenticated;

revoke delete
  on table public.stripe_catalog_operations
  from service_role;

grant select, insert, update
  on table public.stripe_catalog_operations
  to service_role;

-- The server persists only Stripe-verified catalog snapshots. Browser users
-- retain the existing read policies but cannot create or alter price records.
revoke insert, update, delete
  on table public.service_products
  from service_role;

grant select, insert
  on table public.service_products
  to service_role;

grant update (status, stripe_sync_status)
  on table public.service_products
  to service_role;

do $$
begin
  if not has_table_privilege('service_role', 'public.stripe_catalog_operations', 'SELECT')
    or not has_table_privilege('service_role', 'public.stripe_catalog_operations', 'INSERT')
    or not has_table_privilege('service_role', 'public.stripe_catalog_operations', 'UPDATE') then
    raise exception 'service_role_stripe_catalog_operation_privileges_missing';
  end if;

  if has_table_privilege('service_role', 'public.stripe_catalog_operations', 'DELETE') then
    raise exception 'service_role_stripe_catalog_operation_delete_must_remain_denied';
  end if;

  if not has_table_privilege('service_role', 'public.service_products', 'SELECT')
    or not has_table_privilege('service_role', 'public.service_products', 'INSERT')
    or not has_column_privilege('service_role', 'public.service_products', 'status', 'UPDATE')
    or not has_column_privilege('service_role', 'public.service_products', 'stripe_sync_status', 'UPDATE') then
    raise exception 'service_role_stripe_catalog_snapshot_privileges_missing';
  end if;

  if has_table_privilege('service_role', 'public.service_products', 'DELETE')
    or has_column_privilege('service_role', 'public.service_products', 'price_cents', 'UPDATE')
    or has_column_privilege('service_role', 'public.service_products', 'stripe_price_id', 'UPDATE') then
    raise exception 'service_role_stripe_catalog_snapshot_privileges_too_broad';
  end if;
end;
$$;
