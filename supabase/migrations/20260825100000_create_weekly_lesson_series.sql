create or replace function public.create_weekly_lesson_series(
  p_school_id uuid,
  p_product_id uuid,
  p_teacher_id uuid,
  p_student_id uuid,
  p_place_id uuid,
  p_local_start timestamp without time zone,
  p_ends_on date,
  p_notes text default null,
  p_allow_outside_availability boolean default false,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  school_row public.schools%rowtype;
  product_row public.service_products%rowtype;
  local_date date := p_local_start::date;
  local_time time := p_local_start::time;
  occurrence_date date;
  occurrence_start timestamptz;
  occurrence_end timestamptz;
  occurrence_count integer := 0;
  series_id uuid;
begin
  if actor_id is null or not public.has_school_role(p_school_id,array['owner','admin']) then raise exception 'not_authorized'; end if;
  if p_ends_on < local_date or p_ends_on > local_date + 371 then raise exception 'invalid_recurrence_end'; end if;
  if p_allow_outside_availability and nullif(trim(p_override_reason),'') is null then raise exception 'override_reason_required'; end if;

  select * into school_row from public.schools where id=p_school_id;
  select * into product_row from public.service_products where school_id=p_school_id and id=p_product_id and status='active';
  if school_row.id is null or product_row.id is null then raise exception 'invalid_school_or_offering'; end if;
  if product_row.format <> 'private_lesson' then raise exception 'group_class_requires_roster'; end if;
  if not exists(select 1 from public.teachers where school_id=p_school_id and person_id=p_teacher_id) then raise exception 'invalid_teacher'; end if;
  if not exists(select 1 from public.students where school_id=p_school_id and person_id=p_student_id and enrollment_status in ('active','prospect')) then raise exception 'invalid_student'; end if;
  if not exists(select 1 from public.lesson_places where school_id=p_school_id and id=p_place_id and status='active') then raise exception 'invalid_place'; end if;
  if (p_local_start at time zone school_row.timezone) <= now()-interval '1 day' then raise exception 'lesson_too_far_in_past'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text,0));
  for occurrence_date in select generate_series(local_date,p_ends_on,interval '7 days')::date loop
    occurrence_count := occurrence_count + 1;
    occurrence_start := (occurrence_date + local_time) at time zone school_row.timezone;
    occurrence_end := (occurrence_date + local_time + make_interval(mins=>product_row.duration_minutes)) at time zone school_row.timezone;
    if not p_allow_outside_availability and not exists(
      select 1 from public.teacher_availability_rules rule where rule.school_id=p_school_id and rule.teacher_id=p_teacher_id
        and rule.weekday=extract(dow from occurrence_date)::integer and rule.effective_from<=occurrence_date
        and (rule.effective_until is null or rule.effective_until>=occurrence_date)
        and rule.start_time<=local_time and rule.end_time>=(local_time+make_interval(mins=>product_row.duration_minutes))::time
    ) then raise exception 'outside_teacher_availability'; end if;
    if exists(select 1 from public.lesson_events event where event.school_id=p_school_id and event.teacher_id=p_teacher_id
      and event.status not in ('cancelled','rescheduled') and tstzrange(event.starts_at,event.ends_at,'[)')&&tstzrange(occurrence_start,occurrence_end,'[)'))
      then raise exception 'teacher_conflict'; end if;
    if exists(select 1 from public.lesson_events event where event.school_id=p_school_id and event.student_id=p_student_id
      and event.status not in ('cancelled','rescheduled') and tstzrange(event.starts_at,event.ends_at,'[)')&&tstzrange(occurrence_start,occurrence_end,'[)'))
      then raise exception 'student_conflict'; end if;
  end loop;

  insert into public.lesson_series(school_id,product_id,teacher_id,student_id,default_place_id,recurrence_rule,starts_on,ends_on,status,created_by)
  values(p_school_id,p_product_id,p_teacher_id,p_student_id,p_place_id,
    jsonb_build_object('frequency','weekly','interval',1,'weekday',extract(dow from local_date)::integer,'local_time',to_char(local_time,'HH24:MI')),
    local_date,p_ends_on,'active',actor_id) returning id into series_id;

  insert into public.lesson_series_billing_terms(
    school_id,lesson_series_id,source_product_id,billing_mode,billing_timing,amount_cents,currency,offering_name,effective_from,effective_until,created_by
  ) values(
    p_school_id,series_id,product_row.id,product_row.pricing_model,coalesce(product_row.billing_timing_override,school_row.billing_timing_default),
    product_row.price_cents,product_row.currency,product_row.name,local_date,p_ends_on,actor_id
  );

  for occurrence_date in select generate_series(local_date,p_ends_on,interval '7 days')::date loop
    occurrence_start := (occurrence_date + local_time) at time zone school_row.timezone;
    occurrence_end := (occurrence_date + local_time + make_interval(mins=>product_row.duration_minutes)) at time zone school_row.timezone;
    insert into public.lesson_events(school_id,product_id,teacher_id,student_id,place_id,starts_at,ends_at,status,notes,lesson_series_id,is_series_exception,created_by)
    values(p_school_id,p_product_id,p_teacher_id,p_student_id,p_place_id,occurrence_start,occurrence_end,'scheduled',nullif(trim(p_notes),''),series_id,false,actor_id);
  end loop;

  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'lesson_series.created','lesson_series',series_id,jsonb_build_object('frequency','weekly','occurrence_count',occurrence_count,'ends_on',p_ends_on,'outside_availability_override',p_allow_outside_availability));
  return jsonb_build_object('series_id',series_id,'occurrence_count',occurrence_count);
end;
$$;

revoke all on function public.create_weekly_lesson_series(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text) from public,anon;
grant execute on function public.create_weekly_lesson_series(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text) to authenticated;
