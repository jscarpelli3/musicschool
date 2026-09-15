drop function public.create_onboarding_student_and_payer(uuid,text,text,text,text,text,uuid,text);
drop function public.create_student_and_payer(uuid,text,text,text,text,text,uuid,text);

create function public.create_student_and_payer(
 p_school_id uuid,p_student_first_name text,p_student_last_name text,
 p_payer_first_name text,p_payer_last_name text,p_payer_email text,p_payer_profile_id uuid,
 p_relationship text default 'parent',p_operation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();student_id uuid;payer_id uuid;account_id uuid;existing_result jsonb;normalized_payer_email text:=lower(trim(p_payer_email));
begin
 if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized';end if;
 perform pg_advisory_xact_lock(hashtextextended('student-payer-operation:'||p_school_id::text||':'||p_operation_id::text,0));
 select jsonb_build_object('student_id',entity_id,'billing_account_id',metadata->>'billing_account_id') into existing_result
 from public.audit_log where school_id=p_school_id and actor_profile_id=actor_id and action='school.student_and_payer_created' and metadata->>'operation_id'=p_operation_id::text order by created_at desc limit 1;
 if existing_result is not null then return existing_result;end if;
 if length(trim(p_student_first_name)) not between 1 and 80 or length(trim(p_student_last_name)) not between 1 and 80
  or length(trim(p_payer_first_name)) not between 1 and 80 or length(trim(p_payer_last_name)) not between 1 and 80
  or normalized_payer_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_payer_email)>320
  or length(trim(p_relationship)) not between 1 and 40 then raise exception 'invalid_family_details';end if;
 if not exists(select 1 from auth.users auth_user where auth_user.id=p_payer_profile_id and lower(auth_user.email)=normalized_payer_email) then raise exception 'payer_identity_mismatch';end if;
 insert into public.profiles(id,email) select id,email from auth.users where id=p_payer_profile_id on conflict(id) do nothing;
 insert into public.people(school_id,first_name,last_name) values(p_school_id,trim(p_student_first_name),trim(p_student_last_name)) returning id into student_id;
 insert into public.students(person_id,school_id) values(student_id,p_school_id);
 insert into public.people(school_id,profile_id,first_name,last_name,email)
 values(p_school_id,p_payer_profile_id,trim(p_payer_first_name),trim(p_payer_last_name),normalized_payer_email)
 on conflict(school_id,profile_id) do update set email=excluded.email returning id into payer_id;
 perform 1 from public.people where id=payer_id for update;
 insert into public.student_contacts(school_id,student_id,contact_person_id,relationship,is_primary,is_billing_contact) values(p_school_id,student_id,payer_id,trim(p_relationship),true,true);
 select id into account_id from public.billing_accounts where school_id=p_school_id and billing_contact_person_id=payer_id and status='active' order by created_at limit 1;
 if account_id is null then insert into public.billing_accounts(school_id,billing_contact_person_id,name) values(p_school_id,payer_id,trim(p_student_last_name)||' family') returning id into account_id;end if;
 insert into public.billing_account_students(school_id,billing_account_id,student_id) values(p_school_id,account_id,student_id);
 insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor_id,'school.student_and_payer_created','student',student_id,jsonb_build_object('billing_account_id',account_id,'payer_person_id',payer_id,'operation_id',p_operation_id));
 return jsonb_build_object('student_id',student_id,'billing_account_id',account_id);
end;$$;

revoke all on function public.create_student_and_payer(uuid,text,text,text,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.create_student_and_payer(uuid,text,text,text,text,text,uuid,text,uuid) to authenticated;

create function public.create_onboarding_student_and_payer(
 p_school_id uuid,p_student_first_name text,p_student_last_name text,
 p_payer_first_name text,p_payer_last_name text,p_payer_email text,p_payer_profile_id uuid,
 p_relationship text default 'parent'
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized';end if;
 if exists(select 1 from public.students where school_id=p_school_id) then raise exception 'first_student_already_exists';end if;
 return public.create_student_and_payer(p_school_id,p_student_first_name,p_student_last_name,p_payer_first_name,p_payer_last_name,p_payer_email,p_payer_profile_id,p_relationship,gen_random_uuid());
end;$$;

revoke all on function public.create_onboarding_student_and_payer(uuid,text,text,text,text,text,uuid,text) from public,anon;
grant execute on function public.create_onboarding_student_and_payer(uuid,text,text,text,text,text,uuid,text) to authenticated;

do $$
declare signature regprocedure:='public.create_student_and_payer(uuid,text,text,text,text,text,uuid,text,uuid)'::regprocedure;
declare onboarding_signature regprocedure:='public.create_onboarding_student_and_payer(uuid,text,text,text,text,text,uuid,text)'::regprocedure;
begin
 if has_function_privilege('anon',signature,'execute') or has_function_privilege('public',signature,'execute') then raise exception 'idempotent student creation is publicly executable';end if;
 if position('pg_advisory_xact_lock' in pg_get_functiondef(signature))=0 or position('operation_id' in pg_get_functiondef(signature))=0 then raise exception 'student creation idempotency guard missing';end if;
 if has_function_privilege('anon',onboarding_signature,'execute') or has_function_privilege('public',onboarding_signature,'execute') then raise exception 'onboarding student creation is publicly executable';end if;
end;$$;
