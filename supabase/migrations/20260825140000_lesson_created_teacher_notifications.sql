alter table public.owner_notifications drop constraint owner_notifications_kind_check;
alter table public.owner_notifications add constraint owner_notifications_kind_check
  check (kind in (
    'payer_approved',
    'payer_rejected',
    'payment_failed',
    'lesson_change_requested',
    'teacher_rescheduled',
    'teacher_reschedule_requested',
    'lesson_created'
  ));

create table public.lesson_created_email_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  teacher_id uuid not null,
  entity_type text not null check (entity_type in ('lesson_event','lesson_series')),
  entity_id uuid not null,
  recipient_email text not null,
  subject text not null,
  message_text text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in (
    'pending','submitting','accepted','sent','delivered','delayed','failed',
    'bounced','complained','suppressed','reconciliation_required'
  )),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  provider_email_id text unique,
  provider_error_code text,
  provider_error_message text,
  claimed_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id,teacher_id) references public.teachers(school_id,person_id) on delete restrict
);

create index lesson_created_email_outbox_pending_idx
  on public.lesson_created_email_outbox(status,created_at);
alter table public.lesson_created_email_outbox enable row level security;
create policy lesson_created_email_outbox_management_select
  on public.lesson_created_email_outbox for select to authenticated
  using (public.has_school_role(school_id,array['owner','admin']));
grant select on public.lesson_created_email_outbox to authenticated;
revoke insert,update,delete on public.lesson_created_email_outbox from public,anon,authenticated;

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
  school_timezone text;
  occurrence_count integer := 1;
  title_text text;
  message_text_value text;
  recipient record;
begin
  if new.action not in ('lesson.created','lesson_series.created') then return new; end if;

  if new.entity_type='lesson_event' then
    select event.teacher_id,event.starts_at,product.name
      into teacher_id_value,starts_at_value,product_name
    from public.lesson_events event
    join public.service_products product on product.school_id=event.school_id and product.id=event.product_id
    where event.school_id=new.school_id and event.id=new.entity_id;
  elsif new.entity_type='lesson_series' then
    select series.teacher_id,min(event.starts_at),product.name,count(event.id)::integer
      into teacher_id_value,starts_at_value,product_name,occurrence_count
    from public.lesson_series series
    join public.service_products product on product.school_id=series.school_id and product.id=series.product_id
    join public.lesson_events event on event.school_id=series.school_id and event.lesson_series_id=series.id
    where series.school_id=new.school_id and series.id=new.entity_id
    group by series.teacher_id,product.name;
  else
    return new;
  end if;

  select lower(trim(person.email)),coalesce(nullif(trim(person.preferred_name),''),trim(person.first_name))||' '||trim(person.last_name)
    into teacher_email,teacher_name
  from public.people person
  where person.school_id=new.school_id and person.id=teacher_id_value and person.status='active';
  if teacher_email is null or teacher_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'teacher_email_required';
  end if;

  select school.name,school.timezone into school_name,school_timezone
  from public.schools school where school.id=new.school_id;
  select coalesce(nullif(trim(person.preferred_name),''),trim(person.first_name))||' '||trim(person.last_name)
    into student_name
  from public.people person
  join public.lesson_events event on event.school_id=person.school_id and event.student_id=person.id
  where event.school_id=new.school_id
    and (event.id=new.entity_id or event.lesson_series_id=new.entity_id)
  order by event.starts_at limit 1;

  title_text := case when new.entity_type='lesson_series'
    then occurrence_count||' weekly lessons added for '||student_name
    else 'New lesson added for '||student_name end;
  message_text_value := 'Hi '||teacher_name||', '||school_name||' added '
    ||case when new.entity_type='lesson_series' then occurrence_count||' weekly ' else 'a ' end
    ||product_name||' lesson'||case when new.entity_type='lesson_series' then 's' else '' end
    ||' with '||student_name||', beginning '
    ||to_char(starts_at_value at time zone school_timezone,'FMDay, FMMonth DD, YYYY at FMHH12:MI AM')
    ||'. Sign in to Common Time to view your schedule.';

  insert into public.lesson_created_email_outbox(
    school_id,teacher_id,entity_type,entity_id,recipient_email,subject,message_text,idempotency_key
  ) values (
    new.school_id,teacher_id_value,new.entity_type,new.entity_id,teacher_email,title_text,message_text_value,
    'lesson-created/'||new.entity_type||'/'||new.entity_id
  ) on conflict(idempotency_key) do nothing;

  for recipient in
    select member.profile_id from public.school_members member
    where member.school_id=new.school_id and member.status='active' and member.role in ('owner','admin')
  loop
    insert into public.owner_notifications(
      school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata
    ) values (
      new.school_id,recipient.profile_id,'lesson_created',title_text,
      'The calendar was updated. The teacher notification is queued for delivery.',
      '/schools/'||new.school_id||'/staff/'||teacher_id_value,
      'lesson-created:'||new.entity_type||':'||new.entity_id,new.entity_type,new.entity_id,
      jsonb_build_object('teacher_id',teacher_id_value,'student_name',student_name,'starts_at',starts_at_value)
    ) on conflict(recipient_profile_id,dedupe_key) do nothing;
  end loop;
  return new;
end;
$$;

create trigger audit_log_queue_lesson_created_communications
after insert on public.audit_log
for each row execute function public.queue_lesson_created_communications();

create or replace function public.claim_lesson_created_email(p_entity_type text,p_entity_id uuid)
returns table(
  id uuid,recipient_email text,subject text,message_text text,idempotency_key text,school_name text
)
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  return query
  update public.lesson_created_email_outbox outbox
  set status='submitting',attempt_count=outbox.attempt_count+1,claimed_at=now(),updated_at=now(),
      provider_error_code=null,provider_error_message=null
  from public.schools school
  where outbox.school_id=school.id and outbox.entity_type=p_entity_type and outbox.entity_id=p_entity_id
    and outbox.status='pending' and outbox.attempt_count<5
  returning outbox.id,outbox.recipient_email,outbox.subject,outbox.message_text,outbox.idempotency_key,school.name;
end;
$$;

create or replace function public.record_lesson_created_email_submission(
  p_delivery_id uuid,p_provider_email_id text default null,p_error_code text default null,p_error_message text default null
)
returns text
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  if p_provider_email_id is not null then
    update public.lesson_created_email_outbox set status='accepted',provider_email_id=p_provider_email_id,
      accepted_at=now(),updated_at=now() where id=p_delivery_id and status='submitting';
  else
    update public.lesson_created_email_outbox set status='failed',provider_error_code=coalesce(p_error_code,'request_failed'),
      provider_error_message=left(coalesce(p_error_message,'Provider request failed.'),500),failed_at=now(),updated_at=now()
    where id=p_delivery_id and status='submitting';
  end if;
  if not found then raise exception 'delivery_transition_failed'; end if;
  return case when p_provider_email_id is null then 'failed' else 'accepted' end;
end;
$$;

create or replace function public.mark_lesson_created_email_reconciliation_required(
  p_delivery_id uuid,p_error_message text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  update public.lesson_created_email_outbox set status='reconciliation_required',
    provider_error_code='provider_outcome_unknown',provider_error_message=left(p_error_message,500),updated_at=now()
  where id=p_delivery_id and status='submitting';
  if not found then raise exception 'delivery_transition_failed'; end if;
end;
$$;

revoke all on function public.queue_lesson_created_communications() from public,anon,authenticated;
revoke all on function public.claim_lesson_created_email(text,uuid) from public,anon,authenticated;
revoke all on function public.record_lesson_created_email_submission(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.mark_lesson_created_email_reconciliation_required(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_lesson_created_email(text,uuid) to service_role;
grant execute on function public.record_lesson_created_email_submission(uuid,text,text,text) to service_role;
grant execute on function public.mark_lesson_created_email_reconciliation_required(uuid,text) to service_role;
