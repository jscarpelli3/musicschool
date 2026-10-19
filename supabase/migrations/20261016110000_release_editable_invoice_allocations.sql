-- Source reservations protect locked and later invoices. Any transition back
-- to an editable state must release them, regardless of the prior submitted
-- lifecycle state (locked, approval_pending, approved, or payment_failed).

create or replace function public.sync_billing_source_allocations()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status is distinct from new.status and new.status='locked' then
    insert into public.billing_source_invoice_allocations(
      school_id,billing_period_id,billing_line_item_id,source_type,source_id
    )
    select item.school_id,item.billing_period_id,item.id,item.source_type,item.source_id
    from public.billing_line_items item
    where item.billing_period_id=new.id and item.source_type in ('lesson','lesson_series') and item.source_id is not null;
  elsif old.status is distinct from new.status and new.status in ('draft','review','void') then
    delete from public.billing_source_invoice_allocations where billing_period_id=new.id;
  end if;
  return new;
exception when unique_violation then
  raise exception 'invoice_source_already_allocated';
end; $$;

delete from public.billing_source_invoice_allocations allocation
using public.billing_periods period
where period.id=allocation.billing_period_id and period.status in ('draft','review','void');

do $$ begin
  if exists(
    select 1 from public.billing_source_invoice_allocations allocation
    join public.billing_periods period on period.id=allocation.billing_period_id
    where period.status in ('draft','review','void')
  ) then raise exception 'editable invoice source allocation cleanup failed'; end if;
end $$;
