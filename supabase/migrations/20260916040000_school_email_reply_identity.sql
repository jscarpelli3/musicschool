alter table public.schools
  add column reply_to_email text;

alter table public.schools
  add constraint schools_reply_to_email_check
  check (
    reply_to_email is null
    or (
      length(reply_to_email) <= 320
      and reply_to_email = lower(trim(reply_to_email))
      and reply_to_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

grant update (reply_to_email) on public.schools to authenticated;

comment on column public.schools.reply_to_email is
  'Verified school-controlled address placed in Reply-To for transactional messages. The authenticated notifications subdomain remains the only From domain.';

drop function if exists public.claim_lesson_created_email(text,uuid);
create function public.claim_lesson_created_email(p_entity_type text,p_entity_id uuid)
returns table(
  id uuid,recipient_email text,subject text,message_text text,idempotency_key text,school_name text,reply_to_email text
)
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  return query
  update public.lesson_created_email_outbox outbox
  set status='submitting',attempt_count=outbox.attempt_count+1,claimed_at=now(),updated_at=now(),
      provider_error_code=null,provider_error_message=null
  from public.schools school
  where outbox.school_id=school.id and outbox.entity_type=p_entity_type and outbox.entity_id=p_entity_id
    and outbox.status='pending' and outbox.attempt_count<5
  returning outbox.id,outbox.recipient_email,outbox.subject,outbox.message_text,outbox.idempotency_key,school.name,school.reply_to_email;
end;
$$;

revoke all on function public.claim_lesson_created_email(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_lesson_created_email(text,uuid) to service_role;
