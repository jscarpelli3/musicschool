alter table public.school_onboarding_invitations
  drop constraint if exists school_onboarding_invitations_normalized_email_status_key;

create unique index school_onboarding_one_active_email_idx
  on public.school_onboarding_invitations(normalized_email)
  where status='invited';

comment on index public.school_onboarding_one_active_email_idx is
  'Allows invitation history while preventing two simultaneously claimable beta invitations for one email.';

do $$
begin
  if not exists(
    select 1 from pg_catalog.pg_indexes
    where schemaname='public' and indexname='school_onboarding_one_active_email_idx'
      and indexdef ilike '%where (status = ''invited''%'
  ) then raise exception 'school onboarding invitations require a partial active-email uniqueness index'; end if;
end;
$$;
