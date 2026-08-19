do $$ begin
  if has_table_privilege('anon','public.lesson_change_requests','SELECT')
    or has_table_privilege('authenticated','public.lesson_change_requests','SELECT')
    or has_table_privilege('anon','public.lesson_request_email_outbox','SELECT')
    or has_table_privilege('authenticated','public.lesson_request_email_outbox','SELECT')
  then raise exception 'Family lesson request internals are directly readable'; end if;
  if has_function_privilege('anon','public.preview_client_lesson_change_request(uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.submit_client_lesson_change_request(uuid,text,text)','EXECUTE')
  then raise exception 'Anonymous lesson request access escaped'; end if;
  if not has_function_privilege('authenticated','public.preview_client_lesson_change_request(uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.submit_client_lesson_change_request(uuid,text,text)','EXECUTE')
  then raise exception 'Authenticated payer request functions are unavailable'; end if;
  if position('payer_portal_authorizations' in pg_get_functiondef('public.preview_client_lesson_change_request(uuid,text)'::regprocedure))=0
    or position('billing_account_students' in pg_get_functiondef('public.preview_client_lesson_change_request(uuid,text)'::regprocedure))=0
  then raise exception 'Lesson request preview is not payer-account bounded'; end if;
  if position('update public.lesson_events' in lower(pg_get_functiondef('public.submit_client_lesson_change_request(uuid,text,text)'::regprocedure)))>0
    or position('delete from public.lesson_events' in lower(pg_get_functiondef('public.submit_client_lesson_change_request(uuid,text,text)'::regprocedure)))>0
  then raise exception 'Request submission can mutate lesson truth'; end if;
end $$;
