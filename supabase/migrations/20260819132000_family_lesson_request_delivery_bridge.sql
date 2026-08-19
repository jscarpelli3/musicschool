create or replace function public.get_pending_lesson_request_emails(p_request_id uuid)
returns table(id uuid,school_id uuid,recipient_email text,subject text,message_text text,idempotency_key text)
language sql stable security definer set search_path='' as $$
  select outbox.id,outbox.school_id,outbox.recipient_email,outbox.subject,outbox.message_text,outbox.idempotency_key
  from public.lesson_request_email_outbox outbox where auth.role()='service_role'
    and outbox.request_id=p_request_id and outbox.status='pending' order by outbox.created_at,outbox.id;
$$;
create or replace function public.record_lesson_request_email_submission(p_delivery_id uuid,p_provider_email_id text,p_error_code text default null,p_error_message text default null)
returns boolean language plpgsql security definer set search_path='' as $$ begin
  if auth.role()<>'service_role' then return false; end if;
  if p_provider_email_id is not null then update public.lesson_request_email_outbox set status='accepted',provider_email_id=p_provider_email_id,
    accepted_at=now(),provider_error_code=null,provider_error_message=null where id=p_delivery_id and status='pending';
  else update public.lesson_request_email_outbox set status='failed',provider_error_code=coalesce(p_error_code,'request_failed'),
    provider_error_message=left(coalesce(p_error_message,'Provider request failed'),500),failed_at=now() where id=p_delivery_id and status='pending'; end if;
  return found;
end $$;
revoke all on function public.get_pending_lesson_request_emails(uuid) from public,anon,authenticated;
revoke all on function public.record_lesson_request_email_submission(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.get_pending_lesson_request_emails(uuid) to service_role;
grant execute on function public.record_lesson_request_email_submission(uuid,text,text,text) to service_role;
