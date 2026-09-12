alter table public.school_onboarding_invitations
  add column token_hash text check(token_hash is null or token_hash~'^[0-9a-f]{64}$'),
  add column intended_school_name text check(intended_school_name is null or length(trim(intended_school_name)) between 1 and 120),
  add column issued_by uuid references public.profiles(id) on delete restrict;

create unique index school_onboarding_invitation_token_idx
  on public.school_onboarding_invitations(token_hash) where token_hash is not null;

comment on column public.school_onboarding_invitations.token_hash is
  'SHA-256 digest of the single-purpose invitation URL token. The raw token is never stored.';
