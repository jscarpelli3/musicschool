alter table public.payment_provider_events
  add column processing_started_at timestamptz;

create or replace function public.claim_payment_provider_event(
  p_provider_event_id text,
  p_stale_after_seconds integer default 300
)
returns table(id uuid, processing_attempts integer)
language sql
security definer
set search_path = ''
as $$
  update public.payment_provider_events
  set processing_status = 'processing',
      processing_attempts = processing_attempts + 1,
      processing_started_at = now(),
      processed_at = null,
      last_error = null
  where provider_event_id = p_provider_event_id
    and (
      processing_status in ('received', 'failed')
      or (
        processing_status = 'processing'
        and processing_started_at < now() - make_interval(secs => greatest(p_stale_after_seconds, 1))
      )
    )
  returning payment_provider_events.id, payment_provider_events.processing_attempts;
$$;

revoke all on function public.claim_payment_provider_event(text, integer) from public;
revoke all on function public.claim_payment_provider_event(text, integer) from anon;
revoke all on function public.claim_payment_provider_event(text, integer) from authenticated;
grant execute on function public.claim_payment_provider_event(text, integer) to service_role;

comment on function public.claim_payment_provider_event(text, integer) is
  'Atomically claims a new or failed provider event and reclaims an abandoned processing lease.';
