alter table public.people drop constraint if exists people_first_name_check;
alter table public.people drop constraint if exists people_last_name_check;
alter table public.people add constraint people_first_name_check check(length(trim(first_name))<=80);
alter table public.people add constraint people_last_name_check check(length(trim(last_name))<=80);
alter table public.people add constraint people_has_name_check check(length(trim(first_name||' '||last_name)) between 1 and 161);

create or replace function public.create_student_and_payer(
 p_school_id uuid,p_student_first_name text,p_student_last_name text,
 p_payer_first_name text,p_payer_last_name text,p_payer_email text,p_payer_profile_id uuid,
 p_relationship text default 'parent',p_operation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();student_id uuid;payer_id uuid;account_id uuid;existing_result jsonb;normalized_payer_email text:=lower(trim(p_payer_email));student_family_name text;
begin
 if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized';end if;
 perform pg_advisory_xact_lock(hashtextextended('student-payer-operation:'||p_school_id::text||':'||p_operation_id::text,0));
 select jsonb_build_object('student_id',entity_id,'billing_account_id',metadata->>'billing_account_id') into existing_result
 from public.audit_log where school_id=p_school_id and actor_profile_id=actor_id and action='school.student_and_payer_created' and metadata->>'operation_id'=p_operation_id::text order by created_at desc limit 1;
 if existing_result is not null then return existing_result;end if;
 if length(trim(coalesce(p_student_first_name,'')||' '||coalesce(p_student_last_name,''))) not between 1 and 161
  or length(trim(coalesce(p_payer_first_name,'')||' '||coalesce(p_payer_last_name,''))) not between 1 and 161
  or length(trim(coalesce(p_student_first_name,'')))>80 or length(trim(coalesce(p_student_last_name,'')))>80
  or length(trim(coalesce(p_payer_first_name,'')))>80 or length(trim(coalesce(p_payer_last_name,'')))>80
  or normalized_payer_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_payer_email)>320
  or length(trim(p_relationship)) not between 1 and 40 then raise exception 'invalid_family_details';end if;
 if not exists(select 1 from auth.users auth_user where auth_user.id=p_payer_profile_id and lower(auth_user.email)=normalized_payer_email) then raise exception 'payer_identity_mismatch';end if;
 insert into public.profiles(id,email) select id,email from auth.users where id=p_payer_profile_id on conflict(id) do nothing;
 insert into public.people(school_id,first_name,last_name) values(p_school_id,trim(coalesce(p_student_first_name,'')),trim(coalesce(p_student_last_name,''))) returning id into student_id;
 insert into public.students(person_id,school_id) values(student_id,p_school_id);
 insert into public.people(school_id,profile_id,first_name,last_name,email)
 values(p_school_id,p_payer_profile_id,trim(coalesce(p_payer_first_name,'')),trim(coalesce(p_payer_last_name,'')),normalized_payer_email)
 on conflict(school_id,profile_id) do update set email=excluded.email returning id into payer_id;
 perform 1 from public.people where id=payer_id for update;
 insert into public.student_contacts(school_id,student_id,contact_person_id,relationship,is_primary,is_billing_contact) values(p_school_id,student_id,payer_id,trim(p_relationship),true,true);
 select id into account_id from public.billing_accounts where school_id=p_school_id and billing_contact_person_id=payer_id and status='active' order by created_at limit 1;
 student_family_name:=coalesce(nullif(trim(p_student_last_name),''),nullif(trim(p_student_first_name),''),'Student');
 if account_id is null then insert into public.billing_accounts(school_id,billing_contact_person_id,name) values(p_school_id,payer_id,student_family_name||' family') returning id into account_id;end if;
 insert into public.billing_account_students(school_id,billing_account_id,student_id) values(p_school_id,account_id,student_id);
 insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor_id,'school.student_and_payer_created','student',student_id,jsonb_build_object('billing_account_id',account_id,'payer_person_id',payer_id,'operation_id',p_operation_id));
 return jsonb_build_object('student_id',student_id,'billing_account_id',account_id);
end;$$;

revoke all on function public.create_student_and_payer(uuid,text,text,text,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.create_student_and_payer(uuid,text,text,text,text,text,uuid,text,uuid) to authenticated;

create or replace function public.create_payer_for_existing_student(
  p_school_id uuid,p_student_id uuid,p_payer_first_name text,p_payer_last_name text,
  p_payer_email text,p_payer_profile_id uuid,p_relationship text default 'parent',p_operation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();payer_id uuid;account_id uuid;student_family_name text;normalized_email text:=lower(trim(p_payer_email));existing_result jsonb;
begin
  if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized';end if;
  perform pg_advisory_xact_lock(hashtextextended('existing-student-payer:'||p_school_id::text||':'||p_operation_id::text,0));
  select metadata into existing_result from public.audit_log where school_id=p_school_id and actor_profile_id=actor_id and action='school.payer_connected_to_student' and metadata->>'operation_id'=p_operation_id::text order by created_at desc limit 1;
  if existing_result is not null then return existing_result;end if;
  select coalesce(nullif(trim(person.last_name),''),nullif(trim(person.first_name),'')) into student_family_name
  from public.students student join public.people person on person.school_id=student.school_id and person.id=student.person_id
  where student.school_id=p_school_id and student.person_id=p_student_id and student.enrollment_status='active';
  if student_family_name is null then raise exception 'student_not_available';end if;
  if exists(select 1 from public.billing_account_students where school_id=p_school_id and student_id=p_student_id) then raise exception 'student_already_has_payer';end if;
  if length(trim(coalesce(p_payer_first_name,'')||' '||coalesce(p_payer_last_name,''))) not between 1 and 161
    or length(trim(coalesce(p_payer_first_name,'')))>80 or length(trim(coalesce(p_payer_last_name,'')))>80
    or normalized_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_email)>320
    or length(trim(p_relationship)) not between 1 and 40 then raise exception 'invalid_family_details';end if;
  if not exists(select 1 from auth.users where id=p_payer_profile_id and lower(email)=normalized_email) then raise exception 'payer_identity_mismatch';end if;
  insert into public.profiles(id,email) select id,email from auth.users where id=p_payer_profile_id on conflict(id) do nothing;
  insert into public.people(school_id,profile_id,first_name,last_name,email)
  values(p_school_id,p_payer_profile_id,trim(coalesce(p_payer_first_name,'')),trim(coalesce(p_payer_last_name,'')),normalized_email)
  on conflict(school_id,profile_id) do update set email=excluded.email returning id into payer_id;
  insert into public.student_contacts(school_id,student_id,contact_person_id,relationship,is_primary,is_billing_contact)
  values(p_school_id,p_student_id,payer_id,trim(p_relationship),true,true)
  on conflict(student_id,contact_person_id) do update set relationship=excluded.relationship,is_primary=true,is_billing_contact=true;
  select id into account_id from public.billing_accounts where school_id=p_school_id and billing_contact_person_id=payer_id and status='active' order by created_at limit 1;
  if account_id is null then insert into public.billing_accounts(school_id,billing_contact_person_id,name) values(p_school_id,payer_id,student_family_name||' family') returning id into account_id;end if;
  insert into public.billing_account_students(school_id,billing_account_id,student_id) values(p_school_id,account_id,p_student_id);
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'school.payer_connected_to_student','student',p_student_id,jsonb_build_object('student_id',p_student_id,'billing_account_id',account_id,'payer_person_id',payer_id,'operation_id',p_operation_id));
  return jsonb_build_object('student_id',p_student_id,'billing_account_id',account_id,'payer_person_id',payer_id,'operation_id',p_operation_id);
end $$;
revoke all on function public.create_payer_for_existing_student(uuid,uuid,text,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.create_payer_for_existing_student(uuid,uuid,text,text,text,uuid,text,uuid) to authenticated;

create or replace function public.update_student_record(
  p_school_id uuid,p_student_id uuid,p_first_name text,p_last_name text,p_preferred_name text,
  p_email text,p_phone text,p_birth_date date,p_enrollment_status text,p_notes text
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized';end if;
  if length(trim(coalesce(p_first_name,'')||' '||coalesce(p_last_name,''))) not between 1 and 161
    or length(trim(coalesce(p_first_name,'')))>80 or length(trim(coalesce(p_last_name,'')))>80
    or p_enrollment_status not in('prospect','active','paused','former') then raise exception 'invalid_student_details';end if;
  update public.people set first_name=trim(coalesce(p_first_name,'')),last_name=trim(coalesce(p_last_name,'')),
    preferred_name=nullif(trim(coalesce(p_preferred_name,'')),''),email=nullif(lower(trim(coalesce(p_email,''))),''),phone=nullif(trim(coalesce(p_phone,'')),'')
  where school_id=p_school_id and id=p_student_id;
  if not found then raise exception 'student_not_found';end if;
  update public.students set birth_date=p_birth_date,enrollment_status=p_enrollment_status,notes=nullif(trim(coalesce(p_notes,'')),'')
  where school_id=p_school_id and person_id=p_student_id;
  if not found then raise exception 'student_not_found';end if;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor,'school.student_record_updated','student',p_student_id,jsonb_build_object('enrollment_status',p_enrollment_status));
end $$;
revoke all on function public.update_student_record(uuid,uuid,text,text,text,text,text,date,text,text) from public,anon;
grant execute on function public.update_student_record(uuid,uuid,text,text,text,text,text,date,text,text) to authenticated;

create or replace function public.update_family_record(
  p_school_id uuid,p_billing_account_id uuid,p_first_name text,p_last_name text,p_account_name text
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();contact_id uuid;
begin
  if actor is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized';end if;
  if length(trim(coalesce(p_first_name,'')||' '||coalesce(p_last_name,''))) not between 1 and 161
    or length(trim(coalesce(p_first_name,'')))>80 or length(trim(coalesce(p_last_name,'')))>80
    or length(trim(p_account_name)) not between 1 and 120 then raise exception 'invalid_family_details';end if;
  select billing_contact_person_id into contact_id from public.billing_accounts where school_id=p_school_id and id=p_billing_account_id for update;
  if contact_id is null then raise exception 'family_not_found';end if;
  update public.people set first_name=trim(coalesce(p_first_name,'')),last_name=trim(coalesce(p_last_name,'')) where school_id=p_school_id and id=contact_id;
  update public.billing_accounts set name=trim(p_account_name) where school_id=p_school_id and id=p_billing_account_id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor,'school.family_record_updated','billing_account',p_billing_account_id,jsonb_build_object('billing_contact_person_id',contact_id));
end $$;
revoke all on function public.update_family_record(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.update_family_record(uuid,uuid,text,text,text) to authenticated;

create or replace function public.update_student_contact_relationship(
  p_school_id uuid,p_student_id uuid,p_contact_person_id uuid,p_relationship text
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized';end if;
  if length(trim(p_relationship)) not between 1 and 40 then raise exception 'invalid_relationship';end if;
  update public.student_contacts set relationship=trim(p_relationship)
  where school_id=p_school_id and student_id=p_student_id and contact_person_id=p_contact_person_id;
  if not found then raise exception 'contact_not_found';end if;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor,'school.student_contact_relationship_updated','student',p_student_id,jsonb_build_object('contact_person_id',p_contact_person_id,'relationship',trim(p_relationship)));
end $$;
revoke all on function public.update_student_contact_relationship(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.update_student_contact_relationship(uuid,uuid,uuid,text) to authenticated;
