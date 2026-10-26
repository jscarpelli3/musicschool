do $$
declare
  queue_definition text;
  route_definition text;
begin
  select pg_get_functiondef('public.queue_lesson_created_communications()'::regprocedure)
    into queue_definition;
  select pg_get_functiondef('public.normalize_owner_notification_href()'::regprocedure)
    into route_definition;

  if position('duration_minutes' in queue_definition)=0
    or position('occurrence_count' in queue_definition)=0
    or position('teacher_email_status' in queue_definition)=0
    or position('first_event_id' in queue_definition)=0
  then
    raise exception 'lesson_created_notification_context_missing';
  end if;

  if position('?lesson=' in route_definition)=0
    or position('/approvals?request=' in route_definition)=0
    or position('/approvals?proposal=' in route_definition)=0
    or position('?period=' in route_definition)=0
  then
    raise exception 'owner_notification_context_routing_missing';
  end if;

  if not exists(
    select 1 from pg_trigger
    where tgrelid='public.owner_notifications'::regclass
      and tgname='owner_notifications_normalize_href'
      and not tgisinternal
  ) then
    raise exception 'owner_notification_context_routing_trigger_missing';
  end if;
end;
$$;
