-- Deliberate owner lock. This freezes the reviewed amount before any payer
-- approval request can be created.

create or replace function public.lock_family_billing_period(
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
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then
    raise exception 'not_authorized';
  end if;

  select * into period_row
  from public.billing_periods
  where school_id = p_school_id and id = p_billing_period_id
  for update;
  if not found then raise exception 'billing_period_not_found'; end if;

  if period_row.status = 'locked' then return period_row.id; end if;
  if period_row.status = 'draft' then
    update public.billing_periods set status = 'review' where id = period_row.id;
  elsif period_row.status <> 'review' then
    raise exception 'billing_period_is_not_lockable';
  end if;

  update public.billing_periods set status = 'locked' where id = period_row.id;

  insert into public.audit_log (
    school_id, actor_profile_id, action, entity_type, entity_id, metadata
  ) values (
    p_school_id, actor_id, 'billing_period.locked', 'billing_period', period_row.id,
    jsonb_build_object('amount_due_cents', period_row.amount_due_cents, 'currency', period_row.currency)
  );
  return period_row.id;
end;
$$;

revoke all on function public.lock_family_billing_period(uuid, uuid) from public, anon;
grant execute on function public.lock_family_billing_period(uuid, uuid) to authenticated;

comment on function public.lock_family_billing_period(uuid, uuid) is
  'Owner/admin-only idempotent transition from draft/review to immutable locked billing period.';
