-- Stripe delivery order is not guaranteed. A signed, fully validated paid
-- Checkout event is authoritative even if an expiration event was processed
-- first. Provider identity checks and the one-success-per-lesson constraint
-- still protect this transition.

create or replace function public.complete_lesson_payment_request(
  p_request_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_provider_event_id text,
  p_succeeded_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare target public.lesson_payment_requests%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(trim(p_checkout_session_id),'') is null or nullif(trim(p_payment_intent_id),'') is null or nullif(trim(p_charge_id),'') is null then raise exception 'provider_identity_required'; end if;
  select * into target from public.lesson_payment_requests where id=p_request_id for update;
  if not found then raise exception 'payment_request_not_found'; end if;
  if target.provider_checkout_session_id is not null and target.provider_checkout_session_id is distinct from p_checkout_session_id then raise exception 'checkout_session_mismatch'; end if;
  if target.status='succeeded' then
    if target.provider_payment_intent_id is distinct from p_payment_intent_id then raise exception 'payment_intent_mismatch'; end if;
    return target.id;
  end if;
  if target.status not in ('created','open','expired') then raise exception 'payment_request_not_payable'; end if;
  update public.lesson_payment_requests set status='succeeded',provider_checkout_session_id=p_checkout_session_id,provider_payment_intent_id=p_payment_intent_id,
    provider_charge_id=p_charge_id,checkout_url=null,succeeded_at=p_succeeded_at where id=target.id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
    values(target.school_id,null,'lesson_payment.succeeded','lesson_payment_request',target.id,
      jsonb_build_object('lesson_event_id',target.lesson_event_id,'amount_cents',target.amount_cents,'currency',target.currency,'provider_event_id',p_provider_event_id));
  return target.id;
end; $$;

revoke all on function public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz) to service_role;
