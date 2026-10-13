do $$
declare function_source text;
begin
  if not (select relrowsecurity from pg_class where oid='public.lesson_payment_requests'::regclass) then
    raise exception 'lesson_payment_requests_rls_required';
  end if;
  if has_table_privilege('anon','public.lesson_payment_requests','select')
    or has_table_privilege('anon','public.lesson_payment_requests','insert')
    or has_table_privilege('anon','public.lesson_payment_requests','update')
    or has_table_privilege('anon','public.lesson_payment_requests','delete') then
    raise exception 'anonymous_lesson_payment_access_detected';
  end if;
  if has_table_privilege('authenticated','public.lesson_payment_requests','insert')
    or has_table_privilege('authenticated','public.lesson_payment_requests','update')
    or has_table_privilege('authenticated','public.lesson_payment_requests','delete') then
    raise exception 'authenticated_lesson_payment_mutation_detected';
  end if;
  if has_function_privilege('anon','public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz)','execute')
    or has_function_privilege('authenticated','public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz)','execute') then
    raise exception 'public_payment_completion_execution_detected';
  end if;
  select pg_get_functiondef('public.prepare_family_billing_draft(uuid,uuid,date)'::regprocedure) into function_source;
  if function_source not like '%paid_separately%' or function_source not like '%lesson_payment_requests%' then
    raise exception 'billing_draft_missing_separate_payment_allocation';
  end if;
end $$;
