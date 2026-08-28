-- A cancellation policy describes the normal outcome. Authorized school staff
-- may still make a documented case-specific decision without rewriting history.

alter table public.cancellation_policy_rules
  add column late_lesson_resolution text not null default 'count_as_serviced'
    check (late_lesson_resolution in ('count_as_serviced','retain_for_reschedule','waive','manual_review')),
  add column late_reschedule_fee_cents integer not null default 0
    check (late_reschedule_fee_cents between 0 and 1000000),
  add column late_fee_timing text not null default 'next_open_invoice'
    check (late_fee_timing in ('next_open_invoice'));

comment on column public.cancellation_policy_rules.late_lesson_resolution is
  'Default lesson-entitlement result for a late cancellation; an authorized owner/admin may override the individual case.';
comment on column public.cancellation_policy_rules.late_reschedule_fee_cents is
  'Separate fee charged when late_lesson_resolution retains the lesson for rescheduling. Zero means no fee.';

create or replace function public.publish_default_cancellation_policy(
  p_school_id uuid,
  p_name text,
  p_cancel_cutoff_hours integer,
  p_reschedule_cutoff_hours integer,
  p_timely_disposition text,
  p_late_lesson_resolution text,
  p_late_reschedule_fee_cents integer,
  p_replacement_window_days integer,
  p_must_keep_assigned_teacher boolean,
  p_timely_guidance text,
  p_late_guidance text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid:=auth.uid();
  actor_school_role text;
  target_policy_id uuid;
  version_id uuid;
  next_version integer;
  clean_name text:=trim(coalesce(p_name,''));
  clean_timely text:=trim(coalesce(p_timely_guidance,''));
  clean_late text:=trim(coalesce(p_late_guidance,''));
  late_billing_disposition text;
begin
  select member.role into actor_school_role
  from public.school_members member
  where member.school_id=p_school_id and member.profile_id=actor_id and member.status='active';

  if actor_id is null or actor_school_role not in ('owner','admin') then raise exception 'not_authorized'; end if;
  if length(clean_name) not between 1 and 120
    or p_cancel_cutoff_hours not between 0 and 8760
    or p_reschedule_cutoff_hours not between 0 and 8760
    or p_timely_disposition not in ('charge','credit','waive','manual_review')
    or p_late_lesson_resolution not in ('count_as_serviced','retain_for_reschedule','waive','manual_review')
    or p_late_reschedule_fee_cents not between 0 and 1000000
    or p_replacement_window_days is not null and p_replacement_window_days not between 0 and 365
    or length(clean_timely) not between 1 and 1000
    or length(clean_late) not between 1 and 1000
  then raise exception 'invalid_cancellation_policy'; end if;
  if p_late_lesson_resolution<>'retain_for_reschedule' and p_late_reschedule_fee_cents<>0 then
    raise exception 'fee_requires_reschedule_entitlement';
  end if;

  select policy.id into target_policy_id
  from public.school_policies policy
  where policy.school_id=p_school_id and policy.kind='cancellation'
    and policy.status='active' and policy.is_default
  for update;

  if target_policy_id is null then
    insert into public.school_policies(school_id,kind,name,is_default,status,created_by)
    values(p_school_id,'cancellation',clean_name,true,'active',actor_id)
    returning id into target_policy_id;
  else
    update public.school_policies set name=clean_name where id=target_policy_id;
  end if;

  select coalesce(max(version.version_number),0)+1 into next_version
  from public.school_policy_versions version where version.policy_id=target_policy_id;

  insert into public.school_policy_versions(
    school_id,policy_id,version_number,editor_content,plain_text,effective_from,published_at,created_by
  ) values (
    p_school_id,target_policy_id,next_version,
    jsonb_build_object(
      'cancel_cutoff_hours',p_cancel_cutoff_hours,
      'reschedule_cutoff_hours',p_reschedule_cutoff_hours,
      'timely_disposition',p_timely_disposition,
      'late_lesson_resolution',p_late_lesson_resolution,
      'late_reschedule_fee_cents',p_late_reschedule_fee_cents,
      'replacement_window_days',p_replacement_window_days,
      'must_keep_assigned_teacher',p_must_keep_assigned_teacher,
      'timely_guidance',clean_timely,
      'late_guidance',clean_late
    ),
    clean_timely||E'\n\n'||clean_late,
    now(),now(),actor_id
  ) returning id into version_id;

  late_billing_disposition:=case p_late_lesson_resolution
    when 'count_as_serviced' then 'charge'
    when 'waive' then 'waive'
    else 'manual_review'
  end;

  insert into public.cancellation_policy_rules(
    policy_version_id,student_cancel_cutoff_hours,student_reschedule_cutoff_hours,
    replacement_window_days,must_keep_assigned_teacher,timely_cancel_disposition,
    late_cancel_disposition,no_show_disposition,teacher_cancel_disposition,
    timely_request_guidance,late_request_guidance,late_lesson_resolution,
    late_reschedule_fee_cents,late_fee_timing
  ) values (
    version_id,p_cancel_cutoff_hours,p_reschedule_cutoff_hours,
    p_replacement_window_days,p_must_keep_assigned_teacher,p_timely_disposition,
    late_billing_disposition,'charge','credit',clean_timely,clean_late,
    p_late_lesson_resolution,p_late_reschedule_fee_cents,'next_open_invoice'
  );

  insert into public.domain_events(
    school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload
  ) values (
    p_school_id,'school.cancellation_policy_published','school_policy',target_policy_id,
    actor_id,actor_school_role,'policy_editor',
    jsonb_build_object('policy_version_id',version_id,'version_number',next_version)
  );
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'school.cancellation_policy_published','school_policy',target_policy_id,
    jsonb_build_object('policy_version_id',version_id,'version_number',next_version));

  return version_id;
end $$;

revoke all on function public.publish_default_cancellation_policy(uuid,text,integer,integer,text,text,integer,integer,boolean,text,text) from public,anon;
grant execute on function public.publish_default_cancellation_policy(uuid,text,integer,integer,text,text,integer,integer,boolean,text,text) to authenticated;

create or replace function public.preview_client_lesson_change_request(p_lesson_event_id uuid,p_request_type text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare event_row record; policy_row record; cutoff integer; within_window boolean; accounting text;
begin
  if auth.role()<>'authenticated' or public.current_client_portal_access_state()<>'ready'
    or p_request_type not in ('cancellation','reschedule') then raise exception 'portal_access_denied' using errcode='42501'; end if;
  select event.*,mapping.billing_account_id into event_row
  from public.lesson_events event
  join public.billing_account_students mapping on mapping.school_id=event.school_id and mapping.student_id=event.student_id
  join public.payer_portal_authorizations portal_auth on portal_auth.school_id=mapping.school_id and portal_auth.billing_account_id=mapping.billing_account_id
  where event.id=p_lesson_event_id and event.status='scheduled'
    and portal_auth.normalized_email=lower(nullif(trim(auth.jwt()->>'email'),''));
  if not found then raise exception 'lesson_not_available' using errcode='42501'; end if;

  select version.id,rules.student_cancel_cutoff_hours,rules.student_reschedule_cutoff_hours,
    rules.timely_cancel_disposition,rules.late_cancel_disposition,rules.timely_request_guidance,rules.late_request_guidance,
    rules.late_lesson_resolution,rules.late_reschedule_fee_cents,rules.replacement_window_days,rules.must_keep_assigned_teacher
  into policy_row from public.school_policies policy
  join public.school_policy_versions version on version.school_id=policy.school_id and version.policy_id=policy.id
  join public.cancellation_policy_rules rules on rules.policy_version_id=version.id
  where policy.school_id=event_row.school_id and policy.kind='cancellation' and policy.status='active'
    and policy.id=coalesce((select selection.policy_id from public.service_product_policy_selections selection
      where selection.school_id=event_row.school_id and selection.product_id=event_row.product_id
        and selection.policy_kind='cancellation' and not selection.use_school_default),
      (select default_policy.id from public.school_policies default_policy where default_policy.school_id=event_row.school_id
        and default_policy.kind='cancellation' and default_policy.status='active' and default_policy.is_default))
    and version.published_at is not null and coalesce(version.effective_from,version.published_at)<=event_row.starts_at
  order by coalesce(version.effective_from,version.published_at) desc,version.version_number desc limit 1;
  if not found then raise exception 'published_cancellation_policy_required'; end if;
  cutoff:=case when p_request_type='cancellation' then policy_row.student_cancel_cutoff_hours else policy_row.student_reschedule_cutoff_hours end;
  within_window:=now()<=event_row.starts_at-(cutoff*interval '1 hour');
  select case
    when bool_or(period.status='paid') then 'paid'
    when bool_or(period.status in ('approved','collecting','payment_failed')) then 'approved'
    when bool_or(period.status in ('locked','approval_pending')) then 'locked'
    when bool_or(period.status in ('draft','review')) then 'draft'
    else 'unaccounted' end into accounting
  from public.billing_line_items item join public.billing_periods period on period.id=item.billing_period_id
  where item.school_id=event_row.school_id and item.source_type='lesson' and item.source_id=event_row.id;
  return jsonb_build_object('lesson_id',event_row.id,'school_id',event_row.school_id,'billing_account_id',event_row.billing_account_id,
    'request_type',p_request_type,'lesson_starts_at',event_row.starts_at,'policy_version_id',policy_row.id,
    'cutoff_hours',cutoff,'within_policy_window',within_window,
    'policy_disposition',case when within_window then policy_row.timely_cancel_disposition else policy_row.late_cancel_disposition end,
    'policy_guidance',case when within_window then policy_row.timely_request_guidance else policy_row.late_request_guidance end,
    'late_lesson_resolution',case when within_window then null else policy_row.late_lesson_resolution end,
    'late_reschedule_fee_cents',case when within_window then 0 else policy_row.late_reschedule_fee_cents end,
    'replacement_window_days',case when within_window then null else policy_row.replacement_window_days end,
    'must_keep_assigned_teacher',policy_row.must_keep_assigned_teacher,
    'accounting_state',coalesce(accounting,'unaccounted'));
end; $$;
