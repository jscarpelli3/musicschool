create table public.platform_audit_log(
 id bigint generated always as identity primary key,
 actor_profile_id uuid references public.profiles(id) on delete restrict,
 action text not null check(length(action) between 1 and 120),
 entity_type text not null check(length(entity_type) between 1 and 80),
 entity_id uuid,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from public,anon,authenticated;

create function public.issue_school_onboarding_invitation(
 p_email text,p_token_hash text,p_expires_at timestamptz,p_school_name text,p_issued_by uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(trim(p_email));invitation_id uuid;
begin
 if auth.role()<>'service_role' then raise exception 'not_authorized';end if;
 if normalized!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized)>320
  or p_token_hash!~'^[0-9a-f]{64}$' or p_expires_at<=now() or p_expires_at>now()+interval '31 days'
  or (p_school_name is not null and length(trim(p_school_name)) not between 1 and 120)
  or not exists(select 1 from public.profiles where id=p_issued_by) then raise exception 'invalid_invitation';end if;
 update public.school_onboarding_invitations set status='revoked' where normalized_email=normalized and status='invited';
 insert into public.school_onboarding_invitations(normalized_email,status,expires_at,token_hash,intended_school_name,issued_by)
 values(normalized,'invited',p_expires_at,p_token_hash,nullif(trim(p_school_name),''),p_issued_by) returning id into invitation_id;
 insert into public.platform_audit_log(actor_profile_id,action,entity_type,entity_id,metadata)
 values(p_issued_by,'school_onboarding_invitation.issued','school_onboarding_invitation',invitation_id,
  jsonb_build_object('email_sha256',encode(extensions.digest(normalized,'sha256'),'hex'),'expires_at',p_expires_at));
 return invitation_id;
end;$$;
revoke all on function public.issue_school_onboarding_invitation(text,text,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.issue_school_onboarding_invitation(text,text,timestamptz,text,uuid) to service_role;
