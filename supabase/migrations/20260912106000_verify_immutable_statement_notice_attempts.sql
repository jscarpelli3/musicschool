do $$
begin
  if not exists(select 1 from pg_constraint where conname='billing_statement_notice_attempt_unique')
    or position('next_attempt' in pg_get_functiondef('public.prepare_billing_statement_notice(uuid,uuid,text,text,text)'::regprocedure))=0
    or position('on conflict' in lower(pg_get_functiondef('public.prepare_billing_statement_notice(uuid,uuid,text,text,text)'::regprocedure)))>0
  then raise exception 'statement notice attempts are not immutable'; end if;
end;
$$;
