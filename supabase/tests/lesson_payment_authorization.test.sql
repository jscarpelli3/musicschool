begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.lesson_payment_requests'::regclass),
  'lesson payment requests enforce row-level security'
);
select ok(not has_table_privilege('anon', 'public.lesson_payment_requests', 'select'), 'anonymous users cannot read payment requests');
select ok(not has_table_privilege('anon', 'public.lesson_payment_requests', 'insert'), 'anonymous users cannot insert payment requests');
select ok(not has_table_privilege('anon', 'public.lesson_payment_requests', 'update'), 'anonymous users cannot update payment requests');
select ok(not has_table_privilege('anon', 'public.lesson_payment_requests', 'delete'), 'anonymous users cannot delete payment requests');
select ok(not has_table_privilege('authenticated', 'public.lesson_payment_requests', 'insert'), 'authenticated users cannot insert payment requests directly');
select ok(not has_table_privilege('authenticated', 'public.lesson_payment_requests', 'update'), 'authenticated users cannot update payment requests directly');
select ok(not has_table_privilege('authenticated', 'public.lesson_payment_requests', 'delete'), 'authenticated users cannot delete payment requests directly');
select ok(has_table_privilege('authenticated', 'public.lesson_payment_requests', 'select'), 'authenticated users may reach the RLS-protected read boundary');
select ok(
  not has_function_privilege('anon', 'public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz)', 'execute'),
  'anonymous users cannot complete payment requests'
);
select ok(
  not has_function_privilege('authenticated', 'public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz)', 'execute'),
  'authenticated users cannot complete payment requests'
);

-- These deliberately minimal rows isolate the authorization boundary under
-- test. Foreign-key triggers are disabled only while the transaction-local
-- fixtures are inserted; constraints and triggers return to normal before any
-- assertion runs, and the transaction is rolled back at the end.
set local session_replication_role = replica;

insert into public.profiles (id, email, full_name) values
  ('10000000-0000-0000-0000-000000000001', 'owner-a@example.test', 'Owner A'),
  ('10000000-0000-0000-0000-000000000002', 'owner-b@example.test', 'Owner B'),
  ('10000000-0000-0000-0000-000000000003', 'teacher-a@example.test', 'Teacher A');

insert into public.schools (id, name, slug, timezone, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'Authorization School A', 'authorization-school-a', 'America/Chicago', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'Authorization School B', 'authorization-school-b', 'America/Chicago', '10000000-0000-0000-0000-000000000002');

insert into public.school_members (school_id, profile_id, role, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'owner', 'active'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'teacher', 'active');

insert into public.lesson_payment_requests (
  id,
  school_id,
  lesson_event_id,
  lesson_event_price_snapshot_id,
  billing_account_id,
  payment_connection_id,
  initiated_by,
  amount_cents,
  currency,
  status,
  expires_at
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    5000,
    'USD',
    'created',
    '2099-01-01 00:00:00+00'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    7500,
    'USD',
    'created',
    '2099-01-01 00:00:00+00'
  );

set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is((select count(*) from public.lesson_payment_requests), 1::bigint, 'school A owner sees exactly the school A request');
select is(
  (select count(*) from public.lesson_payment_requests where id = '30000000-0000-0000-0000-000000000002'),
  0::bigint,
  'school A owner cannot read a school B request by known ID'
);
select ok(public.has_school_capability('20000000-0000-0000-0000-000000000001', 'school.billing.manage'), 'school A owner has billing authority in school A');
select ok(not public.has_school_capability('20000000-0000-0000-0000-000000000002', 'school.billing.manage'), 'school A owner has no billing authority in school B');

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select is((select count(*) from public.lesson_payment_requests), 1::bigint, 'school B owner sees exactly the school B request');

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
set local role authenticated;

select is((select count(*) from public.lesson_payment_requests), 0::bigint, 'teacher without billing authority sees no payment requests');
select ok(not public.has_school_capability('20000000-0000-0000-0000-000000000001', 'school.billing.manage'), 'teacher does not inherit billing authority');

reset role;
select * from finish();
rollback;
