create table public.lesson_change_request_decisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  request_id uuid not null unique references public.lesson_change_requests(id) on delete restrict,
  decision text not null check (decision in ('approved','declined')),
  lesson_resolution text check (lesson_resolution is null or lesson_resolution in ('count_as_serviced','retain_for_reschedule','waive')),
  accounting_disposition text check (accounting_disposition is null or accounting_disposition in ('charge','waive','credit')),
  adjustment_kind text check (adjustment_kind is null or adjustment_kind in ('fee','credit')),
  adjustment_amount_cents integer not null default 0 check (adjustment_amount_cents between 0 and 1000000),
  policy_lesson_resolution text,
  policy_adjustment_amount_cents integer not null default 0,
  is_policy_override boolean not null default false,
  reason text check (reason is null or length(trim(reason)) between 1 and 1000),
  decided_by uuid not null references public.profiles(id),
  decided_at timestamptz not null default now(),
  unique(school_id,id)
);

create table public.lesson_service_entitlements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  billing_account_id uuid not null,
  student_id uuid not null,
  assigned_teacher_id uuid,
  source_lesson_event_id uuid not null,
  source_request_id uuid not null unique,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  status text not null default 'waiting_to_schedule' check (status in ('waiting_to_schedule','scheduled','serviced','waived','voided')),
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,id),
  foreign key(school_id,billing_account_id) references public.billing_accounts(school_id,id) on delete restrict,
  foreign key(school_id,student_id) references public.people(school_id,id) on delete restrict,
  foreign key(school_id,assigned_teacher_id) references public.people(school_id,id) on delete restrict,
  foreign key(school_id,source_lesson_event_id) references public.lesson_events(school_id,id) on delete restrict,
  foreign key(school_id,source_request_id) references public.lesson_change_requests(school_id,id) on delete restrict
);
create trigger lesson_service_entitlements_set_updated_at before update on public.lesson_service_entitlements
for each row execute function public.set_updated_at();

create table public.billing_account_pending_adjustments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  billing_account_id uuid not null,
  source_request_id uuid not null,
  kind text not null check (kind in ('fee','credit')),
  amount_cents integer not null check (amount_cents between 1 and 1000000),
  description text not null check (length(trim(description)) between 1 and 300),
  status text not null default 'pending' check (status in ('pending','applied','waived','reversed')),
  billing_line_item_id uuid references public.billing_line_items(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_request_id,kind),
  unique(school_id,id),
  foreign key(school_id,billing_account_id) references public.billing_accounts(school_id,id) on delete restrict,
  foreign key(school_id,source_request_id) references public.lesson_change_requests(school_id,id) on delete restrict
);
create trigger billing_account_pending_adjustments_set_updated_at before update on public.billing_account_pending_adjustments
for each row execute function public.set_updated_at();

create table public.lesson_accounting_overrides (
  lesson_event_id uuid primary key,
  school_id uuid not null,
  request_decision_id uuid not null unique references public.lesson_change_request_decisions(id) on delete restrict,
  disposition text not null check (disposition in ('charge','waive','credit')),
  reason_code text not null default 'owner_case_decision',
  created_at timestamptz not null default now(),
  foreign key(school_id,lesson_event_id) references public.lesson_events(school_id,id) on delete restrict
);

alter table public.lesson_change_request_decisions enable row level security;
alter table public.lesson_service_entitlements enable row level security;
alter table public.billing_account_pending_adjustments enable row level security;
alter table public.lesson_accounting_overrides enable row level security;
create policy lesson_request_decisions_management_select on public.lesson_change_request_decisions for select to authenticated
  using(public.has_school_role(school_id,array['owner','admin']));
create policy lesson_entitlements_management_select on public.lesson_service_entitlements for select to authenticated
  using(public.has_school_role(school_id,array['owner','admin']));
create policy pending_adjustments_management_select on public.billing_account_pending_adjustments for select to authenticated
  using(public.has_school_role(school_id,array['owner','admin']));
create policy lesson_accounting_overrides_management_select on public.lesson_accounting_overrides for select to authenticated
  using(public.has_school_role(school_id,array['owner','admin']));
create policy lesson_change_requests_management_select on public.lesson_change_requests for select to authenticated
  using(public.has_school_role(school_id,array['owner','admin']));
grant select on public.lesson_change_requests,public.lesson_change_request_decisions,public.lesson_service_entitlements,
  public.billing_account_pending_adjustments,public.lesson_accounting_overrides to authenticated;
revoke insert,update,delete on public.lesson_change_request_decisions,public.lesson_service_entitlements,
  public.billing_account_pending_adjustments,public.lesson_accounting_overrides from authenticated;

create or replace function public.route_lesson_request_notification()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.entity_type='lesson_change_request' and new.entity_id is not null then
    new.href:='/schools/'||new.school_id||'/approvals?request='||new.entity_id;
  end if;
  return new;
end $$;
create trigger owner_notifications_route_lesson_request before insert or update of entity_id,entity_type,href
on public.owner_notifications for each row execute function public.route_lesson_request_notification();
update public.owner_notifications set href='/schools/'||school_id||'/approvals?request='||entity_id
where entity_type='lesson_change_request' and entity_id is not null;
revoke all on function public.route_lesson_request_notification() from public,anon,authenticated;

alter function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz)
  rename to compute_policy_lesson_event_billing_disposition;

create function public.compute_lesson_event_billing_disposition(
  p_school_id uuid,p_lesson_event_id uuid,p_as_of timestamptz default now()
) returns jsonb language plpgsql stable set search_path='' as $$
declare override_row public.lesson_accounting_overrides%rowtype;
begin
  select * into override_row from public.lesson_accounting_overrides
  where school_id=p_school_id and lesson_event_id=p_lesson_event_id;
  if found then
    return jsonb_build_object('lesson_event_id',p_lesson_event_id,'state','resolved',
      'disposition',override_row.disposition,'reason_code',override_row.reason_code,
      'policy_version_id',null,'policy_disposition',null,'request_decision_id',override_row.request_decision_id);
  end if;
  return public.compute_policy_lesson_event_billing_disposition(p_school_id,p_lesson_event_id,p_as_of);
end $$;
revoke all on function public.compute_policy_lesson_event_billing_disposition(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.compute_policy_lesson_event_billing_disposition(uuid,uuid,timestamptz) to service_role;
revoke all on function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz) to service_role;

create or replace function public.resolve_owner_lesson_change_request(
  p_school_id uuid,p_request_id uuid,p_decision text,p_lesson_resolution text,
  p_adjustment_kind text,p_adjustment_amount_cents integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid(); actor_role text; request_row public.lesson_change_requests%rowtype;
  event_row public.lesson_events%rowtype; rules record; decision_id uuid; entitlement_id uuid; adjustment_id uuid;
  accounting_disposition text; policy_resolution text; policy_fee integer:=0; is_override boolean:=false;
  clean_reason text:=nullif(trim(coalesce(p_reason,'')),''); final_message text; recipient record;
begin
  select member.role into actor_role from public.school_members member
  where member.school_id=p_school_id and member.profile_id=actor_id and member.status='active';
  if actor_id is null or actor_role not in ('owner','admin') then raise exception 'not_authorized'; end if;
  if p_decision not in ('approved','declined') then raise exception 'invalid_decision'; end if;
  if p_adjustment_kind is not null and p_adjustment_kind not in ('fee','credit') then raise exception 'invalid_adjustment'; end if;
  if coalesce(p_adjustment_amount_cents,0) not between 0 and 1000000 then raise exception 'invalid_adjustment_amount'; end if;

  select * into request_row from public.lesson_change_requests
  where school_id=p_school_id and id=p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if request_row.status not in ('pending','in_progress') then
    return jsonb_build_object('outcome','stale','status',request_row.status);
  end if;
  select * into event_row from public.lesson_events
  where school_id=p_school_id and id=request_row.lesson_event_id for update;
  if not found then raise exception 'lesson_not_found'; end if;

  if p_decision='declined' then
    if p_lesson_resolution is not null or p_adjustment_kind is not null or coalesce(p_adjustment_amount_cents,0)<>0 then raise exception 'decline_has_effects'; end if;
    insert into public.lesson_change_request_decisions(school_id,request_id,decision,reason,decided_by)
    values(p_school_id,p_request_id,'declined',clean_reason,actor_id) returning id into decision_id;
    update public.lesson_change_requests set status='declined',updated_at=now() where id=p_request_id;
    final_message:='The school reviewed and declined this lesson change request. The lesson remains scheduled.';
  else
    if p_lesson_resolution not in ('count_as_serviced','retain_for_reschedule','waive') then raise exception 'invalid_lesson_resolution'; end if;
    if event_row.status<>'scheduled' then raise exception 'lesson_no_longer_scheduled'; end if;
    select rule.late_lesson_resolution,rule.late_reschedule_fee_cents,rule.timely_cancel_disposition,
      rule.replacement_window_days,rule.must_keep_assigned_teacher into rules
    from public.cancellation_policy_rules rule where rule.policy_version_id=request_row.policy_version_id;
    if not found then raise exception 'policy_snapshot_unavailable'; end if;
    policy_resolution:=case when request_row.within_policy_window then
      case rules.timely_cancel_disposition when 'charge' then 'count_as_serviced' when 'manual_review' then 'manual_review' else 'waive' end
      else rules.late_lesson_resolution end;
    policy_fee:=case when not request_row.within_policy_window and policy_resolution='retain_for_reschedule'
      then rules.late_reschedule_fee_cents else 0 end;
    is_override:=p_lesson_resolution<>policy_resolution
      or coalesce(p_adjustment_amount_cents,0)<>policy_fee
      or (policy_fee>0 and p_adjustment_kind is distinct from 'fee')
      or (policy_fee=0 and p_adjustment_kind is not null);
    if is_override and clean_reason is null then raise exception 'override_reason_required'; end if;
    accounting_disposition:=case p_lesson_resolution when 'count_as_serviced' then 'charge' else 'waive' end;

    insert into public.lesson_change_request_decisions(school_id,request_id,decision,lesson_resolution,
      accounting_disposition,adjustment_kind,adjustment_amount_cents,policy_lesson_resolution,
      policy_adjustment_amount_cents,is_policy_override,reason,decided_by)
    values(p_school_id,p_request_id,'approved',p_lesson_resolution,accounting_disposition,p_adjustment_kind,
      coalesce(p_adjustment_amount_cents,0),policy_resolution,policy_fee,is_override,clean_reason,actor_id)
    returning id into decision_id;
    insert into public.lesson_accounting_overrides(lesson_event_id,school_id,request_decision_id,disposition)
    values(event_row.id,p_school_id,decision_id,accounting_disposition);
    update public.lesson_events set status='cancelled',outcome='student_cancelled',
      cancellation_timing=case when request_row.within_policy_window then 'timely' else 'late' end
    where id=event_row.id;
    if p_lesson_resolution='retain_for_reschedule' then
      insert into public.lesson_service_entitlements(school_id,billing_account_id,student_id,assigned_teacher_id,
        source_lesson_event_id,source_request_id,duration_minutes,expires_at,created_by)
      values(p_school_id,request_row.billing_account_id,event_row.student_id,
        case when rules.must_keep_assigned_teacher then event_row.teacher_id else null end,event_row.id,p_request_id,
        greatest(5,extract(epoch from(event_row.ends_at-event_row.starts_at))::integer/60),
        case when rules.replacement_window_days is null then null else now()+(rules.replacement_window_days*interval '1 day') end,actor_id)
      returning id into entitlement_id;
    end if;
    if p_adjustment_kind is not null and coalesce(p_adjustment_amount_cents,0)>0 then
      insert into public.billing_account_pending_adjustments(school_id,billing_account_id,source_request_id,kind,
        amount_cents,description,created_by)
      values(p_school_id,request_row.billing_account_id,p_request_id,p_adjustment_kind,p_adjustment_amount_cents,
        case p_adjustment_kind when 'fee' then 'Late lesson change fee' else 'Lesson change credit' end,actor_id)
      returning id into adjustment_id;
    end if;
    update public.lesson_change_requests set status='approved',updated_at=now() where id=p_request_id;
    final_message:=case p_lesson_resolution
      when 'count_as_serviced' then 'The cancellation was confirmed. Under the final decision, the lesson is counted as serviced and will not be replaced.'
      when 'retain_for_reschedule' then 'The cancellation was confirmed and the lesson remains available to reschedule.'
      else 'The cancellation was confirmed without counting the lesson as serviced.' end
      ||case when p_adjustment_kind='fee' and p_adjustment_amount_cents>0 then ' A '||to_char(p_adjustment_amount_cents/100.0,'FM$999999990.00')||' fee was recorded.'
        when p_adjustment_kind='credit' and p_adjustment_amount_cents>0 then ' A '||to_char(p_adjustment_amount_cents/100.0,'FM$999999990.00')||' credit was recorded.' else '' end;
  end if;

  update public.owner_notifications set read_at=coalesce(read_at,now()),resolved_at=coalesce(resolved_at,now()),
    metadata=coalesce(metadata,'{}')||jsonb_build_object('request_status',p_decision,'request_decision_id',decision_id)
  where school_id=p_school_id and entity_type='lesson_change_request' and entity_id=p_request_id;
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'lesson_change_request.'||p_decision,'lesson_change_request',p_request_id,actor_id,actor_role,
    'owner_resolution',jsonb_build_object('decision_id',decision_id,'lesson_resolution',p_lesson_resolution,
      'entitlement_id',entitlement_id,'adjustment_id',adjustment_id,'is_policy_override',is_override,'reason',clean_reason));

  for recipient in
    select request_row.requester_email as email,'requester'::text as recipient_kind
    union
    select profile.email,case when member.role='teacher' then 'teacher' else member.role end
    from public.school_members member join public.profiles profile on profile.id=member.profile_id
    where member.school_id=p_school_id and member.status='active' and member.role in ('owner','admin')
    union
    select person.email,'teacher' from public.people person where person.school_id=p_school_id and person.id=event_row.teacher_id
  loop
    if nullif(lower(trim(recipient.email)),'') is not null then
      insert into public.lesson_request_email_outbox(school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key)
      values(p_school_id,p_request_id,recipient.recipient_kind,lower(trim(recipient.email)),
        'Lesson change request resolved',final_message,'lesson-resolution/'||p_request_id||'/'||lower(trim(recipient.email)))
      on conflict(idempotency_key) do nothing;
    end if;
  end loop;
  return jsonb_build_object('outcome',p_decision,'decision_id',decision_id,'entitlement_id',entitlement_id,
    'adjustment_id',adjustment_id,'message',final_message);
end $$;
revoke all on function public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text) to authenticated;
