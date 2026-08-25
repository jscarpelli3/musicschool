alter table public.teachers add column outside_availability_policy text not null default 'notify_only'
  check (outside_availability_policy in ('notify_only','require_approval'));

create or replace function public.queue_teacher_lesson_created_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare teacher_profile_id uuid; starts_at_value timestamptz; ends_at_value timestamptz; school_timezone text; outside_block boolean; notice_message text;
begin
  select person.profile_id into teacher_profile_id from public.people person
  where person.school_id=new.school_id and person.id=new.teacher_id and person.status='active';
  if teacher_profile_id is null then return new; end if;
  select school.timezone into school_timezone from public.schools school where school.id=new.school_id;
  if new.entity_type='lesson_event' then
    select event.starts_at,event.ends_at into starts_at_value,ends_at_value from public.lesson_events event
    where event.school_id=new.school_id and event.id=new.entity_id;
  else
    select min(event.starts_at),min(event.ends_at) into starts_at_value,ends_at_value from public.lesson_events event
    where event.school_id=new.school_id and event.lesson_series_id=new.entity_id;
  end if;
  outside_block:=not exists(
    select 1 from public.teacher_availability_rules rule
    where rule.school_id=new.school_id and rule.teacher_id=new.teacher_id
      and rule.weekday=extract(dow from starts_at_value at time zone school_timezone)::integer
      and rule.effective_from<=(starts_at_value at time zone school_timezone)::date
      and (rule.effective_until is null or rule.effective_until>=(starts_at_value at time zone school_timezone)::date)
      and rule.start_time<=(starts_at_value at time zone school_timezone)::time
      and rule.end_time>=(ends_at_value at time zone school_timezone)::time
  );
  notice_message:=case when outside_block
    then 'This lesson is outside your saved availability. It has been placed on your schedule; review the time and contact the school if it needs attention.'
    else 'A new lesson was added to your schedule.' end;
  insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
  values(new.school_id,teacher_profile_id,'lesson_created',new.subject,notice_message,
    '/schools/'||new.school_id||'/teacher','teacher-lesson-created:'||new.entity_type||':'||new.entity_id,
    new.entity_type,new.entity_id,jsonb_build_object('teacher_id',new.teacher_id,'starts_at',starts_at_value,'outside_availability',outside_block))
  on conflict(recipient_profile_id,dedupe_key) do nothing;
  return new;
end $$;

create trigger lesson_created_outbox_queue_teacher_notification after insert on public.lesson_created_email_outbox
for each row execute function public.queue_teacher_lesson_created_notification();
revoke all on function public.queue_teacher_lesson_created_notification() from public,anon,authenticated;
