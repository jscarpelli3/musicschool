create function public.dedupe_lesson_request_email_recipient()
returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.lesson_request_email_outbox delivery
    where delivery.request_id=new.request_id
      and lower(trim(delivery.recipient_email))=lower(trim(new.recipient_email)))
  then return null; end if;
  return new;
end $$;

create trigger lesson_request_email_outbox_dedupe_recipient
before insert on public.lesson_request_email_outbox for each row
execute function public.dedupe_lesson_request_email_recipient();
revoke all on function public.dedupe_lesson_request_email_recipient() from public,anon,authenticated;

create function public.submit_school_cancellation(
  p_school_id uuid,p_lesson_event_id uuid,p_request_note text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_role text; actor_email text;
begin
  select member.role,profile.email into actor_role,actor_email
  from public.school_members member
  join public.profiles profile on profile.id=member.profile_id
  where member.school_id=p_school_id and member.profile_id=actor_id
    and member.status='active' and member.role in ('owner','admin');
  if actor_id is null or actor_role is null then raise exception 'not_authorized'; end if;
  if nullif(trim(actor_email),'') is null then raise exception 'actor_email_required'; end if;

  return public.submit_lesson_change_request_core(
    p_school_id,p_lesson_event_id,'cancellation','cancel','owner','school_cancellation',
    actor_id,actor_email,p_request_note,actor_role,'owner_calendar'
  );
end $$;

revoke all on function public.submit_school_cancellation(uuid,uuid,text) from public,anon;
grant execute on function public.submit_school_cancellation(uuid,uuid,text) to authenticated;

comment on function public.submit_school_cancellation(uuid,uuid,text) is
  'Owner/admin authorization adapter that explicitly submits the school-cancellation scenario without resolving its remedy.';
