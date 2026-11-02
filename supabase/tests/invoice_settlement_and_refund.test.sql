begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.invoice_settlement_entries'::regclass),
  'invoice settlement entries enforce row-level security'
);
select ok(not has_table_privilege('anon', 'public.invoice_settlement_entries', 'select'), 'anonymous users cannot read settlement entries');
select ok(not has_table_privilege('authenticated', 'public.invoice_settlement_entries', 'insert'), 'authenticated users cannot insert settlement entries directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_settlement_entries', 'update'), 'authenticated users cannot update settlement entries');
select ok(not has_table_privilege('authenticated', 'public.invoice_settlement_entries', 'delete'), 'authenticated users cannot delete settlement entries');
select ok(
  not has_function_privilege('authenticated', 'public.record_invoice_settlement_entry(uuid,uuid,uuid,text,text,bigint,timestamptz,text,text,uuid,uuid)', 'execute'),
  'authenticated users cannot call the service settlement command'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_invoice_refund_event(uuid,text,text,text,text,text)', 'execute'),
  'authenticated users cannot apply Stripe refund events'
);

-- Minimal transaction-local fixtures isolate the settlement boundary. Foreign
-- key and state-machine triggers are disabled only for fixture construction.
set local session_replication_role = replica;

insert into public.profiles (id, email, full_name) values
  ('11000000-0000-0000-0000-000000000001', 'settlement-owner-a@example.test', 'Settlement Owner A'),
  ('11000000-0000-0000-0000-000000000002', 'settlement-owner-b@example.test', 'Settlement Owner B'),
  ('11000000-0000-0000-0000-000000000003', 'settlement-teacher@example.test', 'Settlement Teacher');

insert into public.schools (id, name, slug, timezone, created_by) values
  ('21000000-0000-0000-0000-000000000001', 'Settlement School A', 'settlement-school-a', 'America/Chicago', '11000000-0000-0000-0000-000000000001'),
  ('21000000-0000-0000-0000-000000000002', 'Settlement School B', 'settlement-school-b', 'America/Chicago', '11000000-0000-0000-0000-000000000002');

insert into public.school_members (school_id, profile_id, role, status) values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'owner', 'active'),
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'teacher', 'active');

insert into public.billing_accounts (id, school_id, billing_contact_person_id, name) values
  ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Family A'),
  ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 'Family B');

insert into public.billing_periods (id, school_id, billing_account_id, period_start, period_end, label, currency, status, amount_due_cents, created_by) values
  ('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '2099-01-01', '2099-01-31', 'Partial outside payment', 'USD', 'approved', 10000, '11000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '2099-02-01', '2099-02-28', 'Active Stripe attempt', 'USD', 'collecting', 8000, '11000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '2099-03-01', '2099-03-31', 'Write off', 'USD', 'approved', 5000, '11000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '2099-04-01', '2099-04-30', 'Stripe payment', 'USD', 'paid', 7000, '11000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '2099-01-01', '2099-01-31', 'Other tenant', 'USD', 'approved', 9000, '11000000-0000-0000-0000-000000000002');

insert into public.billing_approval_requests (id, school_id, billing_account_id, billing_period_id, token_hash, period_label, line_items, amount_cents, currency, approval_status, expires_at, approved_at, created_by) values
  ('41000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000003', repeat('3',64), 'Write off', '[]'::jsonb, 5000, 'usd', 'approved', '2099-04-01 00:00:00+00', now(), '11000000-0000-0000-0000-000000000001');

insert into public.school_payment_connections (id, school_id, provider_account_id, status) values
  ('61000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'acct_settlement_a', 'enabled');
insert into public.billing_provider_customers (id, school_id, billing_account_id, payment_connection_id, provider_customer_id) values
  ('71000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'cus_settlement_a');
insert into public.payment_attempts (id, school_id, billing_account_id, billing_period_id, payment_connection_id, provider_customer_id, amount_cents, currency, status, idempotency_key, provider_charge_id, created_by) values
  ('81000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 8000, 'USD', 'created', '91000000-0000-0000-0000-000000000001', null, '11000000-0000-0000-0000-000000000001'),
  ('81000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 7000, 'USD', 'succeeded', '91000000-0000-0000-0000-000000000002', 'ch_settlement_paid', '11000000-0000-0000-0000-000000000001');

insert into public.payment_refunds (id, school_id, payment_attempt_id, amount_cents, currency, status, idempotency_key, created_by) values
  ('a1000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 2000, 'USD', 'submitted', 'b1000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001');

insert into public.invoice_settlement_entries (id, school_id, billing_account_id, billing_period_id, entry_type, method, amount_cents, currency, occurred_at, created_by) values
  ('c1000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000005', 'external_payment', 'cash', 1000, 'USD', now(), '11000000-0000-0000-0000-000000000002');

set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is((select count(*) from public.invoice_settlement_entries), 0::bigint, 'school A owner cannot read school B settlement entries');

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is((select count(*) from public.invoice_settlement_entries), 1::bigint, 'school B owner reads its own settlement entry');

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is((select count(*) from public.invoice_settlement_entries), 0::bigint, 'teacher without billing authority reads no settlement entries');

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

select lives_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',
    'external_payment','cash',4000,'2099-01-10 12:00:00+00','receipt-1','First installment',null,'11000000-0000-0000-0000-000000000001')
$$, 'a partial outside payment is accepted');
select is((select status from public.billing_periods where id='51000000-0000-0000-0000-000000000001'), 'approved', 'partial payment does not falsely close the invoice');

select throws_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',
    'external_payment','cash',6001,now(),null,null,null,'11000000-0000-0000-0000-000000000001')
$$, 'P0001', 'amount_exceeds_outstanding_balance', 'outside payments cannot exceed the remaining balance');

select lives_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',
    'external_payment','check',6000,'2099-01-12 12:00:00+00','check-123','Final installment',null,'11000000-0000-0000-0000-000000000001')
$$, 'a second outside payment may resolve the exact remainder');
select is((select status from public.billing_periods where id='51000000-0000-0000-0000-000000000001'), 'paid', 'exact outside payments close the invoice');
select is((select count(*) from public.audit_log where entity_id='51000000-0000-0000-0000-000000000001' and action='invoice_settlement.external_payment'), 2::bigint, 'each outside payment creates audit evidence');

select lives_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',
    'external_refund',null,1500,now(),null,'Partial cash refund',
    (select id from public.invoice_settlement_entries where billing_period_id='51000000-0000-0000-0000-000000000001' and entry_type='external_payment' and method='cash'),
    '11000000-0000-0000-0000-000000000001')
$$, 'an outside refund is attached to its original outside payment');
select is((select count(*) from public.invoice_settlement_entries where billing_period_id='51000000-0000-0000-0000-000000000001' and entry_type='external_refund'), 1::bigint, 'the outside refund is retained as a separate ledger entry');
select throws_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',
    'external_refund',null,2501,now(),null,'Excess refund',
    (select id from public.invoice_settlement_entries where billing_period_id='51000000-0000-0000-0000-000000000001' and entry_type='external_payment' and method='cash'),
    '11000000-0000-0000-0000-000000000001')
$$, 'P0001', 'refund_exceeds_payment', 'outside refunds cannot exceed the unrefunded source payment');

select throws_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000002',
    'external_payment','venmo',8000,now(),null,null,null,'11000000-0000-0000-0000-000000000001')
$$, 'P0001', 'active_stripe_collection_must_be_resolved_first', 'an active Stripe attempt blocks outside settlement');

select throws_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000003',
    'write_off',null,5000,now(),null,null,null,'11000000-0000-0000-0000-000000000001')
$$, 'P0001', 'write_off_note_required', 'a write-off requires a reason');

select lives_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000003',
    'write_off',null,5000,now(),null,'Courtesy adjustment',null,'11000000-0000-0000-0000-000000000001')
$$, 'a reasoned write-off resolves the balance');
select is((select status from public.billing_periods where id='51000000-0000-0000-0000-000000000003'), 'paid', 'a full write-off closes the invoice without recording money');

select throws_ok($$
  insert into public.payment_attempts(id,school_id,billing_account_id,billing_period_id,payment_connection_id,provider_customer_id,amount_cents,currency,idempotency_key,created_by)
  values('81000000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',5000,'USD','91000000-0000-0000-0000-000000000003','11000000-0000-0000-0000-000000000001')
$$, 'P0001', 'invoice_has_manual_settlement', 'an active manual settlement blocks a new Stripe attempt');

select lives_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000003',
    'reversal',null,5000,now(),null,'Write-off entered in error',
    (select id from public.invoice_settlement_entries where billing_period_id='51000000-0000-0000-0000-000000000003' and entry_type='write_off'),
    '11000000-0000-0000-0000-000000000001')
$$, 'a compensating reversal restores a mistakenly resolved invoice');
select is((select status from public.billing_periods where id='51000000-0000-0000-0000-000000000003'), 'approved', 'reversing the resolution reopens the approved invoice');

select throws_ok($$
  select public.record_invoice_settlement_entry(
    '21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000003',
    'reversal',null,5000,now(),null,'Duplicate reversal',
    (select id from public.invoice_settlement_entries where billing_period_id='51000000-0000-0000-0000-000000000003' and entry_type='write_off'),
    '11000000-0000-0000-0000-000000000001')
$$, 'P0001', 'entry_already_reversed', 'one source entry cannot be reversed twice');

reset role;
select throws_ok($$
  update public.invoice_settlement_entries set note='rewritten history'
  where billing_period_id='51000000-0000-0000-0000-000000000003' and entry_type='write_off'
$$, 'P0001', 'invoice_settlement_entries_are_append_only', 'settlement history cannot be edited');

set local role service_role;
select lives_ok($$
  select public.apply_invoice_refund_event('a1000000-0000-0000-0000-000000000001','acct_settlement_a','re_settlement_1','succeeded',null,'evt_refund_1')
$$, 'a correctly bound Stripe refund event is applied');
select is((select status from public.payment_refunds where id='a1000000-0000-0000-0000-000000000001'), 'succeeded', 'Stripe refund reaches succeeded state');
select is((select provider_refund_id from public.payment_refunds where id='a1000000-0000-0000-0000-000000000001'), 're_settlement_1', 'Stripe refund identity is retained');

select lives_ok($$
  select public.apply_invoice_refund_event('a1000000-0000-0000-0000-000000000001','acct_settlement_a','re_settlement_1','failed','late failure','evt_refund_late')
$$, 'a late failure delivery is safely acknowledged');
select is((select status from public.payment_refunds where id='a1000000-0000-0000-0000-000000000001'), 'succeeded', 'a late failure cannot downgrade a succeeded refund');

select throws_ok($$
  select public.apply_invoice_refund_event('a1000000-0000-0000-0000-000000000001','acct_wrong','re_settlement_1','succeeded',null,'evt_wrong_account')
$$, 'P0001', 'connected_account_mismatch', 'a refund event from another connected account is rejected');
select throws_ok($$
  select public.apply_invoice_refund_event('a1000000-0000-0000-0000-000000000001','acct_settlement_a','re_other','succeeded',null,'evt_wrong_refund')
$$, 'P0001', 'provider_refund_mismatch', 'a different Stripe refund cannot overwrite the bound identity');

reset role;
select * from finish();
rollback;
