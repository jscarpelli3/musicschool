alter table public.schools add column onboarding_completed_at timestamptz;

create function public.create_onboarding_student_and_payer(
 p_school_id uuid,p_student_first_name text,p_student_last_name text,
 p_payer_first_name text,p_payer_last_name text,p_payer_email text,p_payer_profile_id uuid,
 p_relationship text default 'parent'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();student_id uuid;payer_id uuid;account_id uuid;normalized_payer_email text:=lower(trim(p_payer_email));
begin
 if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized';end if;
 if exists(select 1 from public.students where school_id=p_school_id) then raise exception 'first_student_already_exists';end if;
 if length(trim(p_student_first_name)) not between 1 and 80 or length(trim(p_student_last_name)) not between 1 and 80
  or length(trim(p_payer_first_name)) not between 1 and 80 or length(trim(p_payer_last_name)) not between 1 and 80
  or normalized_payer_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_payer_email)>320
  or length(trim(p_relationship)) not between 1 and 40 then raise exception 'invalid_family_details';end if;
 if not exists(select 1 from auth.users auth_user where auth_user.id=p_payer_profile_id and lower(auth_user.email)=normalized_payer_email) then raise exception 'payer_identity_mismatch';end if;
 insert into public.profiles(id,email) select id,email from auth.users where id=p_payer_profile_id on conflict(id) do nothing;
 insert into public.people(school_id,first_name,last_name) values(p_school_id,trim(p_student_first_name),trim(p_student_last_name)) returning id into student_id;
 insert into public.students(person_id,school_id) values(student_id,p_school_id);
 insert into public.people(school_id,profile_id,first_name,last_name,email) values(p_school_id,p_payer_profile_id,trim(p_payer_first_name),trim(p_payer_last_name),normalized_payer_email) returning id into payer_id;
 insert into public.student_contacts(school_id,student_id,contact_person_id,relationship,is_primary,is_billing_contact) values(p_school_id,student_id,payer_id,trim(p_relationship),true,true);
 insert into public.billing_accounts(school_id,billing_contact_person_id,name) values(p_school_id,payer_id,trim(p_student_last_name)||' family') returning id into account_id;
 insert into public.billing_account_students(school_id,billing_account_id,student_id) values(p_school_id,account_id,student_id);
 insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor_id,'onboarding.first_family_created','student',student_id,jsonb_build_object('billing_account_id',account_id,'payer_person_id',payer_id));
 return jsonb_build_object('student_id',student_id,'billing_account_id',account_id);
end;$$;
revoke all on function public.create_onboarding_student_and_payer(uuid,text,text,text,text,text,uuid,text) from public,anon;
grant execute on function public.create_onboarding_student_and_payer(uuid,text,text,text,text,text,uuid,text) to authenticated;

create function public.complete_school_onboarding(p_school_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();begin
 if actor_id is null or not public.has_school_capability(p_school_id,'school.setup.manage') then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.students where school_id=p_school_id) then raise exception 'first_student_required';end if;
 update public.schools set onboarding_completed_at=coalesce(onboarding_completed_at,now()) where id=p_school_id;
 insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor_id,'school.onboarding_completed','school',p_school_id,'{}');
end;$$;
revoke all on function public.complete_school_onboarding(uuid) from public,anon;
grant execute on function public.complete_school_onboarding(uuid) to authenticated;
