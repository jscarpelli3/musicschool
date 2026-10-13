begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select ok(
  has_table_privilege('service_role', 'public.school_payment_connections', 'select'),
  'service role can read a school Stripe connection before synchronization'
);
select ok(
  has_table_privilege('service_role', 'public.school_payment_connections', 'insert'),
  'service role can persist the first school Stripe connection'
);
select ok(
  has_table_privilege('service_role', 'public.school_payment_connections', 'update'),
  'service role can reconcile an existing school Stripe connection'
);
select ok(
  not has_table_privilege('service_role', 'public.school_payment_connections', 'delete'),
  'service role cannot delete a school Stripe connection'
);
select ok(
  has_table_privilege('service_role', 'public.audit_log', 'insert'),
  'service role can append Stripe synchronization audit evidence'
);
select ok(
  has_sequence_privilege('service_role', 'public.audit_log_id_seq', 'usage'),
  'service role can allocate an audit identity'
);
select ok(
  not has_table_privilege('anon', 'public.school_payment_connections', 'insert'),
  'anonymous users cannot create Stripe connections'
);
select ok(
  not has_table_privilege('authenticated', 'public.school_payment_connections', 'update'),
  'authenticated users cannot directly change Stripe connection truth'
);

select * from finish();
rollback;
