-- Every occurrence carries an immutable billing snapshot. This covers both
-- recurring-series occurrences and the currently supported one-time lessons.

alter table public.lesson_events
  add constraint lesson_events_school_id_id_unique unique (school_id, id);

create table public.lesson_event_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  lesson_event_id uuid not null,
  source_product_id uuid not null,
  series_billing_terms_id uuid,
  billing_mode text not null check (billing_mode in ('per_session', 'fixed_monthly')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  offering_name text not null check (length(trim(offering_name)) between 1 and 120),
  captured_at timestamptz not null default now(),
  unique (school_id, id),
  unique (lesson_event_id),
  foreign key (school_id, lesson_event_id)
    references public.lesson_events(school_id, id) on delete restrict,
  foreign key (school_id, source_product_id)
    references public.service_products(school_id, id) on delete restrict,
  foreign key (school_id, series_billing_terms_id)
    references public.lesson_series_billing_terms(school_id, id) on delete restrict,
  check (
    (series_billing_terms_id is null and billing_mode = 'per_session')
    or series_billing_terms_id is not null
  )
);

create index lesson_event_price_snapshots_school_event_idx
  on public.lesson_event_price_snapshots(school_id, lesson_event_id);

comment on table public.lesson_event_price_snapshots is
  'Immutable price facts captured when an occurrence is created. Standalone lessons must be per-session; recurring occurrences identify their exact series term version.';

create or replace function public.capture_lesson_event_price_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.service_products%rowtype;
  term_row public.lesson_series_billing_terms%rowtype;
  local_service_date date;
  school_timezone text;
begin
  select * into strict product_row
  from public.service_products
  where school_id = new.school_id and id = new.product_id;

  if new.lesson_series_id is null then
    if product_row.pricing_model <> 'per_session' then
      raise exception 'standalone_lesson_requires_per_session_price';
    end if;

    insert into public.lesson_event_price_snapshots (
      school_id, lesson_event_id, source_product_id, billing_mode,
      amount_cents, currency, offering_name
    ) values (
      new.school_id, new.id, product_row.id, 'per_session',
      product_row.price_cents, product_row.currency, product_row.name
    );
    return new;
  end if;

  select timezone into strict school_timezone
  from public.schools where id = new.school_id;
  local_service_date := (new.starts_at at time zone school_timezone)::date;

  select * into term_row
  from public.lesson_series_billing_terms term
  where term.school_id = new.school_id
    and term.lesson_series_id = new.lesson_series_id
    and term.effective_from <= local_service_date
    and (term.effective_until is null or term.effective_until >= local_service_date)
  order by term.effective_from desc
  limit 1;

  if not found then
    raise exception 'lesson_series_missing_effective_billing_terms';
  end if;

  if term_row.source_product_id <> new.product_id then
    raise exception 'lesson_event_product_does_not_match_billing_terms';
  end if;

  insert into public.lesson_event_price_snapshots (
    school_id, lesson_event_id, source_product_id, series_billing_terms_id,
    billing_mode, amount_cents, currency, offering_name
  ) values (
    new.school_id, new.id, term_row.source_product_id, term_row.id,
    term_row.billing_mode, term_row.amount_cents, term_row.currency,
    term_row.offering_name
  );

  return new;
end;
$$;

revoke all on function public.capture_lesson_event_price_snapshot() from public;

create trigger lesson_events_capture_price_snapshot
after insert on public.lesson_events
for each row execute function public.capture_lesson_event_price_snapshot();

-- All existing occurrences are seeded/demo standalone events. Preserve their
-- currently explicit per-session offering price before draft generation exists.
insert into public.lesson_event_price_snapshots (
  school_id, lesson_event_id, source_product_id, billing_mode,
  amount_cents, currency, offering_name, captured_at
)
select
  event.school_id,
  event.id,
  product.id,
  product.pricing_model,
  product.price_cents,
  product.currency,
  product.name,
  event.created_at
from public.lesson_events event
join public.service_products product
  on product.school_id = event.school_id
 and product.id = event.product_id;

create or replace function public.guard_lesson_event_price_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Lesson event price snapshots are immutable';
end;
$$;

create trigger lesson_event_price_snapshots_guard
before update or delete on public.lesson_event_price_snapshots
for each row execute function public.guard_lesson_event_price_snapshot();

alter table public.lesson_event_price_snapshots enable row level security;

create policy lesson_event_price_snapshots_member_select
on public.lesson_event_price_snapshots for select
to authenticated
using (public.is_school_member(school_id));

grant select on public.lesson_event_price_snapshots to authenticated;

alter table public.billing_line_items
  add column lesson_event_price_snapshot_id uuid,
  add foreign key (school_id, lesson_event_price_snapshot_id)
    references public.lesson_event_price_snapshots(school_id, id) on delete restrict;

comment on column public.billing_line_items.lesson_event_price_snapshot_id is
  'The immutable occurrence price snapshot used for a per-session line item.';
