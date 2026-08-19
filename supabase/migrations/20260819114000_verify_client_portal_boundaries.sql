do $$
begin
  if not exists (
    select 1 from pg_constraint constraint_row
    join pg_class table_row on table_row.oid=constraint_row.conrelid
    join pg_namespace schema_row on schema_row.oid=table_row.relnamespace
    where schema_row.nspname='public' and table_row.relname='payer_portal_authorizations'
      and constraint_row.contype='u'
      and pg_get_constraintdef(constraint_row.oid)='UNIQUE (school_id, normalized_email)'
  ) then raise exception 'Portal payer email is not unique within a school'; end if;

  if has_table_privilege('anon','public.payer_portal_authorizations','SELECT')
    or has_table_privilege('authenticated','public.payer_portal_authorizations','SELECT')
  then raise exception 'Portal authorization bindings are directly readable'; end if;

  if has_function_privilege('anon','public.get_client_portal_lessons()','EXECUTE')
  then raise exception 'Anonymous users can execute the portal lesson query'; end if;

  if not has_function_privilege('authenticated','public.get_client_portal_lessons()','EXECUTE')
  then raise exception 'Authenticated portal users cannot execute the lesson query'; end if;

  if has_function_privilege('anon','public.get_portal_auth_user_id_by_email(text)','EXECUTE')
    or has_function_privilege('authenticated','public.get_portal_auth_user_id_by_email(text)','EXECUTE')
  then raise exception 'Auth identity lookup escaped the service role'; end if;

  if position('payer_portal_authorizations' in pg_get_functiondef('public.get_client_portal_lessons()'::regprocedure))=0
    or position('billing_account_students' in pg_get_functiondef('public.get_client_portal_lessons()'::regprocedure))=0
    or position('student_contacts' in pg_get_functiondef('public.get_client_portal_lessons()'::regprocedure))>0
  then raise exception 'Portal lessons are not bounded exclusively by payer-account assignments'; end if;
end;
$$;
