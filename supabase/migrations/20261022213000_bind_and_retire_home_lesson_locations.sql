-- Bind every newly scheduled home lesson to one specific protected location.
-- Existing home lessons are backfilled only when there is exactly one possible
-- active location; ambiguous historical rows remain null and cannot reveal an
-- address until management deliberately reschedules/repairs them.

alter table public.lesson_events
  add column service_location_id uuid;

alter table public.lesson_events
  add constraint lesson_events_school_service_location_fkey
  foreign key (school_id, service_location_id)
  references public.family_service_locations(school_id, id) on delete restrict;

with candidates as (
  select event.id as event_id, (array_agg(location.id order by location.id))[1] as location_id
  from public.lesson_events event
  join public.lesson_places place
    on place.school_id = event.school_id and place.id = event.place_id and place.kind = 'student_home'
  join public.billing_account_students link
    on link.school_id = event.school_id and link.student_id = event.student_id
  join public.family_service_locations location
    on location.school_id = link.school_id
   and location.billing_account_id = link.billing_account_id
   and location.status = 'active'
  where event.service_location_id is null
  group by event.id
  having count(*) = 1
)
update public.lesson_events event set service_location_id = candidate.location_id
from candidates candidate
where event.id = candidate.event_id;

drop trigger if exists lesson_events_require_student_home_location on public.lesson_events;
drop function if exists public.enforce_student_home_location();

create function public.enforce_student_home_location()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  place_kind text;
  possible_count integer;
  resolved_location_id uuid;
begin
  select place.kind into place_kind
  from public.lesson_places place
  where place.school_id = new.school_id and place.id = new.place_id and place.status = 'active';

  if place_kind <> 'student_home' then
    new.service_location_id := null;
    return new;
  end if;

  if new.service_location_id is not null then
    if not exists (
      select 1
      from public.family_service_locations location
      join public.billing_account_students link
        on link.school_id = location.school_id
       and link.billing_account_id = location.billing_account_id
      where location.school_id = new.school_id
        and location.id = new.service_location_id
        and link.student_id = new.student_id
        and (location.status = 'active' or (tg_op = 'UPDATE' and new.service_location_id is not distinct from old.service_location_id))
    ) then raise exception 'invalid_student_home_location'; end if;
    return new;
  end if;

  select count(*), min(location.id)
    into possible_count, resolved_location_id
  from public.billing_account_students link
  join public.family_service_locations location
    on location.school_id = link.school_id
   and location.billing_account_id = link.billing_account_id
   and location.status = 'active'
  where link.school_id = new.school_id and link.student_id = new.student_id;

  if possible_count = 0 then raise exception 'student_home_location_required'; end if;
  if possible_count > 1 then raise exception 'student_home_location_ambiguous'; end if;
  new.service_location_id := resolved_location_id;
  return new;
end
$$;

create trigger lesson_events_require_student_home_location
before insert or update of school_id, student_id, place_id, service_location_id on public.lesson_events
for each row execute function public.enforce_student_home_location();

-- Shared place details are visible to school members. A student-home place must
-- therefore never carry the private address itself.
update public.lesson_places set details = null where kind = 'student_home' and details is not null;
alter table public.lesson_places
  add constraint lesson_places_student_home_details_private
  check (kind <> 'student_home' or details is null);

-- Archived rows may be scrubbed while their non-sensitive identity remains for
-- lesson history and reveal-audit foreign keys.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.family_service_locations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%mode%stored%address_line_1%'
  loop
    execute format('alter table public.family_service_locations drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.family_service_locations
  add constraint family_service_locations_address_shape check (
    (status = 'archived' and address_line_1 is null and address_line_2 is null
      and city is null and region is null and postal_code is null and access_notes is null)
    or
    (status = 'active' and mode = 'stored' and length(trim(address_line_1)) between 1 and 160
      and length(trim(city)) between 1 and 120 and length(trim(region)) between 1 and 120
      and length(trim(postal_code)) between 1 and 24)
    or
    (status = 'active' and mode = 'arranged_privately' and address_line_1 is null
      and address_line_2 is null and city is null and region is null
      and postal_code is null and access_notes is null)
  );

alter table public.service_location_access_log
  alter column lesson_event_id drop not null;

alter table public.service_location_access_log
  add constraint service_location_access_log_context check (
    (purpose = 'assigned_lesson' and lesson_event_id is not null)
    or (purpose = 'management_review')
  );

create function public.retire_family_service_location(p_school_id uuid, p_billing_account_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); location_id uuid;
begin
  if actor is null or not public.has_school_capability(p_school_id, 'school.billing.manage') then
    raise exception 'not_authorized';
  end if;
  select id into location_id from public.family_service_locations
  where school_id = p_school_id and billing_account_id = p_billing_account_id and status = 'active'
  for update;
  if location_id is null then return 'already_removed'; end if;
  if exists (
    select 1 from public.lesson_events
    where school_id = p_school_id and service_location_id = location_id
      and status = 'scheduled' and ends_at > now()
  ) then raise exception 'home_lessons_pending'; end if;
  update public.family_service_locations set
    status = 'archived', address_line_1 = null, address_line_2 = null,
    city = null, region = null, postal_code = null, access_notes = null
  where school_id = p_school_id and id = location_id;
  insert into public.audit_log(school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values(p_school_id, actor, 'family.service_location_retired', 'family_service_location', location_id,
    jsonb_build_object('billing_account_id', p_billing_account_id, 'personal_details_scrubbed', true));
  return 'removed';
end $$;

revoke all on function public.retire_family_service_location(uuid,uuid) from public, anon;
grant execute on function public.retire_family_service_location(uuid,uuid) to authenticated;
