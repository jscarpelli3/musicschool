create table public.school_onboarding_invitations(
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null check(normalized_email=lower(trim(normalized_email)) and length(normalized_email)<=320),
  status text not null default 'invited' check(status in ('invited','claimed','revoked','expired')),
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id) on delete restrict,
  claimed_school_id uuid references public.schools(id) on delete restrict,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_email,status),
  check((status='claimed' and claimed_by is not null and claimed_school_id is not null and claimed_at is not null)
    or (status<>'claimed' and claimed_by is null and claimed_school_id is null and claimed_at is null))
);
create trigger school_onboarding_invitations_set_updated_at before update on public.school_onboarding_invitations
for each row execute function public.set_updated_at();
alter table public.school_onboarding_invitations enable row level security;
revoke all on public.school_onboarding_invitations from public,anon,authenticated;

create or replace function public.create_school(school_name text,school_timezone text default 'America/Chicago')
returns uuid language plpgsql security definer set search_path=''
as $$
declare current_profile_id uuid:=auth.uid(); new_school_id uuid; existing_school_id uuid;
  invitation_row public.school_onboarding_invitations%rowtype; normalized_email text;
  base_slug text; generated_slug text;
begin
  if current_profile_id is null then raise exception 'Authentication required'; end if;
  if length(trim(school_name)) not between 1 and 120 then raise exception 'School name must be between 1 and 120 characters'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=school_timezone) then raise exception 'Invalid timezone'; end if;

  select member.school_id into existing_school_id from public.school_members member
  where member.profile_id=current_profile_id and member.status='active' order by member.joined_at limit 1;
  if existing_school_id is not null then return existing_school_id; end if;

  normalized_email:=lower(nullif(trim(auth.jwt()->>'email'),''));
  select * into invitation_row from public.school_onboarding_invitations invitation
  where invitation.normalized_email=normalized_email and invitation.status='invited' and invitation.expires_at>now()
  order by invitation.created_at desc for update limit 1;
  if not found then raise exception 'school_onboarding_invitation_required'; end if;

  insert into public.profiles(id,email) select id,email from auth.users where id=current_profile_id on conflict(id) do nothing;
  base_slug:=trim(both '-' from lower(regexp_replace(trim(school_name),'[^a-zA-Z0-9]+','-','g')));
  if base_slug='' then base_slug:='school'; end if;
  generated_slug:=base_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
  insert into public.schools(name,slug,timezone,created_by) values(trim(school_name),generated_slug,school_timezone,current_profile_id) returning id into new_school_id;
  insert into public.school_members(school_id,profile_id,role,status,joined_at)
  values(new_school_id,current_profile_id,'owner','active',now());
  update public.school_onboarding_invitations set status='claimed',claimed_by=current_profile_id,
    claimed_school_id=new_school_id,claimed_at=now() where id=invitation_row.id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(new_school_id,current_profile_id,'school.created','school',new_school_id,jsonb_build_object('onboarding_invitation_id',invitation_row.id));
  return new_school_id;
end;
$$;
revoke all on function public.create_school(text,text) from public,anon;
grant execute on function public.create_school(text,text) to authenticated;

comment on table public.school_onboarding_invitations is
  'Platform-issued beta access. A verified authenticated email may claim one unexpired invitation to create its first school.';
