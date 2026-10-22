alter table public.service_products
  add column default_schedule_type text not null default 'weekly';

alter table public.service_products
  add constraint service_products_default_schedule_type_check
  check (default_schedule_type in ('one_time', 'weekly'));

comment on column public.service_products.default_schedule_type is
  'Owner-facing scheduling default. It prefills lesson creation but never prevents an owner from choosing the other option.';
