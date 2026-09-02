-- Stripe owns provider-side catalog prices. Common Time stores provider references,
-- immutable snapshots, and the reconciliation trail needed to bill safely.

alter table public.service_products
  add column stripe_account_id text,
  add column stripe_product_id text,
  add column stripe_price_id text,
  add column stripe_sync_status text not null default 'legacy_unsynced'
    check (stripe_sync_status in ('legacy_unsynced','synced','reconciliation_required')),
  add constraint service_products_stripe_catalog_complete check (
    (stripe_sync_status = 'synced' and stripe_account_id is not null and stripe_product_id is not null and stripe_price_id is not null)
    or stripe_sync_status <> 'synced'
  );

create unique index service_products_stripe_price_unique
  on public.service_products(stripe_account_id, stripe_price_id)
  where stripe_price_id is not null;

create table public.stripe_catalog_operations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null check (operation in ('create_offering','archive_offering','replace_price')),
  status text not null default 'prepared'
    check (status in ('prepared','submitting','succeeded','failed','reconciliation_required')),
  request_snapshot jsonb not null,
  provider_account_id text not null,
  provider_product_id text,
  provider_price_id text,
  service_product_id uuid references public.service_products(id) on delete restrict,
  error_class text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create trigger stripe_catalog_operations_set_updated_at before update on public.stripe_catalog_operations
for each row execute function public.set_updated_at();
create index stripe_catalog_operations_school_status_idx
  on public.stripe_catalog_operations(school_id,status,created_at desc);
alter table public.stripe_catalog_operations enable row level security;
create policy stripe_catalog_operations_management_select on public.stripe_catalog_operations for select to authenticated
  using (public.has_school_role(school_id,array['owner','admin']));
grant select on public.stripe_catalog_operations to authenticated;
revoke insert,update,delete on public.stripe_catalog_operations from authenticated;

-- Browser/authenticated database calls can no longer set or alter a price.
revoke insert on public.service_products from authenticated;
revoke update (price_cents, status) on public.service_products from authenticated;

comment on column public.service_products.price_cents is
  'Server-verified snapshot of the referenced Stripe Price unit_amount; never accepted as transaction authority.';
comment on table public.stripe_catalog_operations is
  'Durable provider-operation trail. reconciliation_required means Stripe may have accepted work that was not finalized locally.';
