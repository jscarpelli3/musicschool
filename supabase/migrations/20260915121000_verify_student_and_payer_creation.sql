do $$
declare generic_signature regprocedure:='public.create_student_and_payer(uuid,text,text,text,text,text,uuid,text)'::regprocedure;
declare onboarding_signature regprocedure:='public.create_onboarding_student_and_payer(uuid,text,text,text,text,text,uuid,text)'::regprocedure;
begin
 if has_function_privilege('anon',generic_signature,'execute') or has_function_privilege('public',generic_signature,'execute') then raise exception 'generic student creation is publicly executable';end if;
 if not has_function_privilege('authenticated',generic_signature,'execute') then raise exception 'authenticated student creation grant missing';end if;
 if position('has_school_capability' in pg_get_functiondef(generic_signature))=0 then raise exception 'generic student creation capability check missing';end if;
 if position('set search_path' in lower(pg_get_functiondef(generic_signature)))=0 then raise exception 'generic student creation search path is not pinned';end if;
 if position('first_student_already_exists' in pg_get_functiondef(onboarding_signature))=0 then raise exception 'onboarding first-student guard missing';end if;
 if has_function_privilege('anon',onboarding_signature,'execute') or has_function_privilege('public',onboarding_signature,'execute') then raise exception 'onboarding student creation is publicly executable';end if;
end;$$;
