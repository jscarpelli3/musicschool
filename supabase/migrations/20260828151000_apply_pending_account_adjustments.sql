create unique index billing_line_items_pending_adjustment_unique
on public.billing_line_items((metadata->>'pending_adjustment_id'))
where metadata ? 'pending_adjustment_id';

create or replace function public.apply_pending_account_adjustments_to_period(
  p_school_id uuid,p_billing_account_id uuid,p_billing_period_id uuid,p_actor_id uuid
) returns integer language plpgsql security definer set search_path='' as $$
declare pending_row public.billing_account_pending_adjustments%rowtype; line_id uuid; applied_count integer:=0;
begin
  if not exists(select 1 from public.billing_periods period where period.id=p_billing_period_id
    and period.school_id=p_school_id and period.billing_account_id=p_billing_account_id and period.status in ('draft','review'))
  then return 0; end if;
  for pending_row in select * from public.billing_account_pending_adjustments adjustment
    where adjustment.school_id=p_school_id and adjustment.billing_account_id=p_billing_account_id and adjustment.status='pending'
    order by adjustment.created_at,adjustment.id for update skip locked
  loop
    line_id:=null;
    insert into public.billing_line_items(school_id,billing_period_id,source_type,source_id,description,
      unit_amount_cents,metadata,created_by)
    values(p_school_id,p_billing_period_id,'manual_adjustment',pending_row.source_request_id,pending_row.description,
      case when pending_row.kind='credit' then -pending_row.amount_cents else pending_row.amount_cents end,
      jsonb_build_object('pending_adjustment_id',pending_row.id,'adjustment_kind',pending_row.kind,
        'source_request_id',pending_row.source_request_id),p_actor_id)
    on conflict((metadata->>'pending_adjustment_id')) where metadata ? 'pending_adjustment_id' do nothing
    returning id into line_id;
    if line_id is null then
      select item.id into line_id from public.billing_line_items item
      where item.metadata->>'pending_adjustment_id'=pending_row.id::text;
    end if;
    if line_id is not null then
      update public.billing_account_pending_adjustments set status='applied',billing_line_item_id=line_id
      where id=pending_row.id and status='pending';
      applied_count:=applied_count+1;
    end if;
  end loop;
  return applied_count;
end $$;

create or replace function public.apply_pending_adjustments_after_adjustment_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare period_id uuid;
begin
  select period.id into period_id from public.billing_periods period
  where period.school_id=new.school_id and period.billing_account_id=new.billing_account_id
    and period.status in ('draft','review') order by period.period_start desc limit 1 for update;
  if period_id is not null then
    perform public.apply_pending_account_adjustments_to_period(new.school_id,new.billing_account_id,period_id,new.created_by);
  end if;
  return new;
end $$;
create trigger pending_adjustment_apply_to_open_period after insert on public.billing_account_pending_adjustments
for each row execute function public.apply_pending_adjustments_after_adjustment_insert();

create or replace function public.apply_pending_adjustments_after_period_open()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('draft','review') then
    perform public.apply_pending_account_adjustments_to_period(new.school_id,new.billing_account_id,new.id,new.created_by);
  end if;
  return new;
end $$;
create trigger billing_period_apply_pending_adjustments after insert or update of status on public.billing_periods
for each row execute function public.apply_pending_adjustments_after_period_open();

revoke all on function public.apply_pending_account_adjustments_to_period(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.apply_pending_adjustments_after_adjustment_insert() from public,anon,authenticated;
revoke all on function public.apply_pending_adjustments_after_period_open() from public,anon,authenticated;

create or replace function public.set_lesson_service_entitlement_status(
  p_school_id uuid,p_entitlement_id uuid,p_status text,p_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_role text; old_row public.lesson_service_entitlements%rowtype; clean_reason text:=trim(coalesce(p_reason,''));
begin
  select member.role into actor_role from public.school_members member
  where member.school_id=p_school_id and member.profile_id=actor_id and member.status='active';
  if actor_id is null or actor_role not in ('owner','admin') then raise exception 'not_authorized'; end if;
  if p_status not in ('waiting_to_schedule','scheduled','serviced','waived','voided') or length(clean_reason) not between 1 and 1000 then raise exception 'invalid_entitlement_change'; end if;
  select * into old_row from public.lesson_service_entitlements where school_id=p_school_id and id=p_entitlement_id for update;
  if not found then raise exception 'entitlement_not_found'; end if;
  if old_row.status=p_status then return; end if;
  update public.lesson_service_entitlements set status=p_status where id=p_entitlement_id;
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'lesson_service_entitlement.status_changed','lesson_service_entitlement',p_entitlement_id,
    actor_id,actor_role,'owner_manual_control',jsonb_build_object('before',old_row.status,'after',p_status,'reason',clean_reason));
end $$;
revoke all on function public.set_lesson_service_entitlement_status(uuid,uuid,text,text) from public,anon;
grant execute on function public.set_lesson_service_entitlement_status(uuid,uuid,text,text) to authenticated;
