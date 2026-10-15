-- A lesson waiver must not leave an exact-amount payer approval collectible.
-- Reconcile the affected statement inside the same transaction as the lesson
-- resolution. Approved/submitted statements are immutable history, so they are
-- voided and any remaining lines are copied to a new owner-review draft.

alter table public.billing_approval_requests drop constraint billing_approval_requests_check;
alter table public.billing_approval_requests add constraint billing_approval_requests_check
  check(approved_at is null or approval_status in ('approved','cancelled'));

create function public.reconcile_waived_lesson_invoice()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  revision_row public.lesson_change_decision_revisions%rowtype;
  period_row public.billing_periods%rowtype;
  lesson_line public.billing_line_items%rowtype;
  approval_row record;
  replacement_id uuid;
  replacement_number integer;
  remaining_amount bigint;
begin
  if old.status not in ('pending','in_progress') or new.status<>'approved'
    or new.current_decision_revision_id is null then return new; end if;

  select * into revision_row from public.lesson_change_decision_revisions
  where school_id=new.school_id and id=new.current_decision_revision_id;
  if not found or revision_row.request_id<>new.id
    or revision_row.original_charge_treatment<>'waive_full_charge' then return new; end if;

  select period.* into period_row
  from public.billing_line_items item
  join public.billing_periods period on period.id=item.billing_period_id and period.school_id=item.school_id
  where item.school_id=new.school_id and item.source_type='lesson' and item.source_id=new.lesson_event_id
    and period.status in ('draft','review','locked','approval_pending','approved')
  order by period.created_at desc limit 1
  for update of period;
  if not found then return new; end if;
  select * into lesson_line from public.billing_line_items
  where school_id=new.school_id and billing_period_id=period_row.id
    and source_type='lesson' and source_id=new.lesson_event_id for update;
  if not found then raise exception 'waived_lesson_invoice_line_missing'; end if;

  if period_row.status in ('draft','review') then
    delete from public.billing_line_items where id=lesson_line.id;
    if not exists(select 1 from public.billing_line_items where billing_period_id=period_row.id)
      or (select amount_due_cents from public.billing_periods where id=period_row.id)<=0 then
      update public.billing_periods set status='void' where id=period_row.id;
    end if;
    insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
    values(new.school_id,revision_row.decided_by,'billing_period.waived_lesson_removed','billing_period',period_row.id,
      jsonb_build_object('lesson_event_id',new.lesson_event_id,'request_id',new.id,'decision_revision_id',revision_row.id));
    return new;
  end if;

  remaining_amount:=period_row.amount_due_cents-coalesce(lesson_line.amount_cents,0);
  if remaining_amount<0 then raise exception 'waived_lesson_invoice_remainder_invalid'; end if;

  for approval_row in
    update public.billing_approval_requests
      set approval_status='cancelled',cancelled_at=now()
      where school_id=new.school_id and billing_period_id=period_row.id
        and approval_status in ('pending','approved')
      returning id,amount_cents,request_version
  loop
    insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel,evidence)
    values(new.school_id,approval_row.id,'cancelled','system',jsonb_build_object(
      'reason','approved_lesson_waived','lesson_event_id',new.lesson_event_id,
      'lesson_change_request_id',new.id,'billing_period_id',period_row.id,
      'amount_cents',approval_row.amount_cents,'request_version',approval_row.request_version));
  end loop;

  update public.billing_periods set status='void' where id=period_row.id;

  if remaining_amount>0 then
    select count(*)+1 into replacement_number from public.billing_periods
    where billing_account_id=period_row.billing_account_id
      and period_start=period_row.period_start and period_end=period_row.period_end;
    insert into public.billing_periods(
      school_id,billing_account_id,period_start,period_end,label,currency,status,created_by
    ) values(
      period_row.school_id,period_row.billing_account_id,period_row.period_start,period_row.period_end,
      left(to_char(period_row.period_start,'FMMonth YYYY')||' · Invoice '||replacement_number,120),
      period_row.currency,'draft',revision_row.decided_by
    ) returning id into replacement_id;

    insert into public.billing_line_items(
      school_id,billing_period_id,source_type,source_id,description,service_date,quantity,
      unit_amount_cents,metadata,created_by,billing_terms_id,lesson_event_price_snapshot_id,
      charge_category_code
    )
    select item.school_id,replacement_id,item.source_type,item.source_id,item.description,item.service_date,item.quantity,
      item.unit_amount_cents,item.metadata||jsonb_build_object('revised_from_billing_period_id',period_row.id),
      revision_row.decided_by,item.billing_terms_id,item.lesson_event_price_snapshot_id,item.charge_category_code
    from public.billing_line_items item
    where item.billing_period_id=period_row.id and item.id<>lesson_line.id;

    if (select amount_due_cents from public.billing_periods where id=replacement_id)<>remaining_amount then
      raise exception 'waived_lesson_replacement_amount_mismatch'; end if;
  end if;

  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(new.school_id,revision_row.decided_by,'billing_period.superseded_for_waived_lesson','billing_period',period_row.id,
    jsonb_build_object('lesson_event_id',new.lesson_event_id,'request_id',new.id,
      'decision_revision_id',revision_row.id,'old_amount_cents',period_row.amount_due_cents,
      'replacement_billing_period_id',replacement_id,'replacement_amount_cents',remaining_amount));
  return new;
end $$;

create trigger lesson_change_requests_reconcile_waived_invoice
after update of status,current_decision_revision_id on public.lesson_change_requests
for each row execute function public.reconcile_waived_lesson_invoice();

revoke all on function public.reconcile_waived_lesson_invoice() from public,anon,authenticated;

do $$ begin
  if not exists(select 1 from pg_trigger where tgrelid='public.lesson_change_requests'::regclass
    and tgname='lesson_change_requests_reconcile_waived_invoice' and not tgisinternal)
  then raise exception 'waived lesson invoice reconciliation trigger missing'; end if;
end $$;
