alter table public.payment_method_setup_requests
  drop column token_hash;

comment on table public.payment_method_setup_requests is
  'Durable, expiring bindings between a family, Stripe Checkout setup session, and exact authorization terms. Stripe owns the payer-facing bearer URL.';
