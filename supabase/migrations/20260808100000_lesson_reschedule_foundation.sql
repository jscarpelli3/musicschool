-- A reschedule moves one occurrence while preserving its identity, original
-- billing month, price snapshot, and an immutable before/after history.

alter table public.lesson_event_price_snapshots
  disable trigger lesson_event_price_snapshots_guard;

alter table public.lesson_event_price_snapshots
  add column billing_service_date date;

update public.lesson_event_price_snapshots snapshot
set billing_service_date = (event.starts_at at time zone school.timezone)::date
from public.lesson_events event
join public.schools school on school.id = event.school_id
where event.id = snapshot.lesson_event_id
  and event.school_id = snapshot.school_id;

alter table public.lesson_event_price_snapshots
  alter column billing_service_date set not null;

alter table public.lesson_event_price_snapshots
  enable trigger lesson_event_price_snapshots_guard;

comment on column public.lesson_event_price_snapshots.billing_service_date is
  'Immutable service date used to select the financial month. Operational rescheduling never moves this billing anchor.';

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
  select timezone into strict school_timezone
  from public.schools where id = new.school_id;
  local_service_date := (new.starts_at at time zone school_timezone)::date;

  if new.lesson_series_id is null then
    if product_row.pricing_model <> 'per_session' then
      raise exception 'standalone_lesson_requires_per_session_price';
    end if;

    insert into public.lesson_event_price_snapshots (
      school_id, lesson_event_id, source_product_id, billing_mode,
      amount_cents, currency, offering_name, billing_service_date
    ) values (
      new.school_id, new.id, product_row.id, 'per_session',
      product_row.price_cents, product_row.currency, product_row.name,
      local_service_date
    );
    return new;
  end if;

  select * into term_row
  from public.lesson_series_billing_terms term
  where term.school_id = new.school_id
    and term.lesson_series_id = new.lesson_series_id
    and term.effective_from <= local_service_date
    and (term.effective_until is null or term.effective_until >= local_service_date)
  order by term.effective_from desc
  limit 1;

  if not found then raise exception 'lesson_series_missing_effective_billing_terms'; end if;
  if term_row.source_product_id <> new.product_id then
    raise exception 'lesson_event_product_does_not_match_billing_terms';
  end if;

  insert into public.lesson_event_price_snapshots (
    school_id, lesson_event_id, source_product_id, series_billing_terms_id,
    billing_mode, amount_cents, currency, offering_name, billing_service_date
  ) values (
    new.school_id, new.id, term_row.source_product_id, term_row.id,
    term_row.billing_mode, term_row.amount_cents, term_row.currency,
    term_row.offering_name, local_service_date
  );
  return new;
end;
$$;

create table public.lesson_event_changes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  lesson_event_id uuid not null,
  change_type text not null check (change_type in ('rescheduled', 'cancelled', 'restored', 'administrative')),
  previous_values jsonb not null,
  new_values jsonb not null,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  actor_role text not null check (actor_role in ('owner', 'admin', 'teacher', 'staff', 'guardian', 'student', 'system')),
  source text not null check (source in ('calendar', 'lesson_detail', 'client_portal', 'system')),
  reason text not null check (length(trim(reason)) between 1 and 500),
  policy_version_id uuid references public.school_policy_versions(id) on delete restrict,
  policy_result text not null,
  counted_toward_self_service_limit boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, lesson_event_id)
    references public.lesson_events(school_id, id) on delete restrict
);

create index lesson_event_changes_event_created_idx
  on public.lesson_event_changes(school_id, lesson_event_id, created_at desc);

create or replace function public.guard_lesson_event_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Lesson event change history is immutable';
end;
$$;

create trigger lesson_event_changes_guard
before update or delete on public.lesson_event_changes
for each row execute function public.guard_lesson_event_change();

alter table public.lesson_event_changes enable row level security;
create policy lesson_event_changes_member_select
on public.lesson_event_changes for select to authenticated
using (public.is_school_member(school_id));
grant select on public.lesson_event_changes to authenticated;

create or replace function public.reschedule_lesson_as_owner(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_teacher_id uuid,
  p_place_id uuid,
  p_local_start timestamp without time zone,
  p_source text,
  p_reason text,
  p_allow_outside_availability boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  event_row public.lesson_events%rowtype;
  school_timezone text;
  local_day date := p_local_start::date;
  local_start_time time := p_local_start::time;
  local_weekday integer := extract(dow from p_local_start)::integer;
  duration interval;
  local_end timestamp without time zone;
  starts_at_utc timestamptz;
  ends_at_utc timestamptz;
  effective_policy_version_id uuid;
  previous_values jsonb;
  new_values jsonb;
begin
  select role into actor_role
  from public.school_members
  where school_id = p_school_id and profile_id = actor_id
    and status = 'active' and role in ('owner','admin');
  if actor_id is null or actor_role is null then raise exception 'not_authorized'; end if;
  if p_source not in ('calendar', 'lesson_detail') then raise exception 'invalid_reschedule_source'; end if;
  if nullif(trim(p_reason), '') is null or length(trim(p_reason)) > 500 then
    raise exception 'reschedule_reason_required';
  end if;
  if p_allow_outside_availability and length(trim(p_reason)) < 4 then
    raise exception 'override_reason_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text || ':' || p_lesson_event_id::text, 0));
  select * into event_row from public.lesson_events
  where school_id = p_school_id and id = p_lesson_event_id for update;
  if not found then raise exception 'lesson_not_found'; end if;
  if event_row.status <> 'scheduled' then raise exception 'lesson_is_not_reschedulable'; end if;
  if event_row.starts_at <= now() then raise exception 'past_lesson_is_not_reschedulable'; end if;

  select timezone into school_timezone from public.schools where id = p_school_id;
  if school_timezone is null then raise exception 'school_not_found'; end if;
  if not exists (
    select 1 from public.teachers
    where school_id = p_school_id and person_id = p_teacher_id
  ) then raise exception 'invalid_teacher'; end if;
  if not exists (
    select 1 from public.lesson_places
    where school_id = p_school_id and id = p_place_id and status = 'active'
  ) then raise exception 'invalid_place'; end if;

  duration := event_row.ends_at - event_row.starts_at;
  local_end := p_local_start + duration;
  starts_at_utc := p_local_start at time zone school_timezone;
  ends_at_utc := local_end at time zone school_timezone;
  if starts_at_utc <= now() then raise exception 'new_lesson_time_must_be_future'; end if;

  if not p_allow_outside_availability and not exists (
    select 1 from public.teacher_availability_rules rule
    where rule.school_id = p_school_id
      and rule.teacher_id = p_teacher_id
      and rule.weekday = local_weekday
      and rule.effective_from <= local_day
      and (rule.effective_until is null or rule.effective_until >= local_day)
      and rule.start_time <= local_start_time
      and rule.end_time >= local_end::time
  ) then raise exception 'outside_teacher_availability'; end if;

  if exists (
    select 1 from public.lesson_events conflict
    where conflict.school_id = p_school_id
      and conflict.id <> event_row.id
      and conflict.teacher_id = p_teacher_id
      and conflict.status not in ('cancelled','rescheduled')
      and tstzrange(conflict.starts_at, conflict.ends_at, '[)') && tstzrange(starts_at_utc, ends_at_utc, '[)')
  ) then raise exception 'teacher_conflict'; end if;
  if exists (
    select 1 from public.lesson_events conflict
    where conflict.school_id = p_school_id
      and conflict.id <> event_row.id
      and conflict.student_id = event_row.student_id
      and conflict.status not in ('cancelled','rescheduled')
      and tstzrange(conflict.starts_at, conflict.ends_at, '[)') && tstzrange(starts_at_utc, ends_at_utc, '[)')
  ) then raise exception 'student_conflict'; end if;

  select version.id into effective_policy_version_id
  from public.school_policies policy
  join public.school_policy_versions version
    on version.school_id = policy.school_id and version.policy_id = policy.id
  where policy.school_id = p_school_id and policy.kind = 'cancellation'
    and policy.status = 'active'
    and policy.id = coalesce(
      (select selection.policy_id from public.service_product_policy_selections selection
       where selection.school_id = p_school_id and selection.product_id = event_row.product_id
         and selection.policy_kind = 'cancellation' and not selection.use_school_default),
      (select default_policy.id from public.school_policies default_policy
       where default_policy.school_id = p_school_id and default_policy.kind = 'cancellation'
         and default_policy.status = 'active' and default_policy.is_default)
    )
    and version.published_at is not null
    and coalesce(version.effective_from, version.published_at) <= event_row.starts_at
  order by coalesce(version.effective_from, version.published_at) desc, version.version_number desc
  limit 1;

  previous_values := jsonb_build_object(
    'teacher_id', event_row.teacher_id, 'place_id', event_row.place_id,
    'starts_at', event_row.starts_at, 'ends_at', event_row.ends_at
  );
  new_values := jsonb_build_object(
    'teacher_id', p_teacher_id, 'place_id', p_place_id,
    'starts_at', starts_at_utc, 'ends_at', ends_at_utc
  );
  if previous_values = new_values then raise exception 'lesson_time_is_unchanged'; end if;

  update public.lesson_events set
    teacher_id = p_teacher_id,
    place_id = p_place_id,
    starts_at = starts_at_utc,
    ends_at = ends_at_utc,
    is_series_exception = true,
    exception_reason = 'Rescheduled: ' || trim(p_reason)
  where id = event_row.id;

  insert into public.lesson_event_changes (
    school_id, lesson_event_id, change_type, previous_values, new_values,
    actor_profile_id, actor_role, source, reason, policy_version_id,
    policy_result, counted_toward_self_service_limit
  ) values (
    p_school_id, event_row.id, 'rescheduled', previous_values, new_values,
    actor_id, actor_role, p_source, trim(p_reason), effective_policy_version_id,
    case when p_allow_outside_availability then 'owner_availability_override' else 'owner_rescheduled' end,
    false
  );

  insert into public.audit_log (
    school_id, actor_profile_id, action, entity_type, entity_id, metadata
  ) values (
    p_school_id, actor_id, 'lesson.rescheduled', 'lesson_event', event_row.id,
    jsonb_build_object('source', p_source, 'teacher_changed', event_row.teacher_id <> p_teacher_id,
      'availability_override', p_allow_outside_availability)
  );

  return jsonb_build_object(
    'lesson_event_id', event_row.id,
    'starts_at', starts_at_utc,
    'ends_at', ends_at_utc,
    'teacher_id', p_teacher_id,
    'place_id', p_place_id
  );
end;
$$;

revoke all on function public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,boolean) from public, anon;
grant execute on function public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,boolean) to authenticated;

comment on function public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,boolean) is
  'Atomically validates and moves one future scheduled occurrence while preserving price, billing month, identity, and immutable history.';
