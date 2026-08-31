-- Introduce an orthogonal cancellation outcome vocabulary without rewriting
-- existing policy or decision history. Legacy rows remain authoritative during
-- the transition; adapters create the new immutable representation beside them.

create table public.cancellation_policy_outcomes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  policy_version_id uuid not null,
  scenario text not null check (scenario in (
    'student_cancellation','student_reschedule','student_no_show',
    'teacher_cancellation','school_cancellation'
  )),
  timing_bucket text not null check (timing_bucket in ('timely','late','not_applicable')),
  calendar_action text not null check (calendar_action in (
    'leave_scheduled','cancel','reschedule_now','retain_for_later','manual_review'
  )),
  service_outcome text not null check (service_outcome in (
    'scheduled_not_yet_serviced','serviced','not_serviced_student_cancelled',
    'not_serviced_teacher_cancelled','not_serviced_school_cancelled',
    'not_serviced_no_show','manual_review'
  )),
  original_charge_treatment text not null check (original_charge_treatment in (
    'unchanged','keep_full_charge','waive_full_charge','reduce_charge',
    'account_credit','manual_financial_review'
  )),
  replacement_kind text not null check (replacement_kind in (
    'none','replacement_minutes','reschedule_now','manual_review'
  )),
  replacement_minutes_rule text check (replacement_minutes_rule is null or replacement_minutes_rule in ('original_duration','fixed')),
  fixed_replacement_minutes integer check (fixed_replacement_minutes is null or fixed_replacement_minutes between 5 and 480),
  teacher_constraint text not null default 'unrestricted' check (teacher_constraint in ('required','preferred','unrestricted')),
  transferable_within_account boolean not null default true,
  expiration_days integer check (expiration_days is null or expiration_days between 0 and 3650),
  expiration_anchor text check (expiration_anchor is null or expiration_anchor in ('original_lesson','request','decision')),
  adjustment_kind text not null default 'none' check (adjustment_kind in ('none','fee','credit','manual_review')),
  adjustment_amount_cents integer not null default 0 check (adjustment_amount_cents between 0 and 1000000),
  owner_review_required boolean not null default false,
  family_guidance text not null check (length(trim(family_guidance)) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique(policy_version_id,scenario,timing_bucket),
  unique(school_id,id),
  foreign key(school_id,policy_version_id) references public.school_policy_versions(school_id,id) on delete restrict,
  check ((replacement_kind='replacement_minutes')=(replacement_minutes_rule is not null)),
  check ((replacement_minutes_rule='fixed')=(fixed_replacement_minutes is not null)),
  check ((adjustment_kind in ('fee','credit')) or adjustment_amount_cents=0)
);

comment on table public.cancellation_policy_outcomes is
  'Structured, immutable policy recipes. Calendar, service, charge, replacement, and adjustment meanings remain independent.';
comment on column public.cancellation_policy_outcomes.original_charge_treatment is
  'Treatment of the original lesson charge. A refund is intentionally not represented as an account credit.';

alter table public.cancellation_policy_outcomes enable row level security;
create policy cancellation_policy_outcomes_member_select on public.cancellation_policy_outcomes
  for select to authenticated using (public.is_school_member(school_id));
grant select on public.cancellation_policy_outcomes to authenticated;
revoke insert,update,delete on public.cancellation_policy_outcomes from authenticated;

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
    when 'waive' then 'waive_full_charge'
    else 'manual_financial_review' end;
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
  on conflict(policy_version_id,scenario,timing_bucket) do nothing;
end $$;
revoke all on function public.sync_cancellation_policy_outcomes_from_rules(uuid) from public,anon,authenticated;

do $$ declare policy_row record; begin
  for policy_row in select policy_version_id from public.cancellation_policy_rules loop
    perform public.sync_cancellation_policy_outcomes_from_rules(policy_row.policy_version_id);
  end loop;
end $$;

create function public.sync_cancellation_policy_outcomes_after_rules_insert()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.sync_cancellation_policy_outcomes_from_rules(new.policy_version_id);
  return new;
end $$;
create trigger cancellation_policy_rules_sync_outcomes
after insert on public.cancellation_policy_rules for each row
execute function public.sync_cancellation_policy_outcomes_after_rules_insert();
revoke all on function public.sync_cancellation_policy_outcomes_after_rules_insert() from public,anon,authenticated;

create function public.guard_cancellation_policy_outcomes_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Cancellation policy outcomes are immutable';
end $$;
create trigger cancellation_policy_outcomes_immutable
before update or delete on public.cancellation_policy_outcomes for each row
execute function public.guard_cancellation_policy_outcomes_immutable();
revoke all on function public.guard_cancellation_policy_outcomes_immutable() from public,anon,authenticated;

create table public.lesson_change_decision_revisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  request_id uuid not null,
  revision_number integer not null check (revision_number>0),
  supersedes_revision_id uuid,
  legacy_decision_id uuid unique references public.lesson_change_request_decisions(id) on delete restrict,
  request_disposition text not null check (request_disposition in ('approved','declined')),
  calendar_action text not null check (calendar_action in ('leave_scheduled','cancel','reschedule_now','retain_for_later','manual_review')),
  service_outcome text not null check (service_outcome in (
    'scheduled_not_yet_serviced','serviced','not_serviced_student_cancelled',
    'not_serviced_teacher_cancelled','not_serviced_school_cancelled','not_serviced_no_show','manual_review'
  )),
  original_charge_treatment text not null check (original_charge_treatment in (
    'unchanged','keep_full_charge','waive_full_charge','reduce_charge','account_credit','manual_financial_review'
  )),
  replacement_kind text not null check (replacement_kind in ('none','replacement_minutes','reschedule_now','manual_review')),
  replacement_minutes integer check (replacement_minutes is null or replacement_minutes between 5 and 480),
  beneficiary_student_id uuid,
  teacher_constraint text not null default 'unrestricted' check (teacher_constraint in ('required','preferred','unrestricted')),
  replacement_teacher_id uuid,
  transferable_within_account boolean not null default true,
  expires_at timestamptz,
  adjustment_actions jsonb not null default '[]'::jsonb check (jsonb_typeof(adjustment_actions)='array'),
  refund_action text not null default 'none' check (refund_action in ('none','manual_financial_review','refund_requested','refund_submitted','refund_succeeded','refund_failed')),
  policy_outcome_id uuid,
  policy_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(policy_snapshot)='object'),
  actual_outcome_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(actual_outcome_snapshot)='object'),
  is_policy_override boolean not null default false,
  internal_reason text check (internal_reason is null or length(trim(internal_reason)) between 1 and 1000),
  payer_summary text not null check (length(trim(payer_summary)) between 1 and 2000),
  decided_by uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique(request_id,revision_number),
  unique(school_id,id),
  foreign key(school_id,request_id) references public.lesson_change_requests(school_id,id) on delete restrict,
  foreign key(school_id,supersedes_revision_id) references public.lesson_change_decision_revisions(school_id,id) on delete restrict,
  foreign key(school_id,beneficiary_student_id) references public.people(school_id,id) on delete restrict,
  foreign key(school_id,replacement_teacher_id) references public.people(school_id,id) on delete restrict,
  foreign key(school_id,policy_outcome_id) references public.cancellation_policy_outcomes(school_id,id) on delete restrict,
  check ((replacement_kind='replacement_minutes')=(replacement_minutes is not null))
);

comment on table public.lesson_change_decision_revisions is
  'Append-only owner decision history. Corrections supersede prior revisions instead of erasing them.';

alter table public.lesson_change_requests add column current_decision_revision_id uuid;
alter table public.lesson_change_requests add constraint lesson_change_requests_current_revision_fk
  foreign key(school_id,current_decision_revision_id)
  references public.lesson_change_decision_revisions(school_id,id) on delete restrict;

alter table public.lesson_change_decision_revisions enable row level security;
create policy lesson_change_decision_revisions_management_select on public.lesson_change_decision_revisions
  for select to authenticated using(public.has_school_role(school_id,array['owner','admin']));
grant select on public.lesson_change_decision_revisions to authenticated;
revoke insert,update,delete on public.lesson_change_decision_revisions from authenticated;

create function public.guard_lesson_change_decision_revisions_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Lesson change decision revisions are append-only';
end $$;
create trigger lesson_change_decision_revisions_immutable
before update or delete on public.lesson_change_decision_revisions for each row
execute function public.guard_lesson_change_decision_revisions_immutable();
revoke all on function public.guard_lesson_change_decision_revisions_immutable() from public,anon,authenticated;

create or replace function public.create_orthogonal_revision_for_legacy_decision(p_decision_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  legacy public.lesson_change_request_decisions%rowtype;
  request_row public.lesson_change_requests%rowtype;
  event_row public.lesson_events%rowtype;
  entitlement public.lesson_service_entitlements%rowtype;
  policy_rules public.cancellation_policy_rules%rowtype;
  outcome_id uuid;
  new_revision_id uuid;
  calendar_value text;
  service_value text;
  charge_value text;
  replacement_value text;
  summary_value text;
  adjustment_value jsonb:='[]'::jsonb;
begin
  select * into legacy from public.lesson_change_request_decisions where id=p_decision_id;
  if not found then raise exception 'legacy_decision_not_found'; end if;
  if exists(select 1 from public.lesson_change_decision_revisions where legacy_decision_id=p_decision_id) then
    select id into new_revision_id from public.lesson_change_decision_revisions where legacy_decision_id=p_decision_id;
    return new_revision_id;
  end if;
  select * into request_row from public.lesson_change_requests where school_id=legacy.school_id and id=legacy.request_id;
  select * into event_row from public.lesson_events where school_id=legacy.school_id and id=request_row.lesson_event_id;
  select * into entitlement from public.lesson_service_entitlements where school_id=legacy.school_id and source_request_id=legacy.request_id;
  select * into policy_rules from public.cancellation_policy_rules where policy_version_id=request_row.policy_version_id;
  select outcome.id into outcome_id from public.cancellation_policy_outcomes outcome
  where outcome.policy_version_id=request_row.policy_version_id
    and outcome.scenario=case request_row.request_type when 'reschedule' then 'student_reschedule' else 'student_cancellation' end
    and outcome.timing_bucket=case when request_row.within_policy_window then 'timely' else 'late' end;

  if legacy.decision='declined' then
    calendar_value:='leave_scheduled'; service_value:='scheduled_not_yet_serviced';
    charge_value:='unchanged'; replacement_value:='none';
    summary_value:='The school declined this request. The lesson remains scheduled.';
  else
    calendar_value:=case legacy.lesson_resolution when 'retain_for_reschedule' then 'retain_for_later' else 'cancel' end;
    service_value:='not_serviced_student_cancelled';
    charge_value:=case legacy.accounting_disposition when 'charge' then 'keep_full_charge'
      when 'waive' then 'waive_full_charge' when 'credit' then 'account_credit' else 'manual_financial_review' end;
    replacement_value:=case legacy.lesson_resolution when 'retain_for_reschedule' then 'replacement_minutes' else 'none' end;
    summary_value:=case legacy.lesson_resolution
      when 'count_as_serviced' then 'The cancellation was confirmed. The original lesson charge remains and no replacement lesson was created.'
      when 'retain_for_reschedule' then 'The cancellation was confirmed and replacement lesson time remains available to schedule.'
      else 'The cancellation was confirmed and the original lesson charge was waived.' end;
  end if;
  if legacy.adjustment_kind is not null and legacy.adjustment_amount_cents>0 then
    adjustment_value:=jsonb_build_array(jsonb_build_object(
      'kind',legacy.adjustment_kind,'amount_cents',legacy.adjustment_amount_cents,
      'status','pending','source','legacy_decision'
    ));
  end if;

  insert into public.lesson_change_decision_revisions(
    school_id,request_id,revision_number,legacy_decision_id,request_disposition,
    calendar_action,service_outcome,original_charge_treatment,replacement_kind,
    replacement_minutes,beneficiary_student_id,teacher_constraint,replacement_teacher_id,
    transferable_within_account,expires_at,adjustment_actions,policy_outcome_id,
    policy_snapshot,actual_outcome_snapshot,is_policy_override,internal_reason,payer_summary,
    decided_by,decided_at
  ) values (
    legacy.school_id,legacy.request_id,1,legacy.id,legacy.decision,calendar_value,service_value,
    charge_value,replacement_value,
    case when replacement_value='replacement_minutes' then coalesce(entitlement.duration_minutes,
      greatest(5,extract(epoch from(event_row.ends_at-event_row.starts_at))::integer/60)) end,
    event_row.student_id,
    case when replacement_value='replacement_minutes' and policy_rules.must_keep_assigned_teacher then 'required' else 'unrestricted' end,
    case when replacement_value='replacement_minutes' and policy_rules.must_keep_assigned_teacher then event_row.teacher_id end,
    true,case when replacement_value='replacement_minutes' then coalesce(entitlement.expires_at,
      case when policy_rules.replacement_window_days is null then null
        else legacy.decided_at+(policy_rules.replacement_window_days*interval '1 day') end) end,
    adjustment_value,outcome_id,
    jsonb_build_object('policy_version_id',request_row.policy_version_id,'policy_lesson_resolution',legacy.policy_lesson_resolution,
      'policy_adjustment_amount_cents',legacy.policy_adjustment_amount_cents,'within_policy_window',request_row.within_policy_window),
    jsonb_build_object('legacy_decision_id',legacy.id,'lesson_resolution',legacy.lesson_resolution,
      'accounting_disposition',legacy.accounting_disposition),legacy.is_policy_override,legacy.reason,summary_value,
    legacy.decided_by,legacy.decided_at
  ) returning id into new_revision_id;
  update public.lesson_change_requests set current_decision_revision_id=new_revision_id where id=legacy.request_id;
  return new_revision_id;
end $$;
revoke all on function public.create_orthogonal_revision_for_legacy_decision(uuid) from public,anon,authenticated;

do $$ declare decision_row record; begin
  for decision_row in select id from public.lesson_change_request_decisions order by decided_at,id loop
    perform public.create_orthogonal_revision_for_legacy_decision(decision_row.id);
  end loop;
end $$;

create function public.sync_orthogonal_revision_after_legacy_decision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.create_orthogonal_revision_for_legacy_decision(new.id);
  return new;
end $$;
create trigger lesson_change_request_decisions_sync_revision
after insert on public.lesson_change_request_decisions for each row
execute function public.sync_orthogonal_revision_after_legacy_decision();
revoke all on function public.sync_orthogonal_revision_after_legacy_decision() from public,anon,authenticated;

create view public.lesson_change_current_decisions
with (security_invoker=true) as
select request.school_id,request.id as request_id,request.current_decision_revision_id,
  revision.revision_number,revision.request_disposition,revision.calendar_action,
  revision.service_outcome,revision.original_charge_treatment,revision.replacement_kind,
  revision.replacement_minutes,revision.beneficiary_student_id,revision.teacher_constraint,
  revision.replacement_teacher_id,revision.transferable_within_account,revision.expires_at,
  revision.adjustment_actions,revision.refund_action,revision.policy_outcome_id,
  revision.is_policy_override,revision.internal_reason,revision.payer_summary,
  revision.decided_by,revision.decided_at,revision.correlation_id
from public.lesson_change_requests request
join public.lesson_change_decision_revisions revision
  on revision.school_id=request.school_id and revision.id=request.current_decision_revision_id;
grant select on public.lesson_change_current_decisions to authenticated;
