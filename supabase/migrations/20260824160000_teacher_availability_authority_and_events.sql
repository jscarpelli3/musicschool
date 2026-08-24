alter table public.teachers
  add column scheduling_authority text not null default 'propose_only'
    check (scheduling_authority in ('propose_only','manage_assigned_lessons')),
  add column can_manage_own_availability boolean not null default true;

update public.teachers
set scheduling_authority=case when can_self_reschedule then 'manage_assigned_lessons' else 'propose_only' end;

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type text not null check (length(event_type) between 3 and 120),
  entity_type text not null check (length(entity_type) between 2 and 80),
  entity_id uuid not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  source text not null check (length(source) between 2 and 80),
  correlation_id uuid not null default gen_random_uuid(),
  causation_id uuid references public.domain_events(id),
  payload jsonb not null default '{}',
  check (jsonb_typeof(payload)='object')
);

create index domain_events_school_time_idx on public.domain_events(school_id,occurred_at desc,id);
create index domain_events_entity_idx on public.domain_events(school_id,entity_type,entity_id,occurred_at desc);
create index domain_events_correlation_idx on public.domain_events(correlation_id);

alter table public.domain_events enable row level security;
create policy domain_events_management_select on public.domain_events for select to authenticated
using (
  public.has_school_role(school_id,array['owner','admin'])
  or actor_profile_id=auth.uid()
);
grant select on public.domain_events to authenticated;
revoke insert,update,delete on public.domain_events from authenticated;

create or replace function public.reject_domain_event_mutation()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'domain_events_are_append_only'; end $$;
create trigger domain_events_reject_mutation before update or delete on public.domain_events
for each row execute function public.reject_domain_event_mutation();
revoke all on function public.reject_domain_event_mutation() from public,anon,authenticated;

create or replace function public.set_teacher_scheduling_settings(
  p_school_id uuid,
  p_teacher_id uuid,
  p_scheduling_authority text,
  p_can_manage_own_availability boolean
)
returns void language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_school_role text; old_settings jsonb;
begin
  if actor_id is null or not public.has_school_role(p_school_id,array['owner']) then raise exception 'not_authorized'; end if;
  if p_scheduling_authority not in ('propose_only','manage_assigned_lessons') then raise exception 'invalid_scheduling_authority'; end if;
  select jsonb_build_object('scheduling_authority',teacher.scheduling_authority,'can_manage_own_availability',teacher.can_manage_own_availability)
  into old_settings from public.teachers teacher where teacher.school_id=p_school_id and teacher.person_id=p_teacher_id for update;
  if old_settings is null then raise exception 'teacher_not_found'; end if;
  update public.teachers set scheduling_authority=p_scheduling_authority,
    can_manage_own_availability=p_can_manage_own_availability,
    can_self_reschedule=(p_scheduling_authority='manage_assigned_lessons')
  where school_id=p_school_id and person_id=p_teacher_id;
  select role into actor_school_role from public.school_members where school_id=p_school_id and profile_id=actor_id and status='active';
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'teacher.scheduling_settings_changed','teacher',p_teacher_id,actor_id,actor_school_role,'staff_settings',
    jsonb_build_object('before',old_settings,'after',jsonb_build_object('scheduling_authority',p_scheduling_authority,'can_manage_own_availability',p_can_manage_own_availability)));
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'teacher.scheduling_settings_changed','teacher',p_teacher_id,
    jsonb_build_object('scheduling_authority',p_scheduling_authority,'can_manage_own_availability',p_can_manage_own_availability));
end $$;

create or replace function public.replace_teacher_weekly_availability(
  p_school_id uuid,
  p_teacher_id uuid,
  p_blocks jsonb
)
returns void language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid();
  actor_school_role text;
  can_manage boolean:=false;
  effective_date date;
  previous_blocks jsonb;
begin
  if actor_id is null or jsonb_typeof(p_blocks)<>'array' or jsonb_array_length(p_blocks)>28 then raise exception 'invalid_availability'; end if;
  select role into actor_school_role from public.school_members where school_id=p_school_id and profile_id=actor_id and status='active';
  can_manage:=coalesce(actor_school_role in ('owner','admin'),false) or (actor_school_role='teacher' and exists(
    select 1 from public.teachers teacher join public.people person on person.school_id=teacher.school_id and person.id=teacher.person_id
    where teacher.school_id=p_school_id and teacher.person_id=p_teacher_id and person.profile_id=actor_id
      and person.status='active' and teacher.can_manage_own_availability
  ));
  if not can_manage then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.teachers where school_id=p_school_id and person_id=p_teacher_id) then raise exception 'teacher_not_found'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_blocks) block
    where (block->>'weekday') !~ '^[0-6]$'
      or (block->>'start_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (block->>'end_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (block->>'start_time')::time >= (block->>'end_time')::time
  ) then raise exception 'invalid_availability_block'; end if;

  select (now() at time zone school.timezone)::date into effective_date from public.schools school where school.id=p_school_id;
  select coalesce(jsonb_agg(jsonb_build_object('weekday',rule.weekday,'start_time',to_char(rule.start_time,'HH24:MI'),'end_time',to_char(rule.end_time,'HH24:MI'),'effective_from',rule.effective_from,'effective_until',rule.effective_until) order by rule.weekday,rule.start_time),'[]')
  into previous_blocks from public.teacher_availability_rules rule
  where rule.school_id=p_school_id and rule.teacher_id=p_teacher_id
    and rule.effective_from<=effective_date and (rule.effective_until is null or rule.effective_until>=effective_date);

  update public.teacher_availability_rules set effective_until=effective_date-1
  where school_id=p_school_id and teacher_id=p_teacher_id and effective_from<effective_date
    and (effective_until is null or effective_until>=effective_date);
  delete from public.teacher_availability_rules
  where school_id=p_school_id and teacher_id=p_teacher_id and effective_from>=effective_date;
  insert into public.teacher_availability_rules(school_id,teacher_id,weekday,start_time,end_time,effective_from,created_by)
  select p_school_id,p_teacher_id,(block->>'weekday')::smallint,(block->>'start_time')::time,(block->>'end_time')::time,effective_date,actor_id
  from jsonb_array_elements(p_blocks) block;

  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'teacher.availability_replaced','teacher',p_teacher_id,actor_id,actor_school_role,'availability_editor',
    jsonb_build_object('effective_from',effective_date,'before',previous_blocks,'after',p_blocks));
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'teacher.availability_replaced','teacher',p_teacher_id,jsonb_build_object('effective_from',effective_date,'block_count',jsonb_array_length(p_blocks)));
end $$;

revoke all on function public.set_teacher_scheduling_settings(uuid,uuid,text,boolean) from public,anon;
revoke all on function public.replace_teacher_weekly_availability(uuid,uuid,jsonb) from public,anon;
grant execute on function public.set_teacher_scheduling_settings(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.replace_teacher_weekly_availability(uuid,uuid,jsonb) to authenticated;
