create or replace function public.update_billing_contact_email(
  p_school_id uuid,
  p_billing_account_id uuid,
  p_email text
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  account_row public.billing_accounts%rowtype;
  person_row public.people%rowtype;
  request_row public.billing_approval_requests%rowtype;
  normalized_email text := lower(trim(p_email));
  cancelled_count integer := 0;
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then raise exception 'not_authorized'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_email) > 320 then raise exception 'invalid_email'; end if;

  select * into account_row from public.billing_accounts
  where school_id = p_school_id and id = p_billing_account_id for update;
  if not found then raise exception 'billing_account_not_found'; end if;
  select * into person_row from public.people
  where school_id = p_school_id and id = account_row.billing_contact_person_id for update;
  if not found then raise exception 'billing_contact_not_found'; end if;
  if lower(coalesce(trim(person_row.email), '')) = normalized_email then return 0; end if;

  for request_row in
    select * from public.billing_approval_requests request
    where request.school_id = p_school_id and request.billing_account_id = p_billing_account_id
      and request.approval_status = 'pending'
    order by request.created_at for update
  loop
    update public.billing_approval_requests set approval_status = 'cancelled', cancelled_at = now()
    where id = request_row.id;
    insert into public.billing_approval_events (school_id,approval_request_id,event_type,channel,evidence)
    values (p_school_id,request_row.id,'cancelled','system',jsonb_build_object(
      'reason','payer_email_changed','billing_period_id',request_row.billing_period_id,'request_version',request_row.request_version
    ));
    cancelled_count := cancelled_count + 1;
  end loop;

  update public.people set email = normalized_email
  where school_id = p_school_id and id = account_row.billing_contact_person_id;
  insert into public.audit_log (school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values (p_school_id,actor_id,'billing_contact.email_changed','billing_account',p_billing_account_id,jsonb_build_object(
    'pending_requests_cancelled',cancelled_count,
    'old_email_sha256',encode(extensions.digest(lower(coalesce(trim(person_row.email),'')),'sha256'),'hex'),
    'new_email_sha256',encode(extensions.digest(normalized_email,'sha256'),'hex')
  ));
  return cancelled_count;
end;
$$;

revoke all on function public.update_billing_contact_email(uuid,uuid,text) from public, anon;
grant execute on function public.update_billing_contact_email(uuid,uuid,text) to authenticated;

comment on function public.update_billing_contact_email(uuid,uuid,text) is
  'Atomically changes a billing contact email and invalidates every pending bearer approval request addressed under the prior contact identity.';
