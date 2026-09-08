do $$
declare
  remaining_policy_count integer;
  function_row record;
begin
  select count(*) into remaining_policy_count
  from pg_policies policy
  where policy.schemaname='public'
    and policy.tablename=any(array[
      'service_products','stripe_catalog_operations','lesson_places','school_policies',
      'school_policy_versions','service_product_policy_selections','school_documents',
      'school_family_cancellation_settings','billing_account_cancellation_overrides',
      'billing_accounts','billing_account_students','billing_periods','billing_line_items',
      'billing_payment_methods','billing_approval_requests','payment_attempts','payment_refunds',
      'payment_disputes','payment_state_history','payment_method_setup_requests',
      'payment_method_consents','auto_charge_mandates','email_delivery_registry',
      'email_delivery_events','owner_notification_email_outbox','email_support_incidents',
      'lesson_change_requests','lesson_change_request_revisions',
      'lesson_change_request_notifications','lesson_service_entitlements','lesson_series',
      'lesson_events','lesson_reschedule_history'
    ])
    and (coalesce(policy.qual,'')||coalesce(policy.with_check,'')) like '%has_school_role%'
    and (coalesce(policy.qual,'')||coalesce(policy.with_check,'')) ~ 'owner.*admin'
    and not (
      policy.tablename='lesson_places'
      and (coalesce(policy.qual,'')||coalesce(policy.with_check,'')) like '%''teacher''::text%'
    );
  if remaining_policy_count<>0 then
    raise exception 'legacy_management_policy_authority_remaining: %',remaining_policy_count;
  end if;

  for function_row in
    select signature,capability from (values
      ('public.prepare_family_billing_draft(uuid,uuid,date)'::regprocedure,'school.billing.manage'),
      ('public.lock_family_billing_period(uuid,uuid)'::regprocedure,'school.billing.manage'),
      ('public.publish_default_cancellation_policy(uuid,text,integer,integer,text,text,integer,integer,boolean,text,text)'::regprocedure,'school.policies.manage'),
      ('public.set_school_family_cancellation_settings(uuid,text,text)'::regprocedure,'school.policies.manage'),
      ('public.create_single_lesson(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text)'::regprocedure,'school.lessons.manage'),
      ('public.create_weekly_lesson_series(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text)'::regprocedure,'school.lessons.manage'),
      ('public.schedule_service_entitlement(uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text)'::regprocedure,'school.lessons.manage'),
      ('public.resolve_lesson_change_request(uuid,uuid,text,jsonb,text)'::regprocedure,'school.approvals.review'),
      ('public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text)'::regprocedure,'school.approvals.review')
    ) expected(signature,capability)
  loop
    if position(format('has_school_capability(p_school_id,%L',function_row.capability)
      in pg_get_functiondef(function_row.signature))=0 then
      raise exception 'capability_function_authority_missing: %',function_row.signature;
    end if;
  end loop;
end
$$;
