alter table public.school_onboarding_invitations
  add column delivery_status text not null default 'not_sent'
    check(delivery_status in ('not_sent','accepted','failed','reconciliation_required')),
  add column provider_email_id text,
  add column accepted_at timestamptz,
  add column failed_at timestamptz,
  add column provider_error_code text;

create function public.record_school_onboarding_invitation_delivery(
  p_invitation_id uuid,
  p_status text,
  p_provider_email_id text default null,
  p_provider_error_code text default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role'
    or p_status not in ('accepted','failed','reconciliation_required')
    or (p_status='accepted' and nullif(trim(p_provider_email_id),'') is null) then
    raise exception 'invalid_invitation_delivery';
  end if;

  update public.school_onboarding_invitations
  set delivery_status=p_status,
      provider_email_id=case when p_status='accepted' then p_provider_email_id else null end,
      accepted_at=case when p_status='accepted' then now() else null end,
      failed_at=case when p_status='failed' then now() else null end,
      provider_error_code=nullif(left(trim(coalesce(p_provider_error_code,'')),120),'')
  where id=p_invitation_id and delivery_status='not_sent';

  if not found then raise exception 'invitation_delivery_not_recorded'; end if;
end;
$$;

revoke all on function public.record_school_onboarding_invitation_delivery(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_school_onboarding_invitation_delivery(uuid,text,text,text) to service_role;

comment on column public.school_onboarding_invitations.delivery_status is
  'Provider acceptance state for the onboarding email. Link issuance remains separately auditable.';
