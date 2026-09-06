do $$
declare projection_count bigint; registry_count bigint; trigger_count integer;
begin
  select
    (select count(*) from public.email_deliveries where provider_email_id is not null)+
    (select count(*) from public.owner_notification_email_outbox where provider_email_id is not null)+
    (select count(*) from public.lesson_created_email_outbox where provider_email_id is not null)+
    (select count(*) from public.lesson_request_email_outbox where provider_email_id is not null)+
    (select count(*) from public.teacher_invitation_deliveries where provider_email_id is not null)+
    (select count(*) from public.lesson_proposal_email_outbox where provider_email_id is not null)
  into projection_count;
  select count(*) into registry_count from public.email_delivery_registry;
  if projection_count<>registry_count then
    raise exception 'email_delivery_registry_backfill_mismatch: projections %, registry %',projection_count,registry_count;
  end if;

  if exists(
    select 1 from public.email_delivery_events event
    join public.email_delivery_registry registry
      on registry.provider=event.provider and registry.provider_email_id=event.provider_email_id
    where event.registry_id is distinct from registry.id
  ) then raise exception 'email_delivery_event_registry_link_missing'; end if;

  select count(*) into trigger_count from pg_catalog.pg_trigger trigger_row
  where not trigger_row.tgisinternal
    and trigger_row.tgfoid='public.register_email_delivery_projection()'::regprocedure;
  if trigger_count<>6 then raise exception 'email_delivery_registration_trigger_count: %',trigger_count; end if;
  if (select count(*) from public.email_delivery_source_types)<>6 then
    raise exception 'email_delivery_source_catalog_incomplete';
  end if;
  if has_table_privilege('authenticated','public.email_delivery_registry','INSERT')
    or has_table_privilege('authenticated','public.email_delivery_registry','UPDATE')
    or has_table_privilege('authenticated','public.email_delivery_registry','DELETE')
    or has_function_privilege('authenticated','public.apply_registered_email_delivery_status(uuid,text,timestamptz)','EXECUTE')
  then raise exception 'email_delivery_registry_mutation_exposed'; end if;
end $$;
