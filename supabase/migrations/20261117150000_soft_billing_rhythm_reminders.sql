-- Billing timing describes a school's normal reminder rhythm. It never limits
-- an owner's authority to invoice a scheduled lesson or monthly tuition.

create or replace function public.compute_lesson_event_billing_disposition(
  p_school_id uuid,p_lesson_event_id uuid,p_as_of timestamptz default now()
) returns jsonb language plpgsql stable set search_path='' as $$
declare
  override_row public.lesson_accounting_overrides%rowtype;
  entitlement_id uuid;
  event_status text;
begin
  select event.service_entitlement_id,event.status into entitlement_id,event_status
  from public.lesson_events event
  where event.school_id=p_school_id and event.id=p_lesson_event_id;
  if entitlement_id is not null then
    return jsonb_build_object('lesson_event_id',p_lesson_event_id,'state','resolved','disposition','waive',
      'reason_code','funded_service_entitlement','service_entitlement_id',entitlement_id,
      'policy_version_id',null,'policy_disposition',null,'request_decision_id',null,'decision_revision_id',null);
  end if;
  select * into override_row from public.lesson_accounting_overrides
  where school_id=p_school_id and lesson_event_id=p_lesson_event_id;
  if found then
    return jsonb_build_object('lesson_event_id',p_lesson_event_id,'state','resolved',
      'disposition',override_row.disposition,'reason_code',override_row.reason_code,
      'policy_version_id',null,'policy_disposition',null,
      'request_decision_id',override_row.request_decision_id,'decision_revision_id',override_row.decision_revision_id);
  end if;
  if event_status='scheduled' then
    return jsonb_build_object('lesson_event_id',p_lesson_event_id,'state','resolved','disposition','charge',
      'reason_code','scheduled_obligation','policy_version_id',null,'policy_disposition',null,
      'request_decision_id',null,'decision_revision_id',null);
  end if;
  return public.compute_policy_lesson_event_billing_disposition(p_school_id,p_lesson_event_id,p_as_of);
end $$;
revoke all on function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz) to service_role;

-- The latest invoice preparation function still contains one fixed-monthly
-- timing guard. Remove only that obsolete guard while retaining its other
-- allocation, policy, and accounting protections.
do $$
declare definition text; revised_definition text;
begin
  definition:=pg_get_functiondef('public.prepare_family_billing_draft(uuid,uuid,date)'::regprocedure);
  revised_definition:=regexp_replace(
    definition,
    'raise[^;]*after_service_period_is_not_complete[^;]*;',
    'null; /* billing timing is a reminder preference, not an invoice restriction */',
    'i');
  if revised_definition<>definition then execute revised_definition; end if;
end $$;
revoke all on function public.prepare_family_billing_draft(uuid,uuid,date) from public,anon;
grant execute on function public.prepare_family_billing_draft(uuid,uuid,date) to authenticated;

alter table public.owner_notifications drop constraint owner_notifications_kind_check;
alter table public.owner_notifications add constraint owner_notifications_kind_check
  check (kind in (
    'payer_approved','payer_rejected','payment_failed','lesson_change_requested',
    'teacher_rescheduled','teacher_reschedule_requested','lesson_created','billing_reminder'
  ));

create or replace function public.queue_owner_notification_push()
returns trigger language plpgsql security definer set search_path='' as $$
declare category_value text;
begin
  category_value:=case
    when new.kind in('payer_approved','payer_rejected','payment_failed','billing_reminder') then 'billing_activity'
    when new.kind in('lesson_change_requested','teacher_rescheduled','teacher_reschedule_requested') then 'schedule_requests'
    when new.kind='lesson_created' then 'lesson_updates'
    else null end;
  if category_value is null then return new; end if;
  insert into public.push_notification_deliveries(notification_id,school_id,profile_id,category)
  select new.id,new.school_id,new.recipient_profile_id,category_value
  from public.school_notification_preferences preference
  where preference.school_id=new.school_id and preference.profile_id=new.recipient_profile_id
    and preference.browser_push_enabled
    and case category_value when 'billing_activity' then preference.billing_activity when 'schedule_requests' then preference.schedule_requests else preference.lesson_updates end
    and exists(select 1 from public.user_push_subscriptions subscription where subscription.profile_id=new.recipient_profile_id and subscription.status='active')
  on conflict(notification_id,profile_id) do nothing;
  return new;
end $$;
revoke all on function public.queue_owner_notification_push() from public,anon,authenticated;

create or replace function public.queue_billing_rhythm_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare inserted_count integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;

  with due as (
    select school.id school_id,school.name,school.billing_timing_default,
      (now() at time zone school.timezone)::date local_date
    from public.schools school
    where extract(day from now() at time zone school.timezone)::integer=school.billing_day
      and extract(hour from now() at time zone school.timezone)::integer between 8 and 20
  )
  insert into public.owner_notifications(
    school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata
  )
  select due.school_id,member.profile_id,'billing_reminder','It’s a good day to review invoices',
    case due.billing_timing_default
      when 'after_service' then 'Your usual invoice day is here. Review completed lessons and prepare only the invoices you want.'
      else 'Your usual invoice day is here. Review upcoming lessons and prepare only the invoices you want.' end,
    '/schools/'||due.school_id||'/invoices',
    'billing-rhythm:prepare:'||due.school_id||':'||to_char(due.local_date,'YYYY-MM'),
    'school',due.school_id,jsonb_build_object('reminder_type','invoice_preparation','local_date',due.local_date)
  from due join public.school_members member on member.school_id=due.school_id
  where member.status='active' and member.role in('owner','admin')
  on conflict(recipient_profile_id,dedupe_key) do nothing;
  get diagnostics inserted_count=row_count;

  with due as (
    select school.id school_id,school.name,(now() at time zone school.timezone)::date local_date,
      (select count(*) from public.billing_periods period
       where period.school_id=school.id and period.status in('approved','payment_failed')) approved_count
    from public.schools school
    where extract(day from now() at time zone school.timezone)::integer=school.intended_charge_day
      and extract(hour from now() at time zone school.timezone)::integer between 8 and 20
  ),created as (
    insert into public.owner_notifications(
      school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata
    )
    select due.school_id,member.profile_id,'billing_reminder','Approved invoices are ready to review',
      due.approved_count||case when due.approved_count=1 then ' approved invoice is' else ' approved invoices are' end||' ready for collection. Review each one before charging or recording outside payment.',
      '/schools/'||due.school_id||'/invoices',
      'billing-rhythm:collect:'||due.school_id||':'||to_char(due.local_date,'YYYY-MM'),
      'school',due.school_id,jsonb_build_object('reminder_type','collection','local_date',due.local_date,'invoice_count',due.approved_count)
    from due join public.school_members member on member.school_id=due.school_id
    where due.approved_count>0 and member.status='active' and member.role in('owner','admin')
    on conflict(recipient_profile_id,dedupe_key) do nothing returning 1
  ) select inserted_count+count(*) into inserted_count from created;
  return inserted_count;
end $$;
revoke all on function public.queue_billing_rhythm_reminders() from public,anon,authenticated;
grant execute on function public.queue_billing_rhythm_reminders() to service_role;

comment on column public.schools.billing_timing_default is 'School-wide reminder preference for reviewing invoices before or after service; never an invoice eligibility restriction.';
comment on column public.schools.billing_day is 'Local calendar day for the monthly invoice-preparation reminder.';
comment on column public.schools.intended_charge_day is 'Local calendar day for reminding owners about approved unpaid invoices.';
comment on function public.queue_billing_rhythm_reminders() is 'Creates deduplicated owner/admin billing reminders according to each school local calendar.';
