create or replace function public.add_billing_adjustment(
  p_school_id uuid,
  p_billing_period_id uuid,
  p_kind text,
  p_category text,
  p_description text,
  p_amount_cents bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  period_row public.billing_periods%rowtype;
  adjustment_id uuid;
  signed_amount bigint;
  clean_category text := trim(p_category);
  clean_description text := trim(p_description);
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then raise exception 'not_authorized'; end if;
  if p_kind not in ('charge','credit') then raise exception 'invalid_adjustment_kind'; end if;
  if length(clean_category) not between 1 and 80 then raise exception 'invalid_adjustment_category'; end if;
  if length(clean_description) not between 1 and 300 then raise exception 'invalid_adjustment_description'; end if;
  if p_amount_cents <= 0 or p_amount_cents > 100000000 then raise exception 'invalid_adjustment_amount'; end if;

  select * into period_row from public.billing_periods
  where id = p_billing_period_id and school_id = p_school_id for update;
  if not found then raise exception 'billing_period_not_found'; end if;
  if period_row.status not in ('draft','review') then raise exception 'billing_period_not_editable'; end if;
  signed_amount := case when p_kind = 'credit' then -p_amount_cents else p_amount_cents end;

  insert into public.billing_line_items (
    school_id, billing_period_id, source_type, description, unit_amount_cents,
    metadata, created_by
  ) values (
    p_school_id, period_row.id, 'manual_adjustment', clean_category || ' · ' || clean_description,
    signed_amount,
    jsonb_build_object('adjustment_kind', p_kind, 'category', clean_category, 'explanation', clean_description),
    actor_id
  ) returning id into adjustment_id;

  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (p_school_id, actor_id, 'billing_adjustment.added', 'billing_line_item', adjustment_id,
    jsonb_build_object('billing_period_id', period_row.id, 'kind', p_kind, 'category', clean_category, 'amount_cents', signed_amount));
  return adjustment_id;
end;
$$;

create or replace function public.remove_billing_adjustment(
  p_school_id uuid,
  p_billing_period_id uuid,
  p_adjustment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  adjustment public.billing_line_items%rowtype;
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then raise exception 'not_authorized'; end if;
  select item.* into adjustment from public.billing_line_items item
  join public.billing_periods period on period.id = item.billing_period_id and period.school_id = item.school_id
  where item.id = p_adjustment_id and item.school_id = p_school_id
    and item.billing_period_id = p_billing_period_id and item.source_type = 'manual_adjustment'
    and period.status in ('draft','review')
  for update of item;
  if not found then raise exception 'editable_adjustment_not_found'; end if;

  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (p_school_id, actor_id, 'billing_adjustment.removed', 'billing_line_item', adjustment.id,
    jsonb_build_object('billing_period_id', adjustment.billing_period_id, 'amount_cents', adjustment.amount_cents,
      'description', adjustment.description, 'metadata', adjustment.metadata));
  delete from public.billing_line_items where id = adjustment.id;
end;
$$;

revoke all on function public.add_billing_adjustment(uuid,uuid,text,text,text,bigint) from public, anon;
revoke all on function public.remove_billing_adjustment(uuid,uuid,uuid) from public, anon;
grant execute on function public.add_billing_adjustment(uuid,uuid,text,text,text,bigint) to authenticated;
grant execute on function public.remove_billing_adjustment(uuid,uuid,uuid) to authenticated;

comment on function public.add_billing_adjustment(uuid,uuid,text,text,text,bigint) is
  'Adds an explained owner charge or credit only while a billing period remains editable.';
