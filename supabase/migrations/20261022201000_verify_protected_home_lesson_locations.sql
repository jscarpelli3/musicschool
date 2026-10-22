do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lesson_places' and column_name = 'kind'
  ) then raise exception 'lesson place kind is missing'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.lesson_events'::regclass
      and tgname = 'lesson_events_require_student_home_location'
      and not tgisinternal
  ) then raise exception 'home lesson enforcement trigger is missing'; end if;

  if not (select relrowsecurity from pg_class where oid = 'public.family_service_locations'::regclass) then
    raise exception 'family service locations must have row security enabled';
  end if;

  if has_table_privilege('anon', 'public.family_service_locations', 'select')
    or has_table_privilege('anon', 'public.service_location_access_log', 'select') then
    raise exception 'anonymous address access must remain denied';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_service_locations'
      and coalesce(qual, '') like '%school.billing.manage%'
  ) then raise exception 'family service location management policy is missing'; end if;
end
$$;
