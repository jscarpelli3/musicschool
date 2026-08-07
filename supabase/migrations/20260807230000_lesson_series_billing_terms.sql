-- Preserve the price and billing cadence agreed for a lesson series.
-- Catalog edits must never rewrite a historical month.

create extension if not exists btree_gist with schema extensions;

create table public.lesson_series_billing_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  lesson_series_id uuid not null,
  source_product_id uuid not null,
  billing_mode text not null check (billing_mode in ('per_session', 'fixed_monthly')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  offering_name text not null check (length(trim(offering_name)) between 1 and 120),
  effective_from date not null,
  effective_until date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, lesson_series_id)
    references public.lesson_series(school_id, id) on delete restrict,
  foreign key (school_id, source_product_id)
    references public.service_products(school_id, id) on delete restrict,
  check (effective_until is null or effective_until >= effective_from),
  exclude using gist (
    lesson_series_id with =,
    daterange(effective_from, coalesce(effective_until + 1, 'infinity'::date), '[)') with &&
  )
);

create index lesson_series_billing_terms_lookup_idx
  on public.lesson_series_billing_terms(school_id, lesson_series_id, effective_from desc);

comment on table public.lesson_series_billing_terms is
  'Versioned lesson-series price terms. Per-session amounts are charged per billable occurrence; fixed-monthly amounts are charged once per covered calendar month.';

-- Existing offerings explicitly store per-session pricing after the catalog
-- conversion migration. Preserve that known fact instead of guessing a fixed
-- monthly amount from the school default.
insert into public.lesson_series_billing_terms (
  school_id,
  lesson_series_id,
  source_product_id,
  billing_mode,
  amount_cents,
  currency,
  offering_name,
  effective_from,
  effective_until,
  created_by
)
select
  series.school_id,
  series.id,
  product.id,
  product.pricing_model,
  product.price_cents,
  product.currency,
  product.name,
  series.starts_on,
  series.ends_on,
  series.created_by
from public.lesson_series series
join public.service_products product
  on product.school_id = series.school_id
 and product.id = series.product_id;

create or replace function public.guard_lesson_series_billing_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Lesson series billing terms cannot be deleted';
  end if;

  if old.school_id is distinct from new.school_id
    or old.lesson_series_id is distinct from new.lesson_series_id
    or old.source_product_id is distinct from new.source_product_id
    or old.billing_mode is distinct from new.billing_mode
    or old.amount_cents is distinct from new.amount_cents
    or old.currency is distinct from new.currency
    or old.offering_name is distinct from new.offering_name
    or old.effective_from is distinct from new.effective_from
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Lesson series billing term snapshots are immutable';
  end if;

  if old.effective_until is not null
    or new.effective_until is null
    or new.effective_until < old.effective_from
  then
    raise exception 'An open billing term may only be closed once';
  end if;

  return new;
end;
$$;

create trigger lesson_series_billing_terms_guard
before update or delete on public.lesson_series_billing_terms
for each row execute function public.guard_lesson_series_billing_terms();

alter table public.lesson_series_billing_terms enable row level security;

create policy lesson_series_billing_terms_member_select
on public.lesson_series_billing_terms for select
to authenticated
using (public.is_school_member(school_id));

create policy lesson_series_billing_terms_admin_insert
on public.lesson_series_billing_terms for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_school_role(school_id, array['owner','admin'])
);

create policy lesson_series_billing_terms_admin_update
on public.lesson_series_billing_terms for update
to authenticated
using (public.has_school_role(school_id, array['owner','admin']))
with check (public.has_school_role(school_id, array['owner','admin']));

grant select, insert, update on public.lesson_series_billing_terms to authenticated;

alter table public.billing_line_items
  drop constraint billing_line_items_source_type_check,
  add constraint billing_line_items_source_type_check check (source_type in (
    'lesson', 'lesson_series', 'class', 'fee', 'credit', 'discount', 'manual_adjustment'
  )),
  add column billing_terms_id uuid,
  add foreign key (school_id, billing_terms_id)
    references public.lesson_series_billing_terms(school_id, id) on delete restrict;

comment on column public.billing_line_items.billing_terms_id is
  'The versioned price terms used to calculate this immutable billing snapshot.';
