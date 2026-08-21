create table public.teacher_invitation_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid not null,
  recipient_profile_id uuid not null references public.profiles(id) on delete restrict,
  recipient_email text not null,
  status text not null default 'pending' check(status in ('pending','accepted','failed')),
  idempotency_key text not null unique,
  provider_email_id text unique,
  provider_error_code text,
  provider_error_message text,
  accepted_at timestamptz,
  failed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(school_id,teacher_id) references public.teachers(school_id,person_id) on delete restrict
);
create index teacher_invitation_deliveries_teacher_idx on public.teacher_invitation_deliveries(school_id,teacher_id,created_at desc);
alter table public.teacher_invitation_deliveries enable row level security;
create policy teacher_invitation_deliveries_owner_select on public.teacher_invitation_deliveries for select to authenticated using(public.has_school_role(school_id,array['owner']));
grant select on public.teacher_invitation_deliveries to authenticated;

create or replace function public.create_teacher_record(
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_default_lesson_minutes integer default 30
)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); teacher_id uuid; clean_email text:=lower(trim(p_email));
begin
  if actor_id is null or not public.has_school_role(p_school_id,array['owner']) then raise exception 'not_authorized'; end if;
  if length(trim(p_first_name)) not between 1 and 80 or length(trim(p_last_name)) not between 1 and 80 then raise exception 'invalid_teacher_name'; end if;
  if clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(clean_email)>320 then raise exception 'invalid_email'; end if;
  if p_default_lesson_minutes not between 15 and 240 then raise exception 'invalid_default_lesson_minutes'; end if;
  if exists(select 1 from public.people person join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id where person.school_id=p_school_id and lower(trim(person.email))=clean_email) then raise exception 'duplicate_teacher_email'; end if;
  insert into public.people(school_id,first_name,last_name,email) values(p_school_id,trim(p_first_name),trim(p_last_name),clean_email) returning id into teacher_id;
  insert into public.teachers(school_id,person_id,default_lesson_minutes) values(p_school_id,teacher_id,p_default_lesson_minutes);
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor_id,'teacher.created','teacher',teacher_id,jsonb_build_object('default_lesson_minutes',p_default_lesson_minutes));
  return teacher_id;
end $$;

create or replace function public.prepare_teacher_invitation(
  p_school_id uuid,
  p_teacher_id uuid,
  p_profile_id uuid,
  p_email text
)
returns table(delivery_id uuid,recipient_email text,idempotency_key text,school_name text,teacher_name text)
language plpgsql
security definer
set search_path=''
as $$
declare actor_id uuid:=auth.uid(); clean_email text:=lower(trim(p_email)); old_profile_id uuid; current_member public.school_members%rowtype; new_delivery_id uuid;
begin
  if actor_id is null or not public.has_school_role(p_school_id,array['owner']) then raise exception 'not_authorized'; end if;
  if clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(clean_email)>320 then raise exception 'invalid_email'; end if;
  if not exists(select 1 from auth.users where id=p_profile_id and lower(email)=clean_email) then raise exception 'auth_identity_mismatch'; end if;
  if exists(select 1 from public.people person join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id where person.school_id=p_school_id and person.id<>p_teacher_id and lower(trim(person.email))=clean_email) then raise exception 'duplicate_teacher_email'; end if;

  select person.profile_id into old_profile_id from public.people person
  join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id
  where person.school_id=p_school_id and person.id=p_teacher_id for update of person;
  if not found then raise exception 'teacher_not_found'; end if;
  if exists(select 1 from public.people where school_id=p_school_id and profile_id=p_profile_id and id<>p_teacher_id) then raise exception 'profile_already_linked_in_school'; end if;
  select * into current_member from public.school_members where school_id=p_school_id and profile_id=p_profile_id;
  if current_member.id is not null and current_member.role<>'teacher' then raise exception 'profile_has_non_teacher_role'; end if;

  if old_profile_id is not null and old_profile_id<>p_profile_id then
    update public.school_members set status='inactive' where school_id=p_school_id and profile_id=old_profile_id and role='teacher';
  end if;
  update public.people set profile_id=p_profile_id,email=clean_email where school_id=p_school_id and id=p_teacher_id;
  insert into public.school_members(school_id,profile_id,role,status,invited_by)
  values(p_school_id,p_profile_id,'teacher','invited',actor_id)
  on conflict(school_id,profile_id) do update set status=case when public.school_members.status='active' then 'active' else 'invited' end,invited_by=actor_id;

  insert into public.teacher_invitation_deliveries(school_id,teacher_id,recipient_profile_id,recipient_email,idempotency_key,created_by)
  values(p_school_id,p_teacher_id,p_profile_id,clean_email,'teacher-invite/'||gen_random_uuid(),actor_id)
  returning id into new_delivery_id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'teacher.invitation_prepared','teacher',p_teacher_id,jsonb_build_object('delivery_id',new_delivery_id,'identity_changed',old_profile_id is distinct from p_profile_id));

  return query select new_delivery_id,clean_email,delivery.idempotency_key,school.name,coalesce(person.preferred_name,person.first_name)||' '||person.last_name
  from public.teacher_invitation_deliveries delivery join public.schools school on school.id=delivery.school_id join public.people person on person.school_id=delivery.school_id and person.id=delivery.teacher_id
  where delivery.id=new_delivery_id;
end;
$$;

create or replace function public.activate_my_teacher_memberships()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.school_members member set status='active',joined_at=coalesce(member.joined_at,now())
  where member.profile_id=auth.uid() and member.role='teacher' and member.status='invited'
    and exists(select 1 from public.people person join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id where person.school_id=member.school_id and person.profile_id=auth.uid() and person.status='active');
  get diagnostics changed=row_count;
  return changed;
end;
$$;

create or replace function public.deactivate_teacher_access(p_school_id uuid,p_teacher_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); target_profile_id uuid;
begin
  if actor_id is null or not public.has_school_role(p_school_id,array['owner']) then raise exception 'not_authorized'; end if;
  select profile_id into target_profile_id from public.people where school_id=p_school_id and id=p_teacher_id;
  if target_profile_id is null then raise exception 'teacher_identity_not_linked'; end if;
  update public.school_members set status='inactive' where school_id=p_school_id and profile_id=target_profile_id and role='teacher';
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor_id,'teacher.access_deactivated','teacher',p_teacher_id,'{}');
end $$;

revoke all on table public.teacher_invitation_deliveries from public,anon;
revoke insert,update,delete on public.teacher_invitation_deliveries from authenticated;
revoke all on function public.prepare_teacher_invitation(uuid,uuid,uuid,text) from public,anon;
revoke all on function public.create_teacher_record(uuid,text,text,text,integer) from public,anon;
revoke all on function public.activate_my_teacher_memberships() from public,anon;
revoke all on function public.deactivate_teacher_access(uuid,uuid) from public,anon;
grant execute on function public.prepare_teacher_invitation(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.create_teacher_record(uuid,text,text,text,integer) to authenticated;
grant execute on function public.activate_my_teacher_memberships() to authenticated;
grant execute on function public.deactivate_teacher_access(uuid,uuid) to authenticated;
