create or replace function public.unlock_unsubmitted_billing_period(
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
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then raise exception 'not_authorized'; end if;
  select * into period_row from public.billing_periods
  where school_id = p_school_id and id = p_billing_period_id for update;
  if not found then raise exception 'billing_period_not_found'; end if;
  if period_row.status <> 'locked' then raise exception 'billing_period_not_locked'; end if;
  if exists (
    select 1 from public.billing_approval_requests request
    where request.billing_period_id = period_row.id and request.approval_status in ('pending','approved')
  ) then raise exception 'approval_request_requires_replacement_flow'; end if;

  update public.billing_periods set status = 'review', locked_at = null where id = period_row.id;
  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (p_school_id, actor_id, 'billing_period.unlocked_for_revision', 'billing_period', period_row.id,
    jsonb_build_object('amount_cents', period_row.amount_due_cents, 'prior_locked_at', period_row.locked_at));
  return period_row.id;
end;
$$;

revoke all on function public.unlock_unsubmitted_billing_period(uuid,uuid) from public, anon;
grant execute on function public.unlock_unsubmitted_billing_period(uuid,uuid) to authenticated;

comment on function public.unlock_unsubmitted_billing_period(uuid,uuid) is
  'Returns an unsent locked period to review without changing any line; submitted approvals require a separate replacement flow.';
