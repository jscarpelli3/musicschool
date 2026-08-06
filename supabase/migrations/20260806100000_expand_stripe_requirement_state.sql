alter table public.school_payment_connections
  add column past_due jsonb not null default '[]'::jsonb check (jsonb_typeof(past_due) = 'array'),
  add column pending_verification jsonb not null default '[]'::jsonb check (jsonb_typeof(pending_verification) = 'array'),
  add column requirement_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(requirement_errors) = 'array'),
  add column requirements_deadline timestamptz;

comment on column public.school_payment_connections.currently_due is 'Stripe field paths requiring owner action now.';
comment on column public.school_payment_connections.pending_verification is 'Stripe field paths submitted and awaiting provider verification.';
comment on column public.school_payment_connections.requirement_errors is 'Safe Stripe requirement validation errors; never raw identity values.';
