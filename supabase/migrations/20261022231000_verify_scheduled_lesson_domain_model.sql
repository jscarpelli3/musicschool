do $$
declare relation_name text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='service_products'
      and column_name in ('instrument_id','place_id','location_id')
  ) then
    raise exception 'Offerings must not own scheduling instrument or place data';
  end if;

  foreach relation_name in array array['lesson_events','lesson_series','lesson_schedule_proposals'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name=relation_name and column_name='instrument_id'
    ) then
      raise exception '%.instrument_id is missing', relation_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.lesson_events'::regclass and tgname='lesson_event_carry_series_instrument' and not tgisinternal
  ) then
    raise exception 'Recurring lesson occurrences do not inherit their series instrument';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.lesson_schedule_proposals'::regclass and tgname='lesson_proposal_apply_instrument' and not tgisinternal
  ) then
    raise exception 'Approved scheduling proposals do not carry their instrument to the calendar';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.schools'::regclass and tgname='schools_add_builtin_lesson_places' and not tgisinternal
  ) then
    raise exception 'New schools do not receive built-in Home and Online choices';
  end if;

  if has_function_privilege('authenticated','public.create_single_lesson(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text)','EXECUTE')
    or has_function_privilege('authenticated','public.create_weekly_lesson_series(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text)','EXECUTE')
    or has_function_privilege('authenticated','public.schedule_service_entitlement(uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text)','EXECUTE')
  then
    raise exception 'An instrument-free lesson creation boundary is still executable';
  end if;

  if not has_function_privilege('authenticated','public.create_single_lesson_with_instrument(uuid,uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.create_weekly_lesson_series_with_instrument(uuid,uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.schedule_service_entitlement_with_instrument(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text)','EXECUTE')
  then
    raise exception 'An instrument-aware lesson creation boundary is unavailable';
  end if;
end $$;
