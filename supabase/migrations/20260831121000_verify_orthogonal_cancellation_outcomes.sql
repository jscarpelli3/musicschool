do $$
declare missing_outcomes integer; missing_revisions integer; mismatched_current integer;
begin
  select count(*) into missing_outcomes
  from public.cancellation_policy_rules rules
  where (select count(*) from public.cancellation_policy_outcomes outcome
    where outcome.policy_version_id=rules.policy_version_id)<>7;
  if missing_outcomes<>0 then raise exception 'orthogonal outcome backfill incomplete for % policy versions',missing_outcomes; end if;

  select count(*) into missing_revisions
  from public.lesson_change_request_decisions legacy
  where not exists(select 1 from public.lesson_change_decision_revisions revision where revision.legacy_decision_id=legacy.id);
  if missing_revisions<>0 then raise exception 'decision revision backfill incomplete for % decisions',missing_revisions; end if;

  select count(*) into mismatched_current
  from public.lesson_change_request_decisions legacy
  join public.lesson_change_requests request on request.id=legacy.request_id
  join public.lesson_change_decision_revisions revision on revision.legacy_decision_id=legacy.id
  where request.current_decision_revision_id is distinct from revision.id;
  if mismatched_current<>0 then raise exception 'current decision pointer mismatch for % requests',mismatched_current; end if;

  if not (select relrowsecurity from pg_class where oid='public.cancellation_policy_outcomes'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.lesson_change_decision_revisions'::regclass)
  then raise exception 'RLS must be enabled on orthogonal cancellation tables'; end if;

  if has_table_privilege('authenticated','public.cancellation_policy_outcomes','INSERT')
    or has_table_privilege('authenticated','public.cancellation_policy_outcomes','UPDATE')
    or has_table_privilege('authenticated','public.cancellation_policy_outcomes','DELETE')
    or has_table_privilege('authenticated','public.lesson_change_decision_revisions','INSERT')
    or has_table_privilege('authenticated','public.lesson_change_decision_revisions','UPDATE')
    or has_table_privilege('authenticated','public.lesson_change_decision_revisions','DELETE')
  then raise exception 'authenticated must not directly mutate orthogonal cancellation tables'; end if;
end $$;
