create table public.owner_notifications (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('payer_approved','payer_rejected','payment_failed')),
  title text not null, message text not null, href text not null, dedupe_key text not null,
  entity_type text not null, entity_id uuid not null, metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz, resolved_at timestamptz, created_at timestamptz not null default now(),
  unique (recipient_profile_id,dedupe_key), unique (school_id,id)
);
create index owner_notifications_recipient_unread_idx on public.owner_notifications(recipient_profile_id,created_at desc) where read_at is null;
alter table public.owner_notifications enable row level security;
create policy owner_notifications_recipient_select on public.owner_notifications for select to authenticated using (recipient_profile_id=(select auth.uid()) and public.is_school_member(school_id));
create policy owner_notifications_recipient_update on public.owner_notifications for update to authenticated using (recipient_profile_id=(select auth.uid()) and public.is_school_member(school_id)) with check (recipient_profile_id=(select auth.uid()) and public.is_school_member(school_id));
grant select,update(read_at,resolved_at) on public.owner_notifications to authenticated;
alter publication supabase_realtime add table public.owner_notifications;

create table public.owner_notification_email_outbox (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, notification_id uuid not null,
  approval_request_id uuid not null, recipient_email text not null, subject text not null, message_text text not null,
  idempotency_key text not null unique, status text not null default 'pending' check(status in ('pending','accepted','sent','delivered','delayed','failed','bounced','complained','suppressed')),
  provider_email_id text unique, provider_error_code text, provider_error_message text,
  accepted_at timestamptz, delivered_at timestamptz, failed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(school_id,notification_id) references public.owner_notifications(school_id,id) on delete restrict,
  foreign key(school_id,approval_request_id) references public.billing_approval_requests(school_id,id) on delete restrict
);
create index owner_notification_email_outbox_status_idx on public.owner_notification_email_outbox(status,created_at);
alter table public.owner_notification_email_outbox enable row level security;
create policy owner_notification_email_admin_select on public.owner_notification_email_outbox for select to authenticated using(public.has_school_role(school_id,array['owner','admin']));
grant select on public.owner_notification_email_outbox to authenticated;

create function public.queue_payer_response_notifications(p_request public.billing_approval_requests,p_kind text,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r record; notification_id uuid; school_name text; account_name text; title_text text; message_text text;
begin
  if p_kind not in ('payer_approved','payer_rejected') then raise exception 'invalid_notification_kind'; end if;
  select name into school_name from public.schools where id=p_request.school_id;
  select name into account_name from public.billing_accounts where school_id=p_request.school_id and id=p_request.billing_account_id;
  title_text:=case when p_kind='payer_approved' then account_name||' approved '||p_request.period_label else account_name||' requested review of '||p_request.period_label end;
  message_text:=case when p_kind='payer_approved' then 'Approved '||to_char(p_request.amount_cents/100.0,'FM$999999990.00')||'. No payment has been collected.' else 'The payer sent this statement back for review.'||case when nullif(trim(p_note),'') is null then '' else ' Note: '||trim(p_note) end end;
  for r in select member.profile_id,profile.email from public.school_members member join public.profiles profile on profile.id=member.profile_id where member.school_id=p_request.school_id and member.status='active' and member.role in ('owner','admin')
  loop
    insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
    values(p_request.school_id,r.profile_id,p_kind,title_text,message_text,'/schools/'||p_request.school_id||'/families/'||p_request.billing_account_id,p_kind||':'||p_request.id,'billing_approval_request',p_request.id,jsonb_build_object('billing_account_id',p_request.billing_account_id,'period_label',p_request.period_label,'amount_cents',p_request.amount_cents,'currency',p_request.currency))
    on conflict(recipient_profile_id,dedupe_key) do nothing returning id into notification_id;
    if notification_id is not null and nullif(lower(trim(r.email)),'') is not null then
      insert into public.owner_notification_email_outbox(school_id,notification_id,approval_request_id,recipient_email,subject,message_text,idempotency_key)
      values(p_request.school_id,notification_id,p_request.id,lower(trim(r.email)),title_text,message_text,'owner-notification/'||notification_id);
    end if;
    notification_id:=null;
  end loop;
end; $$;
revoke all on function public.queue_payer_response_notifications(public.billing_approval_requests,text,text) from public,anon,authenticated;

-- Append notification creation to the existing atomic payer decisions.
create or replace function public.approve_billing_request(raw_token text) returns text language plpgsql security definer set search_path='' as $$
declare request_record public.billing_approval_requests%rowtype;
begin
  select * into request_record from public.billing_approval_requests request where request.token_hash=encode(extensions.digest(raw_token,'sha256'),'hex') for update;
  if not found then return 'not_found'; end if; if request_record.approval_status='approved' then return 'already_approved'; end if; if request_record.approval_status<>'pending' then return request_record.approval_status; end if;
  if request_record.expires_at<=now() then update public.billing_approval_requests set approval_status='expired' where id=request_record.id; insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel) values(request_record.school_id,request_record.id,'expired','system'); return 'expired'; end if;
  update public.billing_approval_requests set approval_status='approved',approved_at=now() where id=request_record.id;
  if request_record.billing_period_id is not null then update public.billing_periods set status='approved' where id=request_record.billing_period_id and school_id=request_record.school_id and billing_account_id=request_record.billing_account_id and status='approval_pending' and amount_due_cents=request_record.amount_cents; if not found then raise exception 'approval_period_transition_failed'; end if; end if;
  insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel,evidence) values(request_record.school_id,request_record.id,'approved','approval_link',jsonb_build_object('amount_cents',request_record.amount_cents,'currency',request_record.currency,'period_label',request_record.period_label));
  perform public.queue_payer_response_notifications(request_record,'payer_approved',null); return 'approved';
end; $$;
revoke all on function public.approve_billing_request(text) from public; grant execute on function public.approve_billing_request(text) to anon,authenticated;

create or replace function public.reject_billing_request(raw_token text,p_reason_code text,p_note text default null) returns text language plpgsql security definer set search_path='' as $$
declare request_row public.billing_approval_requests%rowtype; clean_note text:=nullif(trim(p_note),'');
begin
  if p_reason_code not in ('lesson_did_not_happen','wrong_lesson_or_date','wrong_amount','missing_credit','duplicate_charge','other') then return 'invalid_reason'; end if; if p_reason_code='other' and clean_note is null then return 'note_required'; end if; if length(clean_note)>1000 then return 'note_too_long'; end if;
  select * into request_row from public.billing_approval_requests request where request.token_hash=encode(extensions.digest(raw_token,'sha256'),'hex') for update;
  if not found then return 'not_found'; end if; if request_row.approval_status='rejected' then return 'already_rejected'; end if; if request_row.approval_status<>'pending' then return request_row.approval_status; end if;
  if request_row.expires_at<=now() then update public.billing_approval_requests set approval_status='expired' where id=request_row.id; insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel) values(request_row.school_id,request_row.id,'expired','system'); return 'expired'; end if;
  update public.billing_approval_requests set approval_status='rejected',rejected_at=now(),rejection_reason_code=p_reason_code,rejection_note=clean_note where id=request_row.id;
  if request_row.billing_period_id is not null then update public.billing_periods set status='review',locked_at=null where id=request_row.billing_period_id and status='approval_pending' and amount_due_cents=request_row.amount_cents; if not found then raise exception 'rejection_period_transition_failed'; end if; end if;
  insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel,evidence) values(request_row.school_id,request_row.id,'rejected','approval_link',jsonb_build_object('reason_code',p_reason_code,'note',clean_note,'amount_cents',request_row.amount_cents));
  perform public.queue_payer_response_notifications(request_row,'payer_rejected',clean_note); return 'rejected';
end; $$;
revoke all on function public.reject_billing_request(text,text,text) from public; grant execute on function public.reject_billing_request(text,text,text) to anon,authenticated;
