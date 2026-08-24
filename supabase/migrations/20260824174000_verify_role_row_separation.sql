revoke select,insert,update,delete on public.people,public.teachers,public.students,public.student_contacts,
  public.billing_accounts,public.billing_account_students,public.teacher_availability_rules,public.lesson_events,
  public.lesson_series,public.lesson_event_changes,public.lesson_event_price_snapshots,public.lesson_series_billing_terms
from anon;

do $$
declare table_name text; policy_qual text;
begin
  foreach table_name in array array[
    'profiles','school_members','people','teachers','students','student_contacts','billing_accounts',
    'billing_account_students','teacher_availability_rules','lesson_events','lesson_series',
    'lesson_event_changes','lesson_event_price_snapshots','lesson_series_billing_terms','payer_portal_authorizations'
  ] loop
    if not exists(select 1 from pg_class relation join pg_namespace schema on schema.oid=relation.relnamespace where schema.nspname='public' and relation.relname=table_name and relation.relrowsecurity) then
      raise exception 'RLS is not enabled on public.%',table_name;
    end if;
  end loop;

  select qual into policy_qual from pg_policies where schemaname='public' and tablename='lesson_events' and policyname='lesson_events_select_scoped';
  if policy_qual is null or position('is_current_assigned_teacher' in policy_qual)=0 or position('has_school_role' in policy_qual)=0 then raise exception 'lesson event select scope is not role and assignment bound'; end if;
  select qual into policy_qual from pg_policies where schemaname='public' and tablename='people' and policyname='people_select_scoped';
  if policy_qual is null or position('current_teacher_is_assigned_to_student' in policy_qual)=0 or position('has_school_role' in policy_qual)=0 then raise exception 'people select scope is not role and assignment bound'; end if;
  select qual into policy_qual from pg_policies where schemaname='public' and tablename='billing_accounts' and policyname='billing_accounts_select_management';
  if policy_qual is null or position('has_school_role' in policy_qual)=0 then raise exception 'billing account select scope is not management bound'; end if;
  if has_table_privilege('anon','public.people','SELECT') or has_table_privilege('anon','public.lesson_events','SELECT') or has_table_privilege('anon','public.billing_accounts','SELECT') then raise exception 'anonymous role can select protected operational tables'; end if;
  if has_table_privilege('anon','public.payer_portal_authorizations','SELECT') or has_table_privilege('authenticated','public.payer_portal_authorizations','SELECT') then raise exception 'payer authorization bindings are directly readable'; end if;
  if has_function_privilege('anon','public.replace_teacher_weekly_availability(uuid,uuid,jsonb)','EXECUTE') then raise exception 'anonymous role can mutate teacher availability'; end if;
end $$;
