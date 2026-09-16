-- These flows are public in the product, but all calls pass through rate-limited
-- server actions or server components. The RPCs themselves do not need to be
-- callable with the browser's publishable key.
revoke all on function public.get_billing_approval(text) from public, anon, authenticated;
revoke all on function public.approve_billing_request(text) from public, anon, authenticated;
revoke all on function public.reject_billing_request(text,text,text) from public, anon, authenticated;
revoke all on function public.get_auto_charge_enrollment(text) from public, anon, authenticated;
revoke all on function public.record_public_sms_opt_in(text,text,text) from public, anon, authenticated;

grant execute on function public.get_billing_approval(text) to service_role;
grant execute on function public.approve_billing_request(text) to service_role;
grant execute on function public.reject_billing_request(text,text,text) to service_role;
grant execute on function public.get_auto_charge_enrollment(text) to service_role;
grant execute on function public.record_public_sms_opt_in(text,text,text) to service_role;

-- Remove the expired preview request whose raw token was committed in the
-- original development migration. Migration history is immutable, so cleanup
-- happens here rather than rewriting the applied migration.
delete from public.billing_approval_requests
where token_hash = encode(
  extensions.digest('17ecf8ce-f299-49ee-955f-09922eb9bfb0', 'sha256'),
  'hex'
)
and period_label = 'August 2026 · preview'
and expires_at <= now();
