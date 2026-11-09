begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select ok(not has_table_privilege('anon','public.user_push_subscriptions','select'),'anonymous users cannot read push endpoints');
select ok(not has_table_privilege('authenticated','public.user_push_subscriptions','select'),'authenticated users cannot directly read push endpoints');
select ok(not has_table_privilege('anon','public.school_notification_preferences','select'),'anonymous users cannot read notification preferences');
select ok(has_table_privilege('authenticated','public.school_notification_preferences','select'),'authenticated users can read their RLS-scoped preferences');
select ok(not has_function_privilege('anon','public.save_my_push_subscription(uuid,text,text,text,text)','execute'),'anonymous users cannot save push subscriptions');
select ok(has_function_privilege('authenticated','public.save_my_push_subscription(uuid,text,text,text,text)','execute'),'authenticated users may reach the protected subscription boundary');
select ok(not has_function_privilege('anon','public.revoke_my_push_subscription(text)','execute'),'anonymous users cannot revoke subscriptions');
select ok(has_function_privilege('authenticated','public.revoke_my_push_subscription(text)','execute'),'authenticated users may revoke their own subscriptions');
select ok(not has_table_privilege('authenticated','public.push_notification_deliveries','select'),'school users cannot read the private push work queue');
select ok(not has_function_privilege('authenticated','public.claim_push_notification_deliveries(integer)','execute'),'school users cannot claim push work');
select ok(has_function_privilege('service_role','public.claim_push_notification_deliveries(integer)','execute'),'service role can claim push work');
select ok(not has_function_privilege('authenticated','public.complete_push_notification_delivery(uuid,boolean,text)','execute'),'school users cannot complete push work');
select ok(has_function_privilege('service_role','public.complete_push_notification_delivery(uuid,boolean,text)','execute'),'service role can complete push work');
select ok(not has_function_privilege('authenticated','public.queue_owner_notification_push()','execute'),'the queue trigger is not user-callable');
select throws_ok($$select public.save_my_push_subscription(gen_random_uuid(),'https://push.example/subscription-id','abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789','authentication-key',null)$$,'not_authorized','an unauthenticated session cannot save a subscription');

select * from finish();
rollback;
