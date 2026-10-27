create or replace function public.approve_client_portal_billing_request(p_school_id uuid,p_billing_period_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_email text:=lower(nullif(trim(auth.jwt()->>'email'),'')); request_row public.billing_approval_requests%rowtype;
begin
  if auth.role()<>'authenticated' or actor_email is null or public.current_client_portal_access_state()<>'ready' then raise exception 'portal_access_denied'; end if;
  select request.* into request_row
  from public.billing_approval_requests request
  join public.billing_accounts account on account.school_id=request.school_id and account.id=request.billing_account_id and account.status='active'
  join public.payer_portal_authorizations portal_auth on portal_auth.school_id=account.school_id and portal_auth.billing_account_id=account.id and portal_auth.normalized_email=actor_email
  where request.school_id=p_school_id and request.billing_period_id=p_billing_period_id
  order by request.request_version desc,request.created_at desc limit 1 for update of request;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if request_row.approval_status='approved' then return jsonb_build_object('result','already_approved','approval_request_id',request_row.id); end if;
  if request_row.approval_status<>'pending' then return jsonb_build_object('result',request_row.approval_status); end if;
  if request_row.expires_at<=now() then
    update public.billing_approval_requests set approval_status='expired' where id=request_row.id;
    insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel) values(request_row.school_id,request_row.id,'expired','system');
    return jsonb_build_object('result','expired');
  end if;
  update public.billing_approval_requests set approval_status='approved',approved_at=now() where id=request_row.id;
  update public.billing_periods set status='approved'
    where id=request_row.billing_period_id and school_id=request_row.school_id and billing_account_id=request_row.billing_account_id
      and status='approval_pending' and amount_due_cents=request_row.amount_cents;
  if not found then raise exception 'approval_period_transition_failed'; end if;
  insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel,evidence)
    values(request_row.school_id,request_row.id,'approved','in_app',jsonb_build_object('surface','client_portal','amount_cents',request_row.amount_cents,'currency',request_row.currency,'period_label',request_row.period_label,'authenticated_email',actor_email));
  perform public.queue_payer_response_notifications(request_row,'payer_approved',null);
  return jsonb_build_object('result','approved','approval_request_id',request_row.id);
end; $$;

create or replace function public.reject_client_portal_billing_request(p_school_id uuid,p_billing_period_id uuid,p_reason_code text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_email text:=lower(nullif(trim(auth.jwt()->>'email'),'')); request_row public.billing_approval_requests%rowtype; clean_note text:=nullif(trim(p_note),'');
begin
  if auth.role()<>'authenticated' or actor_email is null or public.current_client_portal_access_state()<>'ready' then raise exception 'portal_access_denied'; end if;
  if p_reason_code not in ('lesson_did_not_happen','wrong_lesson_or_date','wrong_amount','missing_credit','duplicate_charge','other') then return jsonb_build_object('result','invalid_reason'); end if;
  if p_reason_code='other' and clean_note is null then return jsonb_build_object('result','note_required'); end if;
  if length(clean_note)>1000 then return jsonb_build_object('result','note_too_long'); end if;
  select request.* into request_row
  from public.billing_approval_requests request
  join public.billing_accounts account on account.school_id=request.school_id and account.id=request.billing_account_id and account.status='active'
  join public.payer_portal_authorizations portal_auth on portal_auth.school_id=account.school_id and portal_auth.billing_account_id=account.id and portal_auth.normalized_email=actor_email
  where request.school_id=p_school_id and request.billing_period_id=p_billing_period_id
  order by request.request_version desc,request.created_at desc limit 1 for update of request;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if request_row.approval_status='rejected' then return jsonb_build_object('result','already_rejected','approval_request_id',request_row.id); end if;
  if request_row.approval_status<>'pending' then return jsonb_build_object('result',request_row.approval_status); end if;
  if request_row.expires_at<=now() then
    update public.billing_approval_requests set approval_status='expired' where id=request_row.id;
    insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel) values(request_row.school_id,request_row.id,'expired','system');
    return jsonb_build_object('result','expired');
  end if;
  update public.billing_approval_requests set approval_status='rejected',rejected_at=now(),rejection_reason_code=p_reason_code,rejection_note=clean_note where id=request_row.id;
  update public.billing_periods set status='review',locked_at=null
    where id=request_row.billing_period_id and school_id=request_row.school_id and billing_account_id=request_row.billing_account_id
      and status='approval_pending' and amount_due_cents=request_row.amount_cents;
  if not found then raise exception 'rejection_period_transition_failed'; end if;
  insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel,evidence)
    values(request_row.school_id,request_row.id,'rejected','in_app',jsonb_build_object('surface','client_portal','reason_code',p_reason_code,'note',clean_note,'amount_cents',request_row.amount_cents,'authenticated_email',actor_email));
  perform public.queue_payer_response_notifications(request_row,'payer_rejected',clean_note);
  return jsonb_build_object('result','rejected','approval_request_id',request_row.id);
end; $$;

revoke all on function public.approve_client_portal_billing_request(uuid,uuid) from public,anon;
revoke all on function public.reject_client_portal_billing_request(uuid,uuid,text,text) from public,anon;
grant execute on function public.approve_client_portal_billing_request(uuid,uuid) to authenticated;
grant execute on function public.reject_client_portal_billing_request(uuid,uuid,text,text) to authenticated;

comment on function public.approve_client_portal_billing_request(uuid,uuid) is 'Approves the latest exact pending invoice request for a billing account authorized to the current verified portal email.';
comment on function public.reject_client_portal_billing_request(uuid,uuid,text,text) is 'Returns the latest exact pending invoice request for review for a billing account authorized to the current verified portal email.';
