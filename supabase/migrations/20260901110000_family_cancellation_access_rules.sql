-- Family-facing cancellation authority is operational configuration, separate
-- from the effective-dated policy that determines timing and normal outcomes.

create table public.school_family_cancellation_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  timely_approval_mode text not null default 'owner_review'
    check (timely_approval_mode in ('owner_review','automatic')),
  refund_portal_mode text not null default 'contact_school'
    check (refund_portal_mode in ('allow_request','contact_school','not_offered')),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger school_family_cancellation_settings_updated_at before update
on public.school_family_cancellation_settings for each row execute function public.set_updated_at();

create table public.billing_account_cancellation_overrides (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  timely_approval_mode text check (timely_approval_mode is null or timely_approval_mode in ('owner_review','automatic')),
  refund_portal_mode text check (refund_portal_mode is null or refund_portal_mode in ('allow_request','contact_school','not_offered')),
  private_reason text not null check (length(trim(private_reason)) between 1 and 1000),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  status text not null default 'active' check (status in ('active','superseded','ended')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(school_id,id),
  foreign key(school_id,billing_account_id) references public.billing_accounts(school_id,id) on delete restrict,
  check (timely_approval_mode is not null or refund_portal_mode is not null),
  check (effective_until is null or effective_until>effective_from)
);
create unique index billing_account_cancellation_overrides_one_active
  on public.billing_account_cancellation_overrides(billing_account_id) where status='active';

alter table public.school_family_cancellation_settings enable row level security;
alter table public.billing_account_cancellation_overrides enable row level security;
create policy school_family_cancellation_settings_admin_select on public.school_family_cancellation_settings
  for select to authenticated using(public.has_school_role(school_id,array['owner','admin']));
create policy billing_account_cancellation_overrides_admin_select on public.billing_account_cancellation_overrides
  for select to authenticated using(public.has_school_role(school_id,array['owner','admin']));
grant select on public.school_family_cancellation_settings,public.billing_account_cancellation_overrides to authenticated;
revoke insert,update,delete on public.school_family_cancellation_settings,public.billing_account_cancellation_overrides from authenticated;

create function public.set_school_family_cancellation_settings(
  p_school_id uuid,p_timely_approval_mode text,p_refund_portal_mode text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_role text; before_row jsonb;
begin
  select role into actor_role from public.school_members where school_id=p_school_id
    and profile_id=actor_id and status='active';
  if actor_id is null or actor_role not in ('owner','admin') then raise exception 'not_authorized'; end if;
  if p_timely_approval_mode not in ('owner_review','automatic')
    or p_refund_portal_mode not in ('allow_request','contact_school','not_offered') then raise exception 'invalid_settings'; end if;
  select to_jsonb(setting) into before_row from public.school_family_cancellation_settings setting where school_id=p_school_id for update;
  insert into public.school_family_cancellation_settings(school_id,timely_approval_mode,refund_portal_mode,updated_by)
  values(p_school_id,p_timely_approval_mode,p_refund_portal_mode,actor_id)
  on conflict(school_id) do update set timely_approval_mode=excluded.timely_approval_mode,
    refund_portal_mode=excluded.refund_portal_mode,updated_by=actor_id;
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'school.family_cancellation_settings_changed','school',p_school_id,actor_id,actor_role,
    'policy_editor',jsonb_build_object('before',coalesce(before_row,'null'::jsonb),'timely_approval_mode',p_timely_approval_mode,'refund_portal_mode',p_refund_portal_mode));
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'school.family_cancellation_settings_changed','school',p_school_id,
    jsonb_build_object('before',coalesce(before_row,'null'::jsonb),'timely_approval_mode',p_timely_approval_mode,'refund_portal_mode',p_refund_portal_mode));
  return jsonb_build_object('outcome','saved');
end $$;
revoke all on function public.set_school_family_cancellation_settings(uuid,text,text) from public,anon;
grant execute on function public.set_school_family_cancellation_settings(uuid,text,text) to authenticated;

create function public.set_billing_account_cancellation_override(
  p_school_id uuid,p_billing_account_id uuid,p_timely_approval_mode text,
  p_refund_portal_mode text,p_private_reason text,p_effective_until timestamptz default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_role text; new_id uuid; clean_reason text:=trim(coalesce(p_private_reason,''));
begin
  select role into actor_role from public.school_members where school_id=p_school_id
    and profile_id=actor_id and status='active';
  if actor_id is null or actor_role not in ('owner','admin') then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.billing_accounts where school_id=p_school_id and id=p_billing_account_id) then raise exception 'account_not_found'; end if;
  if (p_timely_approval_mode is not null and p_timely_approval_mode not in ('owner_review','automatic'))
    or (p_refund_portal_mode is not null and p_refund_portal_mode not in ('allow_request','contact_school','not_offered'))
    or (p_timely_approval_mode is null and p_refund_portal_mode is null)
    or length(clean_reason) not between 1 and 1000 or (p_effective_until is not null and p_effective_until<=now())
  then raise exception 'invalid_override'; end if;
  update public.billing_account_cancellation_overrides set status='superseded',effective_until=coalesce(effective_until,now())
    where school_id=p_school_id and billing_account_id=p_billing_account_id and status='active';
  insert into public.billing_account_cancellation_overrides(school_id,billing_account_id,timely_approval_mode,
    refund_portal_mode,private_reason,effective_until,created_by)
  values(p_school_id,p_billing_account_id,p_timely_approval_mode,p_refund_portal_mode,clean_reason,p_effective_until,actor_id)
  returning id into new_id;
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'billing_account.cancellation_override_set','billing_account',p_billing_account_id,actor_id,actor_role,
    'payer_management',jsonb_build_object('override_id',new_id,'timely_approval_mode',p_timely_approval_mode,
      'refund_portal_mode',p_refund_portal_mode,'effective_until',p_effective_until,'private_reason',clean_reason));
  return new_id;
end $$;
revoke all on function public.set_billing_account_cancellation_override(uuid,uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.set_billing_account_cancellation_override(uuid,uuid,text,text,text,timestamptz) to authenticated;

create function public.guard_billing_account_cancellation_overrides_append_only()
returns trigger language plpgsql set search_path='' as $$ begin
  if old.status='active' and new.status in ('superseded','ended')
    and new.id=old.id and new.school_id=old.school_id and new.billing_account_id=old.billing_account_id
    and new.timely_approval_mode is not distinct from old.timely_approval_mode
    and new.refund_portal_mode is not distinct from old.refund_portal_mode
    and new.private_reason=old.private_reason and new.created_by=old.created_by and new.created_at=old.created_at
  then return new; end if;
  raise exception 'Cancellation overrides are append-only';
end $$;
create trigger billing_account_cancellation_overrides_append_only before update or delete
on public.billing_account_cancellation_overrides for each row execute function public.guard_billing_account_cancellation_overrides_append_only();

do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.school_family_cancellation_settings'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.billing_account_cancellation_overrides'::regclass)
  then raise exception 'RLS missing on cancellation access settings'; end if;
  if has_table_privilege('authenticated','public.school_family_cancellation_settings','INSERT')
    or has_table_privilege('authenticated','public.billing_account_cancellation_overrides','INSERT')
  then raise exception 'authenticated may not directly mutate cancellation access settings'; end if;
end $$;

alter function public.preview_client_lesson_change_request(uuid,text)
  rename to preview_client_lesson_change_policy_base;
revoke all on function public.preview_client_lesson_change_policy_base(uuid,text) from public,anon,authenticated;

create function public.preview_client_lesson_change_request(p_lesson_event_id uuid,p_request_type text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; setting record; account_override record; resolved_approval text; resolved_refund text;
begin
  base:=public.preview_client_lesson_change_policy_base(p_lesson_event_id,p_request_type);
  select timely_approval_mode,refund_portal_mode into setting
  from public.school_family_cancellation_settings where school_id=(base->>'school_id')::uuid;
  resolved_approval:=coalesce(setting.timely_approval_mode,'owner_review');
  resolved_refund:=coalesce(setting.refund_portal_mode,'contact_school');
  select timely_approval_mode,refund_portal_mode into account_override
  from public.billing_account_cancellation_overrides
  where school_id=(base->>'school_id')::uuid and billing_account_id=(base->>'billing_account_id')::uuid
    and status='active' and effective_from<=now() and (effective_until is null or effective_until>now())
  order by created_at desc limit 1;
  resolved_approval:=coalesce(account_override.timely_approval_mode,resolved_approval);
  resolved_refund:=coalesce(account_override.refund_portal_mode,resolved_refund);
  return base||jsonb_build_object(
    'approval_mode',case when (base->>'within_policy_window')::boolean then resolved_approval else 'owner_review' end,
    'refund_portal_mode',resolved_refund,
    'access_settings_snapshot',jsonb_build_object('school_timely_approval_mode',coalesce(setting.timely_approval_mode,'owner_review'),
      'school_refund_portal_mode',coalesce(setting.refund_portal_mode,'contact_school'),
      'effective_timely_approval_mode',resolved_approval,'effective_refund_portal_mode',resolved_refund,
      'payer_override_applied',account_override.timely_approval_mode is not null or account_override.refund_portal_mode is not null)
  );
end $$;
revoke all on function public.preview_client_lesson_change_request(uuid,text) from public,anon;
grant execute on function public.preview_client_lesson_change_request(uuid,text) to authenticated;
