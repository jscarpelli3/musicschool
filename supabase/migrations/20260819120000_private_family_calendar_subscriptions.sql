create table public.payer_calendar_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  foreign key (school_id,billing_account_id)
    references public.billing_accounts(school_id,id) on delete cascade
);

create unique index payer_calendar_subscriptions_one_active_account
  on public.payer_calendar_subscriptions(billing_account_id)
  where revoked_at is null;

alter table public.payer_calendar_subscriptions enable row level security;
revoke all on table public.payer_calendar_subscriptions from public,anon,authenticated;

create or replace function public.get_client_portal_calendar_accounts()
returns table (
  school_id uuid,
  billing_account_id uuid,
  school_name text,
  school_timezone text,
  subscription_active boolean
)
language sql stable security definer set search_path=''
as $$
  with identity as (
    select lower(nullif(trim(auth.jwt()->>'email'),'')) as email
    where auth.role()='authenticated' and public.current_client_portal_access_state()='ready'
  )
  select account.school_id,account.id,school.name,school.timezone,
    exists(select 1 from public.payer_calendar_subscriptions subscription
      where subscription.billing_account_id=account.id and subscription.revoked_at is null)
  from identity
  join public.payer_portal_authorizations portal_auth on portal_auth.normalized_email=identity.email
  join public.billing_accounts account on account.school_id=portal_auth.school_id
    and account.id=portal_auth.billing_account_id and account.status='active'
  join public.schools school on school.id=account.school_id
  order by school.name,account.id;
$$;

create or replace function public.rotate_client_portal_calendar_subscription(p_school_id uuid)
returns text
language plpgsql volatile security definer set search_path=''
as $$
declare
  account_id uuid;
  raw_token text;
begin
  if auth.role()<>'authenticated' or public.current_client_portal_access_state()<>'ready' then
    raise exception 'portal_access_denied' using errcode='42501';
  end if;

  select account.id into account_id
  from public.payer_portal_authorizations portal_auth
  join public.billing_accounts account on account.school_id=portal_auth.school_id
    and account.id=portal_auth.billing_account_id and account.status='active'
  where portal_auth.school_id=p_school_id
    and portal_auth.normalized_email=lower(nullif(trim(auth.jwt()->>'email'),''));

  if account_id is null then raise exception 'portal_access_denied' using errcode='42501'; end if;

  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  update public.payer_calendar_subscriptions set revoked_at=now()
  where billing_account_id=account_id and revoked_at is null;
  insert into public.payer_calendar_subscriptions(school_id,billing_account_id,token_hash)
  values(p_school_id,account_id,encode(extensions.digest(raw_token,'sha256'),'hex'));
  return raw_token;
end;
$$;

create or replace function public.revoke_client_portal_calendar_subscription(p_school_id uuid)
returns boolean
language plpgsql volatile security definer set search_path=''
as $$
declare
  changed_count integer;
begin
  if auth.role()<>'authenticated' or public.current_client_portal_access_state()<>'ready' then
    raise exception 'portal_access_denied' using errcode='42501';
  end if;

  update public.payer_calendar_subscriptions subscription set revoked_at=now()
  from public.payer_portal_authorizations portal_auth
  join public.billing_accounts account on account.school_id=portal_auth.school_id
    and account.id=portal_auth.billing_account_id and account.status='active'
  where portal_auth.school_id=p_school_id
    and portal_auth.normalized_email=lower(nullif(trim(auth.jwt()->>'email'),''))
    and subscription.school_id=account.school_id
    and subscription.billing_account_id=account.id
    and subscription.revoked_at is null;
  get diagnostics changed_count=row_count;
  return changed_count>0;
end;
$$;

create or replace function public.get_payer_calendar_subscription(raw_token text)
returns table (
  school_id uuid,
  school_name text,
  school_timezone text,
  lesson_id uuid,
  student_name text,
  teacher_name text,
  product_name text,
  place_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  event_status text,
  updated_at timestamptz
)
language plpgsql volatile security definer set search_path=''
as $$
declare
  subscription_id uuid;
  account_id uuid;
begin
  if auth.role()<>'service_role' or raw_token is null or raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select subscription.id,subscription.billing_account_id
    into subscription_id,account_id
  from public.payer_calendar_subscriptions subscription
  join public.billing_accounts account on account.school_id=subscription.school_id
    and account.id=subscription.billing_account_id and account.status='active'
  where subscription.token_hash=encode(extensions.digest(raw_token,'sha256'),'hex')
    and subscription.revoked_at is null;

  if subscription_id is null then return; end if;
  update public.payer_calendar_subscriptions set last_accessed_at=now() where id=subscription_id;

  return query
  select school.id,school.name,school.timezone,event.id,
    concat_ws(' ',coalesce(nullif(trim(student_person.preferred_name),''),student_person.first_name),student_person.last_name),
    concat_ws(' ',coalesce(nullif(trim(teacher_person.preferred_name),''),teacher_person.first_name),teacher_person.last_name),
    product.name,place.name,event.starts_at,event.ends_at,event.status,event.updated_at
  from public.billing_account_students mapping
  join public.lesson_events event on event.school_id=mapping.school_id and event.student_id=mapping.student_id
  join public.schools school on school.id=event.school_id
  join public.people student_person on student_person.school_id=event.school_id and student_person.id=event.student_id
  join public.people teacher_person on teacher_person.school_id=event.school_id and teacher_person.id=event.teacher_id
  join public.service_products product on product.school_id=event.school_id and product.id=event.product_id
  join public.lesson_places place on place.school_id=event.school_id and place.id=event.place_id
  where mapping.billing_account_id=account_id
    and event.status in ('scheduled','cancelled','rescheduled')
    and event.starts_at>=now()-interval '6 months'
    and event.starts_at<now()+interval '12 months'
  order by event.starts_at,event.id;

  if not found then
    return query
    select school.id,school.name,school.timezone,null::uuid,null::text,null::text,
      null::text,null::text,null::timestamptz,null::timestamptz,null::text,null::timestamptz
    from public.payer_calendar_subscriptions subscription
    join public.schools school on school.id=subscription.school_id
    where subscription.id=subscription_id;
  end if;
end;
$$;

create or replace function public.revoke_calendar_subscription_on_payer_change()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  update public.payer_calendar_subscriptions set revoked_at=now()
  where billing_account_id=old.billing_account_id and revoked_at is null;
  return old;
end;
$$;

create trigger payer_authorization_revoke_calendar_subscription
after delete on public.payer_portal_authorizations
for each row execute function public.revoke_calendar_subscription_on_payer_change();

revoke all on function public.get_client_portal_calendar_accounts() from public,anon;
revoke all on function public.rotate_client_portal_calendar_subscription(uuid) from public,anon;
revoke all on function public.revoke_client_portal_calendar_subscription(uuid) from public,anon;
revoke all on function public.get_payer_calendar_subscription(text) from public,anon,authenticated;
revoke all on function public.revoke_calendar_subscription_on_payer_change() from public,anon,authenticated;
grant execute on function public.get_client_portal_calendar_accounts() to authenticated;
grant execute on function public.rotate_client_portal_calendar_subscription(uuid) to authenticated;
grant execute on function public.revoke_client_portal_calendar_subscription(uuid) to authenticated;
grant execute on function public.get_payer_calendar_subscription(text) to service_role;

comment on table public.payer_calendar_subscriptions is
  'Revocable, account-scoped family calendar bearer credentials; only SHA-256 token digests are retained.';
comment on function public.get_payer_calendar_subscription(text) is
  'Service-role-only calendar feed lookup bounded to one active billing account.';
