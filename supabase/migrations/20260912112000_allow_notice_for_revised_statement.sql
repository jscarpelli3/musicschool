create or replace function public.prepare_billing_statement_notice(
  p_school_id uuid,p_billing_period_id uuid,p_from_address text,p_subject text,p_body_sha256 text
) returns table(notice_delivery_id uuid,idempotency_key text,recipient_email text)
language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); readiness_row record; period_row public.billing_periods%rowtype;
  mandate_row public.billing_collection_mandates%rowtype; normalized_email text; delivery_id uuid;
  delivery_key text; next_attempt integer; current_fingerprint text;
begin
  if actor_id is null or not public.has_school_capability(p_school_id,'school.billing.manage') then raise exception 'not_authorized'; end if;
  if p_body_sha256!~'^[0-9a-f]{64}$' or length(trim(p_subject)) not between 1 and 300
    or length(trim(p_from_address)) not between 3 and 320 then raise exception 'invalid_notice_message'; end if;
  perform pg_advisory_xact_lock(hashtextextended('billing-statement-notice:'||p_billing_period_id::text,0));
  select * into period_row from public.billing_periods where school_id=p_school_id and id=p_billing_period_id for update;
  if not found then raise exception 'billing_period_not_found'; end if;
  select * into readiness_row from public.get_billing_collection_readiness(p_school_id,p_billing_period_id);
  if readiness_row.readiness not in ('notice_required','notice_failed') then raise exception 'statement_notice_not_eligible:%',readiness_row.readiness; end if;
  select * into mandate_row from public.billing_collection_mandates where id=readiness_row.mandate_id and status='active' for update;
  if not found then raise exception 'active_mandate_required'; end if;
  current_fingerprint:=public.billing_statement_fingerprint(period_row.id);
  select lower(trim(person.email)) into normalized_email from public.billing_accounts account
  join public.people person on person.school_id=account.school_id and person.id=account.billing_contact_person_id and person.status='active'
  where account.school_id=p_school_id and account.id=period_row.billing_account_id and account.status='active';
  if normalized_email is null or normalized_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'valid_payer_email_required'; end if;
  if exists(select 1 from public.email_suppressions suppression where suppression.recipient_email=normalized_email) then raise exception 'recipient_suppressed'; end if;
  select coalesce(max(notice.attempt_number),0)+1 into next_attempt from public.billing_statement_notice_deliveries notice
  where notice.billing_period_id=period_row.id and notice.mandate_id=mandate_row.id;
  if exists(select 1 from public.billing_statement_notice_deliveries notice where notice.billing_period_id=period_row.id
    and notice.mandate_id=mandate_row.id and notice.statement_sha256=current_fingerprint
    and notice.status not in ('failed','bounced','complained','suppressed','cancelled'))
  then raise exception 'statement_notice_already_prepared'; end if;
  delivery_key:='billing-statement-notice/'||period_row.id::text||'/'||mandate_row.id::text||'/'||next_attempt::text;
  insert into public.billing_statement_notice_deliveries(
    school_id,billing_account_id,billing_period_id,mandate_id,attempt_number,recipient_email,
    from_address,subject,body_sha256,idempotency_key,amount_cents,currency,charge_categories,notice_days,created_by
  ) select p_school_id,period_row.billing_account_id,period_row.id,mandate_row.id,next_attempt,normalized_email,
    trim(p_from_address),trim(p_subject),p_body_sha256,delivery_key,period_row.amount_due_cents,period_row.currency,
    array_agg(distinct item.charge_category_code order by item.charge_category_code),mandate_row.advance_notice_days,actor_id
  from public.billing_line_items item where item.billing_period_id=period_row.id returning id into delivery_id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'billing_statement_notice.prepared','billing_period',period_row.id,
    jsonb_build_object('notice_delivery_id',delivery_id,'mandate_id',mandate_row.id,'attempt_number',next_attempt,
      'statement_sha256',current_fingerprint,'amount_cents',period_row.amount_due_cents,'notice_days',mandate_row.advance_notice_days));
  return query select delivery_id,delivery_key,normalized_email;
end;
$$;
revoke all on function public.prepare_billing_statement_notice(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.prepare_billing_statement_notice(uuid,uuid,text,text,text) to authenticated;

do $$ begin
  if position('notice.statement_sha256=current_fingerprint' in replace(pg_get_functiondef('public.prepare_billing_statement_notice(uuid,uuid,text,text,text)'::regprocedure),' ',''))=0
  then raise exception 'notice preparation must scope active attempts to the current statement fingerprint'; end if;
end $$;
