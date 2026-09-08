-- Move the final database authority for current school-management surfaces from
-- role-name arrays to the same capability catalog used by the application.
-- Role comparisons that describe identity or assignment are intentionally left alone.

do $$
declare
  target record;
  policy_row record;
  using_expression text;
  check_expression text;
  replacement_count integer:=0;
begin
  for target in
    select * from (values
      ('service_products','school.products.manage'),
      ('stripe_catalog_operations','school.products.manage'),
      ('lesson_places','school.places.manage'),
      ('school_policies','school.policies.manage'),
      ('school_policy_versions','school.policies.manage'),
      ('service_product_policy_selections','school.policies.manage'),
      ('school_documents','school.policies.manage'),
      ('school_family_cancellation_settings','school.policies.manage'),
      ('billing_account_cancellation_overrides','school.policies.manage'),
      ('billing_accounts','school.billing.manage'),
      ('billing_account_students','school.billing.manage'),
      ('billing_periods','school.billing.manage'),
      ('billing_line_items','school.billing.manage'),
      ('billing_payment_methods','school.billing.manage'),
      ('billing_approval_requests','school.billing.manage'),
      ('payment_attempts','school.billing.manage'),
      ('payment_refunds','school.billing.manage'),
      ('payment_disputes','school.billing.manage'),
      ('payment_state_history','school.billing.manage'),
      ('payment_method_setup_requests','school.billing.manage'),
      ('payment_method_consents','school.billing.manage'),
      ('auto_charge_mandates','school.billing.manage'),
      ('email_delivery_registry','school.approvals.review'),
      ('email_delivery_events','school.approvals.review'),
      ('owner_notification_email_outbox','school.approvals.review'),
      ('email_support_incidents','school.approvals.review'),
      ('lesson_change_requests','school.approvals.review'),
      ('lesson_change_request_revisions','school.approvals.review'),
      ('lesson_change_request_notifications','school.approvals.review'),
      ('lesson_service_entitlements','school.student_support.view'),
      ('lesson_series','school.lessons.manage'),
      ('lesson_events','school.lessons.manage'),
      ('lesson_reschedule_history','school.lessons.manage')
    ) mapping(table_name,capability)
  loop
    for policy_row in
      select policy.policyname,policy.cmd,policy.roles,policy.qual,policy.with_check
      from pg_policies policy
      where policy.schemaname='public' and policy.tablename=target.table_name
        and (coalesce(policy.qual,'')||coalesce(policy.with_check,'')) like '%has_school_role%'
        and (coalesce(policy.qual,'')||coalesce(policy.with_check,'')) like '%owner%admin%'
    loop
      using_expression:=policy_row.qual;
      check_expression:=policy_row.with_check;
      if using_expression is not null then
        using_expression:=regexp_replace(
          using_expression,
          '(public\.)?has_school_role\(([^,]+), ARRAY\[''owner''::text, ''admin''::text\]\)',
          format('public.has_school_capability(\2, %L)',target.capability),
          'g'
        );
        if target.table_name='lesson_places' then
          using_expression:=regexp_replace(
            using_expression,
            '(public\.)?has_school_role\(([^,]+), ARRAY\[''owner''::text, ''admin''::text, ''teacher''::text\]\)',
            'public.has_school_capability(\2, ''school.places.create'')','g'
          );
        end if;
      end if;
      if check_expression is not null then
        check_expression:=regexp_replace(
          check_expression,
          '(public\.)?has_school_role\(([^,]+), ARRAY\[''owner''::text, ''admin''::text\]\)',
          format('public.has_school_capability(\2, %L)',target.capability),
          'g'
        );
        if target.table_name='lesson_places' then
          check_expression:=regexp_replace(
            check_expression,
            '(public\.)?has_school_role\(([^,]+), ARRAY\[''owner''::text, ''admin''::text, ''teacher''::text\]\)',
            'public.has_school_capability(\2, ''school.places.create'')','g'
          );
        end if;
      end if;
      if using_expression is not distinct from policy_row.qual
        and check_expression is not distinct from policy_row.with_check then
        raise exception 'capability_policy_rewrite_missed: %.%',target.table_name,policy_row.policyname;
      end if;

      execute format('drop policy %I on public.%I',policy_row.policyname,target.table_name);
      execute format(
        'create policy %I on public.%I for %s to %s%s%s',
        policy_row.policyname,target.table_name,policy_row.cmd,
        array_to_string(policy_row.roles,','),
        case when using_expression is null then '' else format(' using (%s)',using_expression) end,
        case when check_expression is null then '' else format(' with check (%s)',check_expression) end
      );
      replacement_count:=replacement_count+1;
    end loop;
  end loop;
  if replacement_count=0 then raise exception 'no_capability_policies_rewritten'; end if;
end
$$;

create or replace function public.rewrite_function_school_authority(
  p_function regprocedure,
  p_capability text
) returns void language plpgsql security definer set search_path='' as $$
declare
  definition text;
  rewritten text;
begin
  select pg_get_functiondef(p_function) into definition;
  rewritten:=definition;
  rewritten:=regexp_replace(
    rewritten,
    'public\.has_school_role\(p_school_id,\s*array\[''owner''\s*,\s*''admin''\]\)',
    format('public.has_school_capability(p_school_id,%L)',p_capability),'gi'
  );
  rewritten:=regexp_replace(
    rewritten,
    '(actor_role|actor_school_role)\s+not\s+in\s*\(\s*''owner''\s*,\s*''admin''\s*\)',
    format('not public.has_school_capability(p_school_id,%L)',p_capability),'gi'
  );
  if rewritten=definition then
    raise exception 'capability_function_rewrite_missed: %',p_function;
  end if;
  execute rewritten;
end
$$;

select public.rewrite_function_school_authority('public.prepare_family_billing_draft(uuid,uuid,date)'::regprocedure,'school.billing.manage');
select public.rewrite_function_school_authority('public.lock_family_billing_period(uuid,uuid)'::regprocedure,'school.billing.manage');
select public.rewrite_function_school_authority('public.publish_default_cancellation_policy(uuid,text,integer,integer,text,text,integer,integer,boolean,text,text)'::regprocedure,'school.policies.manage');
select public.rewrite_function_school_authority('public.set_school_family_cancellation_settings(uuid,text,text)'::regprocedure,'school.policies.manage');
select public.rewrite_function_school_authority('public.create_single_lesson(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text)'::regprocedure,'school.lessons.manage');
select public.rewrite_function_school_authority('public.create_weekly_lesson_series(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text)'::regprocedure,'school.lessons.manage');
select public.rewrite_function_school_authority('public.schedule_service_entitlement(uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text)'::regprocedure,'school.lessons.manage');
select public.rewrite_function_school_authority('public.resolve_lesson_change_request(uuid,uuid,text,jsonb,text)'::regprocedure,'school.approvals.review');
select public.rewrite_function_school_authority('public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text)'::regprocedure,'school.approvals.review');

drop function public.rewrite_function_school_authority(regprocedure,text);

comment on function public.has_school_capability(uuid,text) is
  'Canonical school authorization predicate for application, RPC, and RLS enforcement.';
