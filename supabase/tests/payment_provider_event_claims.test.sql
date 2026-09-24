begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select ok(
  not has_function_privilege('anon', 'public.claim_payment_provider_event(text,integer)', 'execute'),
  'anonymous users cannot claim provider events'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_payment_provider_event(text,integer)', 'execute'),
  'authenticated users cannot claim provider events'
);
select ok(
  has_function_privilege('service_role', 'public.claim_payment_provider_event(text,integer)', 'execute'),
  'only the service role may reach the provider-event claim boundary'
);

insert into public.payment_provider_events (
  provider,
  provider_event_id,
  livemode,
  event_type,
  payload
) values
  ('stripe', 'evt_claim_first', false, 'checkout.session.completed', '{}'::jsonb),
  ('stripe', 'evt_claim_failed', false, 'checkout.session.completed', '{}'::jsonb),
  ('stripe', 'evt_claim_fresh', false, 'checkout.session.completed', '{}'::jsonb),
  ('stripe', 'evt_claim_stale', false, 'checkout.session.completed', '{}'::jsonb),
  ('stripe', 'evt_claim_ignored', false, 'account.updated', '{}'::jsonb);

update public.payment_provider_events
set processing_status = 'failed',
    processing_attempts = 1,
    last_error = 'controlled failure',
    processed_at = now()
where provider_event_id = 'evt_claim_failed';

update public.payment_provider_events
set processing_status = 'processing',
    processing_attempts = 1,
    processing_started_at = now()
where provider_event_id = 'evt_claim_fresh';

update public.payment_provider_events
set processing_status = 'processing',
    processing_attempts = 2,
    processing_started_at = now() - interval '10 minutes',
    last_error = 'abandoned worker'
where provider_event_id = 'evt_claim_stale';

update public.payment_provider_events
set processing_status = 'ignored',
    processing_attempts = 1,
    processed_at = now()
where provider_event_id = 'evt_claim_ignored';

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

select is(
  (select processing_attempts from public.claim_payment_provider_event('evt_claim_first', 300)),
  1,
  'the first delivery obtains the processing lease'
);
select is(
  (select processing_status from public.payment_provider_events where provider_event_id = 'evt_claim_first'),
  'processing',
  'a successful claim records processing state'
);
select ok(
  (select processing_started_at is not null from public.payment_provider_events where provider_event_id = 'evt_claim_first'),
  'a successful claim records its lease timestamp'
);
select is(
  (select count(*) from public.claim_payment_provider_event('evt_claim_first', 300)),
  0::bigint,
  'an immediate duplicate cannot obtain the active lease'
);
select is(
  (select processing_attempts from public.payment_provider_events where provider_event_id = 'evt_claim_first'),
  1,
  'a refused duplicate does not increment attempts'
);

reset role;
update public.payment_provider_events
set processing_status = 'processed',
    processed_at = now()
where provider_event_id = 'evt_claim_first';
set local role service_role;

select is(
  (select count(*) from public.claim_payment_provider_event('evt_claim_first', 300)),
  0::bigint,
  'a completed event remains terminal on replay'
);

select is(
  (select processing_attempts from public.claim_payment_provider_event('evt_claim_failed', 300)),
  2,
  'a failed delivery is retryable'
);
select is(
  (select processing_status from public.payment_provider_events where provider_event_id = 'evt_claim_failed'),
  'processing',
  'retrying a failed delivery restores processing state'
);
select is(
  (select last_error from public.payment_provider_events where provider_event_id = 'evt_claim_failed'),
  null::text,
  'retrying clears the previous failure message'
);
select is(
  (select processed_at from public.payment_provider_events where provider_event_id = 'evt_claim_failed'),
  null::timestamptz,
  'retrying clears the previous completion timestamp'
);

select is(
  (select count(*) from public.claim_payment_provider_event('evt_claim_fresh', 300)),
  0::bigint,
  'a fresh processing lease cannot be stolen'
);
select is(
  (select processing_attempts from public.payment_provider_events where provider_event_id = 'evt_claim_fresh'),
  1,
  'a refused fresh-lease claim does not increment attempts'
);

select is(
  (select processing_attempts from public.claim_payment_provider_event('evt_claim_stale', 300)),
  3,
  'an abandoned processing lease can be reclaimed after its timeout'
);
select is(
  (select processing_status from public.payment_provider_events where provider_event_id = 'evt_claim_stale'),
  'processing',
  'a reclaimed lease remains in processing state for the new worker'
);
select ok(
  (select processing_started_at > now() - interval '1 minute' from public.payment_provider_events where provider_event_id = 'evt_claim_stale'),
  'reclaiming refreshes the processing lease timestamp'
);
select is(
  (select last_error from public.payment_provider_events where provider_event_id = 'evt_claim_stale'),
  null::text,
  'reclaiming clears abandoned-worker error evidence for the new attempt'
);

select is(
  (select count(*) from public.claim_payment_provider_event('evt_claim_ignored', 300)),
  0::bigint,
  'an intentionally ignored event remains terminal on replay'
);
select is(
  (select count(*) from public.claim_payment_provider_event('evt_claim_missing', 300)),
  0::bigint,
  'an unknown provider event cannot create a claim record'
);

reset role;
select * from finish();
rollback;
