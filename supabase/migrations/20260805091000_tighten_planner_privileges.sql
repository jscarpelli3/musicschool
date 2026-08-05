-- Keep tenant, identity, creator, and currency columns immutable from clients.

revoke update on public.service_products from authenticated;
grant update (
  name,
  description,
  format,
  duration_minutes,
  sessions_per_interval,
  interval_count,
  interval_unit,
  pricing_model,
  price_cents,
  capacity,
  status
) on public.service_products to authenticated;

revoke update on public.teacher_availability_rules from authenticated;
grant update (
  weekday,
  start_time,
  end_time,
  effective_from,
  effective_until
) on public.teacher_availability_rules to authenticated;

revoke update on public.lesson_events from authenticated;
grant update (
  product_id,
  teacher_id,
  student_id,
  starts_at,
  ends_at,
  status,
  notes
) on public.lesson_events to authenticated;
