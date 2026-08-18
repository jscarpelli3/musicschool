update public.owner_notification_email_outbox set retry_count=5 where retry_count>5;
alter table public.owner_notification_email_outbox drop constraint owner_notification_email_outbox_retry_count_check;
alter table public.owner_notification_email_outbox add constraint owner_notification_email_outbox_retry_count_check
  check (retry_count between 0 and 5);

create or replace function public.claim_owner_notification_email_retry(p_delivery_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); delivery_row public.owner_notification_email_outbox%rowtype;
begin
  if actor_id is null then return 'not_authorized'; end if;
  select * into delivery_row from public.owner_notification_email_outbox where id=p_delivery_id for update;
  if not found or not public.has_school_role(delivery_row.school_id,array['owner','admin']) then return 'not_authorized'; end if;
  if delivery_row.status <> 'failed' then return 'not_retryable'; end if;
  if delivery_row.retry_count >= 5 then return 'retry_limit_reached'; end if;
  if delivery_row.retry_not_before is not null and delivery_row.retry_not_before > now() then return 'cooldown'; end if;
  update public.owner_notification_email_outbox
  set status='pending',retry_count=retry_count+1,retry_not_before=null
  where id=p_delivery_id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(delivery_row.school_id,actor_id,'owner_notification_email.retry_claimed','owner_notification_email_outbox',p_delivery_id,
    jsonb_build_object('retry_count',delivery_row.retry_count+1));
  return 'claimed';
end; $$;
