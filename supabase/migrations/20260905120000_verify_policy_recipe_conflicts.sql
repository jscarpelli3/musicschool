create or replace function public.guard_cancellation_policy_outcomes_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then raise exception 'cancellation_policy_outcome_recipe_conflict'; end if;
  raise exception 'Cancellation policy outcomes are immutable';
end $$;

create or replace function public.sync_cancellation_policy_outcomes_from_rules(p_policy_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  rule record;
  target_school_id uuid;
  timely_calendar text;
  timely_service text:='not_serviced_student_cancelled';
  timely_charge text;
  timely_replacement text;
  timely_adjustment text;
  timely_review boolean;
  late_calendar text;
  late_service text;
  late_charge text;
  late_replacement text;
  late_adjustment text;
  late_review boolean;
begin
  select version.school_id,rules.* into rule
  from public.school_policy_versions version
  join public.cancellation_policy_rules rules on rules.policy_version_id=version.id
  where version.id=p_policy_version_id;
  if not found then raise exception 'cancellation_policy_rules_not_found'; end if;
  target_school_id:=rule.school_id;

  timely_calendar:=case when rule.timely_cancel_disposition='manual_review' then 'manual_review' else 'cancel' end;
  timely_charge:=case rule.timely_cancel_disposition
    when 'charge' then 'keep_full_charge' when 'waive' then 'waive_full_charge'
    when 'credit' then 'account_credit' else 'manual_financial_review' end;
  timely_replacement:='none';
  timely_adjustment:='none';
  timely_review:=rule.timely_cancel_disposition='manual_review';

  late_calendar:=case rule.late_lesson_resolution
    when 'retain_for_reschedule' then 'retain_for_later'
    when 'manual_review' then 'manual_review' else 'cancel' end;
  late_service:=case when rule.late_lesson_resolution='manual_review' then 'manual_review' else 'not_serviced_student_cancelled' end;
  late_charge:=case rule.late_lesson_resolution
    when 'count_as_serviced' then 'keep_full_charge'
    when 'retain_for_reschedule' then 'waive_full_charge'
    when 'waive' then 'waive_full_charge' else 'manual_financial_review' end;
  late_replacement:=case rule.late_lesson_resolution
    when 'retain_for_reschedule' then 'replacement_minutes'
    when 'manual_review' then 'manual_review' else 'none' end;
  late_adjustment:=case
    when rule.late_lesson_resolution='retain_for_reschedule' and rule.late_reschedule_fee_cents>0 then 'fee'
    when rule.late_lesson_resolution='manual_review' then 'manual_review' else 'none' end;
  late_review:=rule.late_lesson_resolution='manual_review';

  insert into public.cancellation_policy_outcomes(
    school_id,policy_version_id,scenario,timing_bucket,calendar_action,service_outcome,
    original_charge_treatment,replacement_kind,replacement_minutes_rule,teacher_constraint,
    transferable_within_account,expiration_days,expiration_anchor,adjustment_kind,
    adjustment_amount_cents,owner_review_required,family_guidance
  ) values
    (target_school_id,p_policy_version_id,'student_cancellation','timely',timely_calendar,timely_service,
      timely_charge,timely_replacement,null,'unrestricted',true,null,null,timely_adjustment,0,timely_review,rule.timely_request_guidance),
    (target_school_id,p_policy_version_id,'student_reschedule','timely','retain_for_later','not_serviced_student_cancelled',
      'waive_full_charge','replacement_minutes','original_duration',case when rule.must_keep_assigned_teacher then 'required' else 'unrestricted' end,
      true,rule.replacement_window_days,'decision','none',0,false,rule.timely_request_guidance),
    (target_school_id,p_policy_version_id,'student_cancellation','late',late_calendar,late_service,
      late_charge,late_replacement,case when late_replacement='replacement_minutes' then 'original_duration' end,
      case when rule.must_keep_assigned_teacher then 'required' else 'unrestricted' end,true,
      case when late_replacement='replacement_minutes' then rule.replacement_window_days end,
      case when late_replacement='replacement_minutes' then 'decision' end,late_adjustment,
      case when late_adjustment='fee' then rule.late_reschedule_fee_cents else 0 end,late_review,rule.late_request_guidance),
    (target_school_id,p_policy_version_id,'student_reschedule','late',late_calendar,late_service,
      late_charge,late_replacement,case when late_replacement='replacement_minutes' then 'original_duration' end,
      case when rule.must_keep_assigned_teacher then 'required' else 'unrestricted' end,true,
      case when late_replacement='replacement_minutes' then rule.replacement_window_days end,
      case when late_replacement='replacement_minutes' then 'decision' end,late_adjustment,
      case when late_adjustment='fee' then rule.late_reschedule_fee_cents else 0 end,late_review,rule.late_request_guidance),
    (target_school_id,p_policy_version_id,'student_no_show','not_applicable','cancel','not_serviced_no_show',
      case rule.no_show_disposition when 'charge' then 'keep_full_charge' when 'waive' then 'waive_full_charge'
        when 'credit' then 'account_credit' else 'manual_financial_review' end,
      'none',null,'unrestricted',true,null,null,'none',0,rule.no_show_disposition='manual_review',
      'The school will apply its no-show policy and confirm any financial effect.'),
    (target_school_id,p_policy_version_id,'teacher_cancellation','not_applicable',
      case when rule.teacher_cancel_disposition='makeup' then 'retain_for_later' when rule.teacher_cancel_disposition='manual_review' then 'manual_review' else 'cancel' end,
      case when rule.teacher_cancel_disposition='manual_review' then 'manual_review' else 'not_serviced_teacher_cancelled' end,
      case rule.teacher_cancel_disposition when 'credit' then 'account_credit' when 'refund' then 'manual_financial_review'
        when 'makeup' then 'waive_full_charge' else 'manual_financial_review' end,
      case rule.teacher_cancel_disposition when 'makeup' then 'replacement_minutes' when 'manual_review' then 'manual_review' else 'none' end,
      case when rule.teacher_cancel_disposition='makeup' then 'original_duration' end,'unrestricted',true,
      case when rule.teacher_cancel_disposition='makeup' then rule.replacement_window_days end,
      case when rule.teacher_cancel_disposition='makeup' then 'decision' end,'none',0,
      rule.teacher_cancel_disposition in ('refund','manual_review'),
      'The school will confirm the replacement lesson, credit, or refund after reviewing the teacher cancellation.'),
    (target_school_id,p_policy_version_id,'school_cancellation','not_applicable',
      case when rule.teacher_cancel_disposition='makeup' then 'retain_for_later' when rule.teacher_cancel_disposition='manual_review' then 'manual_review' else 'cancel' end,
      case when rule.teacher_cancel_disposition='manual_review' then 'manual_review' else 'not_serviced_school_cancelled' end,
      case rule.teacher_cancel_disposition when 'credit' then 'account_credit' when 'refund' then 'manual_financial_review'
        when 'makeup' then 'waive_full_charge' else 'manual_financial_review' end,
      case rule.teacher_cancel_disposition when 'makeup' then 'replacement_minutes' when 'manual_review' then 'manual_review' else 'none' end,
      case when rule.teacher_cancel_disposition='makeup' then 'original_duration' end,'unrestricted',true,
      case when rule.teacher_cancel_disposition='makeup' then rule.replacement_window_days end,
      case when rule.teacher_cancel_disposition='makeup' then 'decision' end,'none',0,
      rule.teacher_cancel_disposition in ('refund','manual_review'),
      'The school will confirm the replacement lesson, credit, or refund after reviewing the school cancellation.')
  on conflict(policy_version_id,scenario,timing_bucket) do update set
    family_guidance=excluded.family_guidance
  where row(
    cancellation_policy_outcomes.school_id,
    cancellation_policy_outcomes.calendar_action,
    cancellation_policy_outcomes.service_outcome,
    cancellation_policy_outcomes.original_charge_treatment,
    cancellation_policy_outcomes.replacement_kind,
    cancellation_policy_outcomes.replacement_minutes_rule,
    cancellation_policy_outcomes.fixed_replacement_minutes,
    cancellation_policy_outcomes.teacher_constraint,
    cancellation_policy_outcomes.transferable_within_account,
    cancellation_policy_outcomes.expiration_days,
    cancellation_policy_outcomes.expiration_anchor,
    cancellation_policy_outcomes.adjustment_kind,
    cancellation_policy_outcomes.adjustment_amount_cents,
    cancellation_policy_outcomes.owner_review_required,
    cancellation_policy_outcomes.family_guidance
  ) is distinct from row(
    excluded.school_id,
    excluded.calendar_action,
    excluded.service_outcome,
    excluded.original_charge_treatment,
    excluded.replacement_kind,
    excluded.replacement_minutes_rule,
    excluded.fixed_replacement_minutes,
    excluded.teacher_constraint,
    excluded.transferable_within_account,
    excluded.expiration_days,
    excluded.expiration_anchor,
    excluded.adjustment_kind,
    excluded.adjustment_amount_cents,
    excluded.owner_review_required,
    excluded.family_guidance
  );
end $$;

revoke all on function public.sync_cancellation_policy_outcomes_from_rules(uuid) from public,anon,authenticated;

-- Existing versions must be exactly reproducible before this migration lands.
-- Equal rows produce no writes; any stale row reaches the immutable guard and
-- aborts with cancellation_policy_outcome_recipe_conflict.
do $$ declare policy_row record; begin
  for policy_row in select rules.policy_version_id from public.cancellation_policy_rules rules loop
    perform public.sync_cancellation_policy_outcomes_from_rules(policy_row.policy_version_id);
  end loop;
end $$;
