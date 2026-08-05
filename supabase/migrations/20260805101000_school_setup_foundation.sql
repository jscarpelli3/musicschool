-- School contact details, versioned policies, and private reference documents.

alter table public.schools
  add column phone text check (phone is null or length(trim(phone)) between 1 and 80),
  add column address_line_1 text check (address_line_1 is null or length(trim(address_line_1)) between 1 and 160),
  add column address_line_2 text check (address_line_2 is null or length(trim(address_line_2)) between 1 and 160),
  add column city text check (city is null or length(trim(city)) between 1 and 120),
  add column region text check (region is null or length(trim(region)) between 1 and 120),
  add column postal_code text check (postal_code is null or length(trim(postal_code)) between 1 and 40);

create table public.school_policies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  kind text not null check (kind in ('cancellation', 'payment', 'general')),
  name text not null check (length(trim(name)) between 1 and 120),
  is_default boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, id, kind)
);

create unique index school_policies_name_unique on public.school_policies(school_id, kind, lower(name));
create unique index school_policies_one_default_per_kind
  on public.school_policies(school_id, kind) where is_default and status = 'active';

create trigger school_policies_set_updated_at before update on public.school_policies
for each row execute function public.set_updated_at();

create table public.school_policy_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  policy_id uuid not null,
  version_number integer not null check (version_number > 0),
  editor_content jsonb not null default '{}'::jsonb,
  plain_text text not null default '',
  effective_from timestamptz,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (policy_id, version_number),
  foreign key (school_id, policy_id) references public.school_policies(school_id, id) on delete cascade
);

create table public.cancellation_policy_rules (
  policy_version_id uuid primary key references public.school_policy_versions(id) on delete cascade,
  student_cancel_cutoff_hours integer not null default 24 check (student_cancel_cutoff_hours between 0 and 8760),
  student_reschedule_cutoff_hours integer not null default 24 check (student_reschedule_cutoff_hours between 0 and 8760),
  max_self_service_reschedules integer check (max_self_service_reschedules between 0 and 100),
  replacement_window_days integer check (replacement_window_days between 0 and 365),
  must_keep_assigned_teacher boolean not null default true,
  late_cancel_disposition text not null default 'charge' check (late_cancel_disposition in ('charge', 'credit', 'waive', 'manual_review')),
  no_show_disposition text not null default 'charge' check (no_show_disposition in ('charge', 'credit', 'waive', 'manual_review')),
  teacher_cancel_disposition text not null default 'credit' check (teacher_cancel_disposition in ('credit', 'makeup', 'refund', 'manual_review'))
);

create table public.payment_policy_rules (
  policy_version_id uuid primary key references public.school_policy_versions(id) on delete cascade,
  collection_method text not null default 'automatic_charge' check (collection_method in ('automatic_charge', 'send_invoice', 'manual_collection')),
  approval_requirement text not null default 'standing' check (approval_requirement in ('standing', 'per_period', 'per_charge')),
  due_day_of_month integer check (due_day_of_month between 1 and 28),
  grace_period_days integer not null default 0 check (grace_period_days between 0 and 90),
  late_fee_cents integer not null default 0 check (late_fee_cents between 0 and 1000000),
  failed_payment_retry_count integer not null default 0 check (failed_payment_retry_count between 0 and 12)
);

create table public.service_product_policy_selections (
  school_id uuid not null,
  product_id uuid not null,
  policy_kind text not null check (policy_kind in ('cancellation', 'payment')),
  use_school_default boolean not null default true,
  policy_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, policy_kind),
  foreign key (school_id, product_id) references public.service_products(school_id, id) on delete cascade,
  foreign key (school_id, policy_id, policy_kind) references public.school_policies(school_id, id, kind) on delete restrict,
  check ((use_school_default and policy_id is null) or (not use_school_default and policy_id is not null))
);

create trigger service_product_policy_selections_set_updated_at before update on public.service_product_policy_selections
for each row execute function public.set_updated_at();

create table public.school_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  status text not null default 'active' check (status in ('active', 'archived')),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger school_documents_set_updated_at before update on public.school_documents
for each row execute function public.set_updated_at();

alter table public.school_policies enable row level security;
alter table public.school_policy_versions enable row level security;
alter table public.cancellation_policy_rules enable row level security;
alter table public.payment_policy_rules enable row level security;
alter table public.service_product_policy_selections enable row level security;
alter table public.school_documents enable row level security;

create policy school_policies_member_select on public.school_policies for select to authenticated using (public.is_school_member(school_id));
create policy school_policies_admin_manage on public.school_policies for all to authenticated using (public.has_school_role(school_id, array['owner','admin'])) with check (public.has_school_role(school_id, array['owner','admin']));
create policy school_policy_versions_member_select on public.school_policy_versions for select to authenticated using (public.is_school_member(school_id));
create policy school_policy_versions_admin_manage on public.school_policy_versions for all to authenticated using (public.has_school_role(school_id, array['owner','admin'])) with check (public.has_school_role(school_id, array['owner','admin']));
create policy product_policy_member_select on public.service_product_policy_selections for select to authenticated using (public.is_school_member(school_id));
create policy product_policy_admin_manage on public.service_product_policy_selections for all to authenticated using (public.has_school_role(school_id, array['owner','admin'])) with check (public.has_school_role(school_id, array['owner','admin']));
create policy school_documents_admin_manage on public.school_documents for all to authenticated using (public.has_school_role(school_id, array['owner','admin'])) with check (public.has_school_role(school_id, array['owner','admin']));

-- Rule rows inherit access through their version without duplicating school_id.
create policy cancellation_rules_member_select on public.cancellation_policy_rules for select to authenticated using (exists (select 1 from public.school_policy_versions version where version.id = policy_version_id and public.is_school_member(version.school_id)));
create policy cancellation_rules_admin_manage on public.cancellation_policy_rules for all to authenticated using (exists (select 1 from public.school_policy_versions version where version.id = policy_version_id and public.has_school_role(version.school_id, array['owner','admin']))) with check (exists (select 1 from public.school_policy_versions version where version.id = policy_version_id and public.has_school_role(version.school_id, array['owner','admin'])));
create policy payment_rules_member_select on public.payment_policy_rules for select to authenticated using (exists (select 1 from public.school_policy_versions version where version.id = policy_version_id and public.is_school_member(version.school_id)));
create policy payment_rules_admin_manage on public.payment_policy_rules for all to authenticated using (exists (select 1 from public.school_policy_versions version where version.id = policy_version_id and public.has_school_role(version.school_id, array['owner','admin']))) with check (exists (select 1 from public.school_policy_versions version where version.id = policy_version_id and public.has_school_role(version.school_id, array['owner','admin'])));

grant select, insert, update, delete on public.school_policies, public.school_policy_versions, public.cancellation_policy_rules, public.payment_policy_rules, public.service_product_policy_selections, public.school_documents to authenticated;
