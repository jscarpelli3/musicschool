-- Let an owner deliberately compose an editable invoice from an eligible,
-- immutable lesson price snapshot outside the invoice's default service month.

create function public.get_outstanding_lessons_for_billing_account(
  p_school_id uuid,p_billing_account_id uuid
) returns table(
  lesson_event_id uuid,student_name text,offering_name text,service_date date,
  starts_at timestamptz,amount_cents bigint,currency text
) language sql stable security definer set search_path='' as $$
  select event.id,
    trim(coalesce(person.preferred_name,person.first_name)||' '||person.last_name),
    snapshot.offering_name,snapshot.billing_service_date,event.starts_at,snapshot.amount_cents,snapshot.currency
  from public.lesson_events event
  join public.billing_account_students mapping on mapping.school_id=event.school_id and mapping.student_id=event.student_id and mapping.billing_account_id=p_billing_account_id
  join public.people person on person.school_id=event.school_id and person.id=event.student_id
  join public.lesson_event_price_snapshots snapshot on snapshot.school_id=event.school_id and snapshot.lesson_event_id=event.id
  cross join lateral public.compute_lesson_event_billing_disposition(p_school_id,event.id,now()) result
  where event.school_id=p_school_id
    and public.has_school_capability(p_school_id,'school.billing.manage')
    and snapshot.billing_mode='per_session'
    and (case when snapshot.billing_timing='before_service' and event.status='scheduled' then 'charge' else result->>'disposition' end)='charge'
    and snapshot.amount_cents>0
    and not exists(select 1 from public.lesson_payment_requests payment where payment.school_id=p_school_id and payment.billing_account_id=p_billing_account_id and payment.lesson_event_id=event.id and payment.status='succeeded')
    and not exists(select 1 from public.billing_source_invoice_allocations allocation where allocation.school_id=p_school_id and allocation.source_type='lesson' and allocation.source_id=event.id)
    and not exists(select 1 from public.billing_line_items item join public.billing_periods period on period.id=item.billing_period_id where item.school_id=p_school_id and item.source_type='lesson' and item.source_id=event.id and period.status<>'void')
  order by snapshot.billing_service_date,event.starts_at,event.id;
$$;

create function public.add_outstanding_lesson_to_billing_draft(
  p_school_id uuid,p_billing_period_id uuid,p_lesson_event_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid(); period_row public.billing_periods%rowtype; event_row record;
  result jsonb; disposition text; reason_code text; line_id uuid;
begin
  if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized'; end if;
  select * into period_row from public.billing_periods where school_id=p_school_id and id=p_billing_period_id for update;
  if not found then raise exception 'billing_period_not_found'; end if;
  if period_row.status not in ('draft','review') then raise exception 'billing_period_is_not_editable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':lesson:'||p_lesson_event_id::text,0));
  select event.id lesson_event_id,event.starts_at operational_starts_at,event.status,event.lesson_series_id,
    snapshot.id snapshot_id,snapshot.series_billing_terms_id,snapshot.billing_mode,snapshot.billing_timing,
    snapshot.amount_cents,snapshot.currency,snapshot.offering_name,snapshot.billing_service_date service_date
  into event_row
  from public.lesson_events event
  join public.billing_account_students mapping on mapping.school_id=event.school_id and mapping.student_id=event.student_id and mapping.billing_account_id=period_row.billing_account_id
  join public.lesson_event_price_snapshots snapshot on snapshot.school_id=event.school_id and snapshot.lesson_event_id=event.id
  where event.school_id=p_school_id and event.id=p_lesson_event_id;
  if not found then raise exception 'lesson_not_connected_to_payer'; end if;
  if event_row.billing_mode<>'per_session' then raise exception 'monthly_series_must_be_billed_as_series'; end if;
  if event_row.currency<>period_row.currency then raise exception 'mixed_billing_currency'; end if;
  if exists(select 1 from public.lesson_payment_requests payment where payment.school_id=p_school_id and payment.billing_account_id=period_row.billing_account_id and payment.lesson_event_id=p_lesson_event_id and payment.status='succeeded') then raise exception 'lesson_already_paid'; end if;
  if exists(select 1 from public.billing_source_invoice_allocations allocation where allocation.school_id=p_school_id and allocation.source_type='lesson' and allocation.source_id=p_lesson_event_id) then raise exception 'invoice_source_already_allocated'; end if;
  if exists(select 1 from public.billing_line_items item join public.billing_periods period on period.id=item.billing_period_id where item.school_id=p_school_id and item.source_type='lesson' and item.source_id=p_lesson_event_id and period.status<>'void') then raise exception 'lesson_already_on_invoice'; end if;
  result:=public.compute_lesson_event_billing_disposition(p_school_id,p_lesson_event_id,now());
  if event_row.billing_timing='before_service' and event_row.status='scheduled' then disposition:='charge'; reason_code:='scheduled_obligation';
  elsif result->>'state'='not_ready' then raise exception 'after_service_lesson_not_ready';
  else disposition:=result->>'disposition'; reason_code:=result->>'reason_code'; end if;
  if disposition<>'charge' or event_row.amount_cents<=0 then raise exception 'lesson_is_not_an_outstanding_charge'; end if;
  insert into public.billing_line_items(school_id,billing_period_id,source_type,source_id,description,service_date,unit_amount_cents,metadata,created_by,billing_terms_id,lesson_event_price_snapshot_id)
  values(p_school_id,period_row.id,'lesson',p_lesson_event_id,event_row.offering_name||' · '||to_char(event_row.service_date,'Mon FMDD'),event_row.service_date,event_row.amount_cents,
    jsonb_build_object('billing_mode',event_row.billing_mode,'billing_timing',event_row.billing_timing,'disposition','charge','reason_code',reason_code,
      'policy_version_id',result->>'policy_version_id','policy_disposition',result->>'policy_disposition','listed_amount_cents',event_row.amount_cents,
      'operational_starts_at',event_row.operational_starts_at,'manually_added_to_invoice',true),actor_id,event_row.series_billing_terms_id,event_row.snapshot_id)
  returning id into line_id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'billing_period.lesson_added','billing_period',period_row.id,jsonb_build_object('lesson_event_id',p_lesson_event_id,'billing_line_item_id',line_id,'service_date',event_row.service_date,'amount_cents',event_row.amount_cents));
  return line_id;
end; $$;

revoke all on function public.get_outstanding_lessons_for_billing_account(uuid,uuid) from public,anon;
grant execute on function public.get_outstanding_lessons_for_billing_account(uuid,uuid) to authenticated;
revoke all on function public.add_outstanding_lesson_to_billing_draft(uuid,uuid,uuid) from public,anon;
grant execute on function public.add_outstanding_lesson_to_billing_draft(uuid,uuid,uuid) to authenticated;

do $$ begin
  if has_function_privilege('anon','public.add_outstanding_lesson_to_billing_draft(uuid,uuid,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.add_outstanding_lesson_to_billing_draft(uuid,uuid,uuid)','EXECUTE')
  then raise exception 'outstanding_lesson_invoice_grants_incorrect'; end if;
end $$;
