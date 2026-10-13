create function public.create_payer_for_existing_student(
  p_school_id uuid,
  p_student_id uuid,
  p_payer_first_name text,
  p_payer_last_name text,
  p_payer_email text,
  p_payer_profile_id uuid,
  p_relationship text default 'parent',
  p_operation_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := auth.uid();
  payer_id uuid;
  account_id uuid;
  student_last_name text;
  normalized_email text := lower(trim(p_payer_email));
  existing_result jsonb;
begin
  if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended('existing-student-payer:'||p_school_id::text||':'||p_operation_id::text,0));
  select metadata into existing_result from public.audit_log
    where school_id=p_school_id and actor_profile_id=actor_id and action='school.payer_connected_to_student'
      and metadata->>'operation_id'=p_operation_id::text order by created_at desc limit 1;
  if existing_result is not null then return existing_result; end if;
  select person.last_name into student_last_name from public.students student
    join public.people person on person.school_id=student.school_id and person.id=student.person_id
    where student.school_id=p_school_id and student.person_id=p_student_id and student.enrollment_status='active';
  if student_last_name is null then raise exception 'student_not_available'; end if;
  if exists(select 1 from public.billing_account_students where school_id=p_school_id and student_id=p_student_id) then raise exception 'student_already_has_payer'; end if;
  if length(trim(p_payer_first_name)) not between 1 and 80 or length(trim(p_payer_last_name)) not between 1 and 80
    or normalized_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_email)>320
    or length(trim(p_relationship)) not between 1 and 40 then raise exception 'invalid_family_details'; end if;
  if not exists(select 1 from auth.users where id=p_payer_profile_id and lower(email)=normalized_email) then raise exception 'payer_identity_mismatch'; end if;
  insert into public.profiles(id,email) select id,email from auth.users where id=p_payer_profile_id on conflict(id) do nothing;
  insert into public.people(school_id,profile_id,first_name,last_name,email)
    values(p_school_id,p_payer_profile_id,trim(p_payer_first_name),trim(p_payer_last_name),normalized_email)
    on conflict(school_id,profile_id) do update set email=excluded.email returning id into payer_id;
  insert into public.student_contacts(school_id,student_id,contact_person_id,relationship,is_primary,is_billing_contact)
    values(p_school_id,p_student_id,payer_id,trim(p_relationship),true,true)
    on conflict(student_id,contact_person_id) do update set relationship=excluded.relationship,is_primary=true,is_billing_contact=true;
  select id into account_id from public.billing_accounts where school_id=p_school_id and billing_contact_person_id=payer_id and status='active' order by created_at limit 1;
  if account_id is null then
    insert into public.billing_accounts(school_id,billing_contact_person_id,name) values(p_school_id,payer_id,trim(student_last_name)||' family') returning id into account_id;
  end if;
  insert into public.billing_account_students(school_id,billing_account_id,student_id) values(p_school_id,account_id,p_student_id);
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
    values(p_school_id,actor_id,'school.payer_connected_to_student','student',p_student_id,jsonb_build_object('student_id',p_student_id,'billing_account_id',account_id,'payer_person_id',payer_id,'operation_id',p_operation_id));
  return jsonb_build_object('student_id',p_student_id,'billing_account_id',account_id,'payer_person_id',payer_id,'operation_id',p_operation_id);
end;
$$;

revoke all on function public.create_payer_for_existing_student(uuid,uuid,text,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.create_payer_for_existing_student(uuid,uuid,text,text,text,uuid,text,uuid) to authenticated;
