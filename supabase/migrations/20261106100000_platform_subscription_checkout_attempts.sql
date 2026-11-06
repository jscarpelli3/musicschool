alter table public.school_platform_subscriptions
 add column checkout_attempt_id uuid not null default gen_random_uuid();

comment on column public.school_platform_subscriptions.checkout_attempt_id is
 'Stable idempotency identity for the current platform subscription Checkout attempt.';
