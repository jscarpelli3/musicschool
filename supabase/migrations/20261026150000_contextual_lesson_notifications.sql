-- Make lesson notifications useful as a durable activity record. The lesson,
-- rather than the teacher directory entry, is the destination.

create or replace function public.normalize_owner_notification_href()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  first_event_id uuid;
  billing_account_id_value uuid;
  billing_period_id_value uuid;
begin
  if new.entity_type='lesson_event' then
    new.href:='/schools/'||new.school_id||'?lesson='||new.entity_id||'#school-calendar';
  elsif new.entity_type='lesson_series' then
    select event.id into first_event_id
    from public.lesson_events event
    where event.school_id=new.school_id and event.lesson_series_id=new.entity_id
    order by event.starts_at,event.id limit 1;
    if first_event_id is not null then
      new.href:='/schools/'||new.school_id||'?lesson='||first_event_id||'#school-calendar';
    end if;
  elsif new.entity_type='lesson_change_request' then
    new.href:='/schools/'||new.school_id||'/approvals?request='||new.entity_id;
  elsif new.entity_type='lesson_schedule_proposal' then
    new.href:='/schools/'||new.school_id||'/approvals?proposal='||new.entity_id;
  elsif new.entity_type='billing_approval_request' then
    select request.billing_account_id,request.billing_period_id
      into billing_account_id_value,billing_period_id_value
    from public.billing_approval_requests request
    where request.school_id=new.school_id and request.id=new.entity_id;
    if billing_account_id_value is not null and billing_period_id_value is not null then
      new.href:='/schools/'||new.school_id||'/families/'||billing_account_id_value
        ||'?period='||billing_period_id_value||'#billing-history';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists owner_notifications_normalize_href on public.owner_notifications;
create trigger owner_notifications_normalize_href
before insert or update of entity_type,entity_id,href on public.owner_notifications
for each row execute function public.normalize_owner_notification_href();

revoke all on function public.normalize_owner_notification_href() from public,anon,authenticated;

create or replace function public.queue_lesson_created_communications()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  teacher_id_value uuid;
  teacher_email text;
  teacher_name text;
  student_name text;
  school_name text;
  product_name text;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  first_event_id uuid;
  school_timezone text;
  occurrence_count integer := 1;
  duration_minutes integer;
  title_text text;
  email_message text;
  owner_message text;
  schedule_label text;
  recipient record;
begin
  if new.action not in ('lesson.created','lesson_series.created') then return new; end if;

  if new.entity_type='lesson_event' then
    select event.teacher_id,event.starts_at,event.ends_at,event.id,product.name
      into teacher_id_value,starts_at_value,ends_at_value,first_event_id,product_name
    from public.lesson_events event
    join public.service_products product on product.school_id=event.school_id and product.id=event.product_id
    where event.school_id=new.school_id and event.id=new.entity_id;
  elsif new.entity_type='lesson_series' then
    select series.teacher_id,event.starts_at,event.ends_at,event.id,product.name,counts.occurrence_count
      into teacher_id_value,starts_at_value,ends_at_value,first_event_id,product_name,occurrence_count
    from public.lesson_series series
    join public.service_products product on product.school_id=series.school_id and product.id=series.product_id
    join lateral (
      select count(*)::integer occurrence_count
      from public.lesson_events counted
      where counted.school_id=series.school_id and counted.lesson_series_id=series.id
    ) counts on true
    join lateral (
      select occurrence.id,occurrence.starts_at,occurrence.ends_at
      from public.lesson_events occurrence
      where occurrence.school_id=series.school_id and occurrence.lesson_series_id=series.id
      order by occurrence.starts_at,occurrence.id limit 1
    ) event on true
    where series.school_id=new.school_id and series.id=new.entity_id;
  else
    return new;
  end if;

  if first_event_id is null then return new; end if;
  duration_minutes:=round(extract(epoch from (ends_at_value-starts_at_value))/60)::integer;

  select lower(trim(person.email)),trim(concat_ws(' ',coalesce(nullif(trim(person.preferred_name),''),nullif(trim(person.first_name),'')),nullif(trim(person.last_name),'')))
    into teacher_email,teacher_name
  from public.people person
  where person.school_id=new.school_id and person.id=teacher_id_value and person.status='active';
  if teacher_email is null or teacher_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'teacher_email_required';
  end if;

  select school.name,school.timezone into school_name,school_timezone
  from public.schools school where school.id=new.school_id;
  select trim(concat_ws(' ',coalesce(nullif(trim(person.preferred_name),''),nullif(trim(person.first_name),'')),nullif(trim(person.last_name),'')))
    into student_name
  from public.people person
  join public.lesson_events event on event.school_id=person.school_id and event.student_id=person.id
  where event.school_id=new.school_id and event.id=first_event_id;

  title_text:=case when new.entity_type='lesson_series'
    then 'Weekly lessons added for '||student_name
    else 'New lesson added for '||student_name end;
  schedule_label:=case when new.entity_type='lesson_series'
    then 'Weekly series · '||occurrence_count||' lessons currently scheduled'
    else 'One-time lesson' end;

  email_message:='Hi '||teacher_name||', '||school_name||' added '
    ||case when new.entity_type='lesson_series' then 'weekly ' else 'a ' end
    ||product_name||' with '||student_name||', beginning '
    ||to_char(starts_at_value at time zone school_timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')
    ||'. Sign in to Common Time to view your schedule.';
  owner_message:=student_name||' with '||teacher_name||' · '||product_name||' · '
    ||duration_minutes||' minutes · '
    ||to_char(starts_at_value at time zone school_timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')
    ||'. '||schedule_label||'. Added to the calendar. Teacher email queued.';

  insert into public.lesson_created_email_outbox(
    school_id,teacher_id,entity_type,entity_id,recipient_email,subject,message_text,idempotency_key
  ) values (
    new.school_id,teacher_id_value,new.entity_type,new.entity_id,teacher_email,title_text,email_message,
    'lesson-created/'||new.entity_type||'/'||new.entity_id
  ) on conflict(idempotency_key) do nothing;

  for recipient in
    select member.profile_id from public.school_members member
    where member.school_id=new.school_id and member.status='active' and member.role in ('owner','admin')
  loop
    insert into public.owner_notifications(
      school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata
    ) values (
      new.school_id,recipient.profile_id,'lesson_created',title_text,owner_message,
      '/schools/'||new.school_id||'?lesson='||first_event_id||'#school-calendar',
      'lesson-created:'||new.entity_type||':'||new.entity_id,new.entity_type,new.entity_id,
      jsonb_build_object(
        'teacher_id',teacher_id_value,'teacher_name',teacher_name,'student_name',student_name,
        'product_name',product_name,'starts_at',starts_at_value,'ends_at',ends_at_value,
        'duration_minutes',duration_minutes,'occurrence_count',occurrence_count,
        'schedule_kind',case when new.entity_type='lesson_series' then 'weekly_series' else 'one_time' end,
        'first_event_id',first_event_id,'teacher_email_status','queued'
      )
    ) on conflict(recipient_profile_id,dedupe_key) do nothing;
  end loop;
  return new;
end;
$$;

revoke all on function public.queue_lesson_created_communications() from public,anon,authenticated;

-- Repair destinations on the existing activity record without rewriting what
-- the application told the user at the time.
update public.owner_notifications notice
set href='/schools/'||notice.school_id||'?lesson='||notice.entity_id||'#school-calendar'
where notice.entity_type='lesson_event';

update public.owner_notifications notice
set href='/schools/'||notice.school_id||'/approvals?request='||notice.entity_id
where notice.entity_type='lesson_change_request';

update public.owner_notifications notice
set href='/schools/'||notice.school_id||'/approvals?proposal='||notice.entity_id
where notice.entity_type='lesson_schedule_proposal';

update public.owner_notifications notice
set href='/schools/'||notice.school_id||'/families/'||request.billing_account_id
  ||'?period='||request.billing_period_id||'#billing-history'
from public.billing_approval_requests request
where notice.entity_type='billing_approval_request'
  and request.school_id=notice.school_id and request.id=notice.entity_id;

update public.owner_notifications notice
set href='/schools/'||notice.school_id||'?lesson='||(
  select occurrence.id
  from public.lesson_events occurrence
  where occurrence.school_id=notice.school_id and occurrence.lesson_series_id=notice.entity_id
  order by occurrence.starts_at,occurrence.id limit 1
)||'#school-calendar'
where notice.entity_type='lesson_series'
  and exists(
    select 1 from public.lesson_events occurrence
    where occurrence.school_id=notice.school_id and occurrence.lesson_series_id=notice.entity_id
  );
