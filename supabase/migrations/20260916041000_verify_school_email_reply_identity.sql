do $$
declare
  claim_signature regprocedure := 'public.claim_lesson_created_email(text,uuid)'::regprocedure;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schools'
      and column_name = 'reply_to_email'
      and data_type = 'text'
  ) then
    raise exception 'school reply-to column is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.schools'::regclass
      and conname = 'schools_reply_to_email_check'
  ) then
    raise exception 'school reply-to validation constraint is missing';
  end if;

  if has_function_privilege('public', claim_signature, 'execute')
    or has_function_privilege('anon', claim_signature, 'execute')
    or has_function_privilege('authenticated', claim_signature, 'execute')
    or not has_function_privilege('service_role', claim_signature, 'execute')
  then
    raise exception 'lesson-created email claim grants are incorrect';
  end if;

  if position('reply_to_email' in pg_get_function_result(claim_signature)) = 0
    or position('service_role' in pg_get_functiondef(claim_signature)) = 0
    or position('set search_path' in lower(pg_get_functiondef(claim_signature))) = 0
  then
    raise exception 'lesson-created email reply identity boundary is incomplete';
  end if;
end;
$$;
