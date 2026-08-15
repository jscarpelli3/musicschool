create or replace function public.revise_submitted_billing_period(
  p_school_id uuid,
  p_billing_period_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  period_row public.billing_periods%rowtype;
  request_row public.billing_approval_requests%rowtype;
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then raise exception 'not_authorized'; end if;
  select * into period_row from public.billing_periods
  where school_id = p_school_id and id = p_billing_period_id for update;
  if not found then raise exception 'billing_period_not_found'; end if;
  if period_row.status <> 'approval_pending' then raise exception 'billing_period_not_awaiting_approval'; end if;

  select * into request_row from public.billing_approval_requests request
  where request.school_id = p_school_id and request.billing_period_id = period_row.id
    and request.approval_status = 'pending'
  order by request.request_version desc for update limit 1;
  if not found then raise exception 'pending_approval_request_not_found'; end if;

  update public.billing_approval_requests set approval_status = 'cancelled', cancelled_at = now()
  where id = request_row.id;
  insert into public.billing_approval_events (school_id,approval_request_id,event_type,channel,evidence)
  values (p_school_id,request_row.id,'cancelled','system',jsonb_build_object(
    'reason','owner_revision','billing_period_id',period_row.id,'amount_cents',request_row.amount_cents,'request_version',request_row.request_version
  ));
  update public.billing_periods set status = 'review', locked_at = null where id = period_row.id;
  insert into public.audit_log (school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values (p_school_id,actor_id,'billing_period.submitted_revision_started','billing_period',period_row.id,jsonb_build_object(
    'cancelled_approval_request_id',request_row.id,'request_version',request_row.request_version,'amount_cents',period_row.amount_due_cents
  ));
  return request_row.id;
end;
$$;

revoke all on function public.revise_submitted_billing_period(uuid,uuid) from public, anon;
grant execute on function public.revise_submitted_billing_period(uuid,uuid) to authenticated;

comment on function public.revise_submitted_billing_period(uuid,uuid) is
  'Cancels one pending exact-amount bearer request before returning its unchanged period to owner review.';
