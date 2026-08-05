-- School-owned lesson and class offerings.

create table public.service_products (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  format text not null check (format in ('private_lesson', 'group_class')),
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  sessions_per_interval integer not null default 1
    check (sessions_per_interval between 1 and 31),
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  interval_unit text not null default 'week' check (interval_unit in ('week', 'month')),
  pricing_model text not null check (pricing_model in ('fixed_monthly', 'per_session')),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  capacity integer not null default 1 check (capacity between 1 and 500),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_products_format_capacity_check check (
    (format = 'private_lesson' and capacity = 1)
    or (format = 'group_class' and capacity >= 2)
  )
);

create unique index service_products_school_name_unique
  on public.service_products(school_id, lower(name));
create index service_products_school_status_idx
  on public.service_products(school_id, status, name);

create trigger service_products_set_updated_at
before update on public.service_products
for each row execute function public.set_updated_at();

alter table public.service_products enable row level security;

create policy service_products_select_member
on public.service_products for select
to authenticated
using (public.is_school_member(school_id));

create policy service_products_insert_management
on public.service_products for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_school_role(school_id, array['owner', 'admin'])
);

create policy service_products_update_management
on public.service_products for update
to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy service_products_delete_management
on public.service_products for delete
to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']));

grant select, insert, update, delete on public.service_products to authenticated;
