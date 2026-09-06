create table public.email_delivery_source_types(
  source_kind text primary key check(length(source_kind) between 1 and 80),
  source_schema text not null default 'public' check(source_schema='public'),
  source_table text not null unique check(source_table~'^[a-z][a-z0-9_]*$'),
  records_sent_at boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.email_delivery_source_types(source_kind,source_table,records_sent_at) values
  ('billing_approval','email_deliveries',true),
  ('owner_notification','owner_notification_email_outbox',false),
  ('lesson_created','lesson_created_email_outbox',false),
  ('lesson_change_request','lesson_request_email_outbox',false),
  ('teacher_invitation','teacher_invitation_deliveries',false),
  ('lesson_schedule_proposal','lesson_proposal_email_outbox',false);

create table public.email_delivery_registry(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  provider text not null default 'resend' check(provider='resend'),
  provider_email_id text not null check(length(trim(provider_email_id)) between 1 and 200),
  source_kind text not null references public.email_delivery_source_types(source_kind) on delete restrict,
  source_id uuid not null,
  recipient_email text not null check(recipient_email=lower(trim(recipient_email)) and length(recipient_email)<=320),
  status text not null check(status in ('accepted','sent','delivered','delayed','failed','bounced','complained','suppressed')),
  accepted_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_email_id),
  unique(source_kind,source_id)
);
create index email_delivery_registry_school_status_idx
  on public.email_delivery_registry(school_id,status,updated_at desc);

alter table public.email_delivery_source_types enable row level security;
alter table public.email_delivery_registry enable row level security;
create policy email_delivery_registry_admin_select on public.email_delivery_registry
  for select to authenticated using(public.has_school_role(school_id,array['owner','admin']));
grant select on public.email_delivery_registry to authenticated;
revoke all on public.email_delivery_source_types from public,anon,authenticated;
revoke insert,update,delete on public.email_delivery_registry from public,anon,authenticated;

alter table public.email_delivery_events
  add column registry_id uuid references public.email_delivery_registry(id) on delete restrict;
create index email_delivery_events_registry_idx on public.email_delivery_events(registry_id,occurred_at);

drop policy email_delivery_events_admin_select on public.email_delivery_events;
create policy email_delivery_events_admin_select on public.email_delivery_events
  for select to authenticated using(
    registry_id is not null and exists(
      select 1 from public.email_delivery_registry registry
      where registry.id=registry_id and public.has_school_role(registry.school_id,array['owner','admin'])
    )
  );

create function public.apply_registered_email_delivery_status(
  p_registry_id uuid,p_event_type text,p_occurred_at timestamptz
) returns void language plpgsql security definer set search_path='' as $$
declare
  registry_row public.email_delivery_registry%rowtype;
  source_row public.email_delivery_source_types%rowtype;
  next_status text;
  eligible text[];
  affected integer;
begin
  next_status:=case p_event_type
    when 'email.sent' then 'sent'
    when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delayed'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.failed' then 'failed'
    when 'email.suppressed' then 'suppressed' end;
  if next_status is null then return; end if;
  select * into registry_row from public.email_delivery_registry registry where registry.id=p_registry_id for update;
  if not found then raise exception 'email_delivery_registry_not_found'; end if;
  select * into source_row from public.email_delivery_source_types source where source.source_kind=registry_row.source_kind;
  if not found then raise exception 'email_delivery_source_type_not_found'; end if;

  eligible:=case next_status
    when 'sent' then array['accepted','sent','reconciliation_required']
    when 'delayed' then array['accepted','sent','delayed','reconciliation_required']
    when 'delivered' then array['accepted','sent','delayed','delivered','reconciliation_required']
    else array['accepted','sent','delayed','delivered','failed','bounced','complained','suppressed','reconciliation_required'] end;

  if source_row.records_sent_at then
    execute format(
      'update %I.%I set status=$1,sent_at=case when $1=''sent'' then $2 else sent_at end,delivered_at=case when $1=''delivered'' then $2 else delivered_at end,failed_at=case when $1=any(array[''failed'',''bounced'',''complained'',''suppressed'']) then $2 else failed_at end,updated_at=$2 where id=$3 and status=any($4)',
      source_row.source_schema,source_row.source_table
    ) using next_status,p_occurred_at,registry_row.source_id,eligible;
  else
    execute format(
      'update %I.%I set status=$1,delivered_at=case when $1=''delivered'' then $2 else delivered_at end,failed_at=case when $1=any(array[''failed'',''bounced'',''complained'',''suppressed'']) then $2 else failed_at end,updated_at=$2 where id=$3 and status=any($4)',
      source_row.source_schema,source_row.source_table
    ) using next_status,p_occurred_at,registry_row.source_id,eligible;
  end if;
  get diagnostics affected=row_count;
  if affected=0 and registry_row.status=any(eligible) then
    raise exception 'email_delivery_projection_not_found_or_ineligible';
  end if;

  update public.email_delivery_registry set status=next_status,
    sent_at=case when next_status='sent' then p_occurred_at else sent_at end,
    delivered_at=case when next_status='delivered' then p_occurred_at else delivered_at end,
    failed_at=case when next_status in ('failed','bounced','complained','suppressed') then p_occurred_at else failed_at end,
    updated_at=p_occurred_at
  where id=registry_row.id and status=any(eligible);
end $$;
revoke all on function public.apply_registered_email_delivery_status(uuid,text,timestamptz) from public,anon,authenticated;

create function public.register_email_delivery_projection()
returns trigger language plpgsql security definer set search_path='' as $$
declare source_kind_value text; registry_id_value uuid; event_row record;
begin
  if new.provider_email_id is null then return new; end if;
  select source.source_kind into source_kind_value from public.email_delivery_source_types source
  where source.source_schema=tg_table_schema and source.source_table=tg_table_name;
  if source_kind_value is null then raise exception 'email_delivery_source_not_registered'; end if;
  insert into public.email_delivery_registry(
    school_id,provider,provider_email_id,source_kind,source_id,recipient_email,status,
    accepted_at,sent_at,delivered_at,failed_at,updated_at
  ) values(
    new.school_id,'resend',new.provider_email_id,source_kind_value,new.id,lower(trim(new.recipient_email)),
    case when new.status in ('accepted','sent','delivered','delayed','failed','bounced','complained','suppressed') then new.status else 'accepted' end,
    new.accepted_at,null,
    new.delivered_at,new.failed_at,new.updated_at
  ) on conflict(source_kind,source_id) do update set
    provider_email_id=excluded.provider_email_id,
    recipient_email=excluded.recipient_email,
    status=excluded.status,
    accepted_at=coalesce(public.email_delivery_registry.accepted_at,excluded.accepted_at),
    updated_at=excluded.updated_at
  where public.email_delivery_registry.provider_email_id=excluded.provider_email_id
  returning id into registry_id_value;
  if registry_id_value is null then raise exception 'email_delivery_registration_conflict'; end if;

  for event_row in
    update public.email_delivery_events set registry_id=registry_id_value,
      delivery_id=case when source_kind_value='billing_approval' then new.id else delivery_id end
    where registry_id is null and provider='resend' and provider_email_id=new.provider_email_id
    returning event_type,occurred_at
  loop
    perform public.apply_registered_email_delivery_status(registry_id_value,event_row.event_type,event_row.occurred_at);
  end loop;
  return new;
end $$;
revoke all on function public.register_email_delivery_projection() from public,anon,authenticated;

create trigger email_deliveries_register_provider_identity
after insert or update of provider_email_id on public.email_deliveries
for each row when(new.provider_email_id is not null) execute function public.register_email_delivery_projection();
create trigger owner_notification_email_register_provider_identity
after insert or update of provider_email_id on public.owner_notification_email_outbox
for each row when(new.provider_email_id is not null) execute function public.register_email_delivery_projection();
create trigger lesson_created_email_register_provider_identity
after insert or update of provider_email_id on public.lesson_created_email_outbox
for each row when(new.provider_email_id is not null) execute function public.register_email_delivery_projection();
create trigger lesson_request_email_register_provider_identity
after insert or update of provider_email_id on public.lesson_request_email_outbox
for each row when(new.provider_email_id is not null) execute function public.register_email_delivery_projection();
create trigger teacher_invitation_register_provider_identity
after insert or update of provider_email_id on public.teacher_invitation_deliveries
for each row when(new.provider_email_id is not null) execute function public.register_email_delivery_projection();
create trigger lesson_proposal_email_register_provider_identity
after insert or update of provider_email_id on public.lesson_proposal_email_outbox
for each row when(new.provider_email_id is not null) execute function public.register_email_delivery_projection();

-- Register historical provider identities without touching projection timestamps.
insert into public.email_delivery_registry(
  school_id,provider,provider_email_id,source_kind,source_id,recipient_email,status,
  accepted_at,sent_at,delivered_at,failed_at,created_at,updated_at
)
select school_id,'resend',provider_email_id,'billing_approval',id,lower(trim(recipient_email)),
  case when status in ('accepted','sent','delivered','delayed','failed','bounced','complained','suppressed') then status else 'accepted' end,
  accepted_at,sent_at,delivered_at,failed_at,created_at,updated_at
from public.email_deliveries where provider_email_id is not null
union all
select school_id,'resend',provider_email_id,'owner_notification',id,lower(trim(recipient_email)),
  case when status in ('accepted','sent','delivered','delayed','failed','bounced','complained','suppressed') then status else 'accepted' end,
  accepted_at,null,delivered_at,failed_at,created_at,updated_at
from public.owner_notification_email_outbox where provider_email_id is not null
union all
select school_id,'resend',provider_email_id,'lesson_created',id,lower(trim(recipient_email)),
  case when status in ('accepted','sent','delivered','delayed','failed','bounced','complained','suppressed') then status else 'accepted' end,
  accepted_at,null,delivered_at,failed_at,created_at,updated_at
from public.lesson_created_email_outbox where provider_email_id is not null
union all
select school_id,'resend',provider_email_id,'lesson_change_request',id,lower(trim(recipient_email)),
  case when status in ('accepted','sent','delivered','delayed','failed','bounced','complained','suppressed') then status else 'accepted' end,
  accepted_at,null,delivered_at,failed_at,created_at,updated_at
from public.lesson_request_email_outbox where provider_email_id is not null
union all
select school_id,'resend',provider_email_id,'teacher_invitation',id,lower(trim(recipient_email)),
  case when status in ('accepted','sent','delivered','delayed','failed','bounced','complained','suppressed') then status else 'accepted' end,
  accepted_at,null,delivered_at,failed_at,created_at,updated_at
from public.teacher_invitation_deliveries where provider_email_id is not null
union all
select school_id,'resend',provider_email_id,'lesson_schedule_proposal',id,lower(trim(recipient_email)),
  case when status in ('accepted','sent','delivered','delayed','failed','bounced','complained','suppressed') then status else 'accepted' end,
  accepted_at,null,delivered_at,failed_at,created_at,updated_at
from public.lesson_proposal_email_outbox where provider_email_id is not null;

update public.email_delivery_events event set
  registry_id=registry.id,
  delivery_id=case when registry.source_kind='billing_approval' then registry.source_id else event.delivery_id end
from public.email_delivery_registry registry
where event.provider='resend' and event.provider_email_id=registry.provider_email_id;

create or replace function public.record_resend_delivery_event(
  p_provider_event_id text,p_provider_email_id text,p_event_type text,
  p_occurred_at timestamptz,p_recipient_email text default null
) returns text language plpgsql security definer set search_path='' as $$
declare
  target_registry_id uuid;
  legacy_delivery_id uuid;
  inserted_id bigint;
  normalized_email text:=lower(trim(p_recipient_email));
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  if nullif(trim(p_provider_event_id),'') is null or nullif(trim(p_provider_email_id),'') is null
  then raise exception 'invalid_provider_event'; end if;
  select registry.id,
    case when registry.source_kind='billing_approval' then registry.source_id end
  into target_registry_id,legacy_delivery_id
  from public.email_delivery_registry registry
  where registry.provider='resend' and registry.provider_email_id=p_provider_email_id;

  insert into public.email_delivery_events(
    provider_event_id,provider_email_id,delivery_id,registry_id,event_type,occurred_at,recipient_email
  ) values(
    p_provider_event_id,p_provider_email_id,legacy_delivery_id,target_registry_id,p_event_type,p_occurred_at,nullif(normalized_email,'')
  ) on conflict(provider,provider_event_id) do nothing returning id into inserted_id;
  if inserted_id is null then return 'duplicate'; end if;
  if p_event_type in ('email.bounced','email.complained','email.suppressed') and normalized_email<>'' then
    insert into public.email_suppressions(recipient_email,reason,provider_event_id,suppressed_at)
    values(normalized_email,case p_event_type when 'email.bounced' then 'bounced'
      when 'email.complained' then 'complained' else 'provider_suppressed' end,p_provider_event_id,p_occurred_at)
    on conflict(recipient_email) do update set reason=excluded.reason,
      provider_event_id=excluded.provider_event_id,suppressed_at=excluded.suppressed_at;
  end if;
  if target_registry_id is null then return 'pending_reconciliation'; end if;
  perform public.apply_registered_email_delivery_status(target_registry_id,p_event_type,p_occurred_at);
  return 'recorded';
end $$;

revoke all on function public.record_resend_delivery_event(text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_resend_delivery_event(text,text,text,timestamptz,text) to service_role;

comment on table public.email_delivery_registry is
  'Canonical provider identity and delivery state for every email projection. Source routing is data-owned by email_delivery_source_types.';
comment on column public.email_delivery_events.registry_id is
  'Generic delivery identity; delivery_id remains the compatibility reference for billing-approval emails.';
