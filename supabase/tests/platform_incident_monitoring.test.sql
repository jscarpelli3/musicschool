begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select ok(not has_table_privilege('anon','public.platform_incidents','select'),'anonymous users cannot read platform incidents');
select ok(not has_table_privilege('authenticated','public.platform_incidents','select'),'school users cannot read platform incidents');
select ok(not has_table_privilege('anon','public.platform_incident_alert_deliveries','select'),'anonymous users cannot read alert recipients');
select ok(not has_table_privilege('authenticated','public.platform_incident_alert_deliveries','select'),'school users cannot read alert recipients');
select ok(not has_function_privilege('authenticated','public.record_platform_incident(text,text,text,text,text,text,text,uuid,jsonb)','execute'),'school users cannot create platform incidents');
select ok(has_function_privilege('service_role','public.record_platform_incident(text,text,text,text,text,text,text,uuid,jsonb)','execute'),'service role can create platform incidents');
select ok(not has_function_privilege('authenticated','public.scan_platform_health_incidents()','execute'),'school users cannot run the platform scan');
select ok(has_function_privilege('service_role','public.scan_platform_health_incidents()','execute'),'service role can run the platform scan');
select ok(has_function_privilege('authenticated','public.change_platform_incident_status(uuid,text)','execute'),'authenticated admins may reach the status boundary');

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;

select lives_ok($$select public.record_platform_incident('test:provider:outage','resend','urgent','Provider outage','The provider could not accept a controlled test request.','test_monitor',null,null,'{"safe":"metadata"}'::jsonb)$$,'service role records an incident');
select is((select count(*) from public.platform_incidents where fingerprint='test:provider:outage'),1::bigint,'the incident is durable');

select public.record_platform_incident('test:provider:outage','resend','warning','Provider outage updated','A repeated controlled failure was detected.','test_monitor',null,null,'{}'::jsonb);
select is((select count(*) from public.platform_incidents where fingerprint='test:provider:outage'),1::bigint,'matching fingerprints deduplicate');
select is((select occurrence_count from public.platform_incidents where fingerprint='test:provider:outage'),2,'repeated detections increment the occurrence count');
select is((select severity from public.platform_incidents where fingerprint='test:provider:outage'),'urgent','a later warning cannot downgrade an urgent incident');

insert into public.payment_provider_events(provider,provider_event_id,livemode,event_type,payload,processing_status,last_error)
values('stripe','evt_monitor_controlled',false,'payment_intent.succeeded','{}'::jsonb,'failed','controlled failure');

select is(public.scan_platform_health_incidents(),1,'the scan reports the controlled failed Stripe event');
select is((select provider from public.platform_incidents where fingerprint like 'stripe-event:%' limit 1),'stripe','the scan creates a Stripe incident');
select is((select severity from public.platform_incidents where fingerprint like 'stripe-event:%' limit 1),'urgent','failed Stripe processing is urgent');

reset role;
select throws_ok($$select public.change_platform_incident_status((select id from public.platform_incidents limit 1),'resolved')$$,'not_authorized','non-admin sessions cannot change incident state');

select * from finish();
rollback;
