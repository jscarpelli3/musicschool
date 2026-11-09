create table public.user_push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check(length(endpoint) between 20 and 2048 and endpoint~'^https://'),
  p256dh_key text not null check(length(p256dh_key) between 40 and 200),
  auth_key text not null check(length(auth_key) between 10 and 100),
  user_agent text check(user_agent is null or length(user_agent)<=500),
  status text not null default 'active' check(status in('active','revoked','expired')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_push_subscriptions_profile_status_idx on public.user_push_subscriptions(profile_id,status);
create trigger user_push_subscriptions_set_updated_at before update on public.user_push_subscriptions for each row execute function public.set_updated_at();

create table public.school_notification_preferences(
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  browser_push_enabled boolean not null default false,
  billing_activity boolean not null default true,
  schedule_requests boolean not null default true,
  lesson_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(school_id,profile_id)
);
create trigger school_notification_preferences_set_updated_at before update on public.school_notification_preferences for each row execute function public.set_updated_at();

create table public.push_notification_deliveries(
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.owner_notifications(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check(category in('billing_activity','schedule_requests','lesson_updates')),
  status text not null default 'pending' check(status in('pending','processing','delivered','failed','cancelled')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error text check(last_error is null or length(last_error)<=500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id,profile_id)
);
create index push_notification_deliveries_dispatch_idx on public.push_notification_deliveries(status,created_at);
create trigger push_notification_deliveries_set_updated_at before update on public.push_notification_deliveries for each row execute function public.set_updated_at();

alter table public.user_push_subscriptions enable row level security;
alter table public.school_notification_preferences enable row level security;
alter table public.push_notification_deliveries enable row level security;
revoke all on public.user_push_subscriptions,public.school_notification_preferences,public.push_notification_deliveries from public,anon,authenticated;
create policy school_notification_preferences_own_select on public.school_notification_preferences for select to authenticated
using(profile_id=(select auth.uid()) and public.is_school_member(school_id));
grant select on public.school_notification_preferences to authenticated;

create or replace function public.save_my_push_subscription(
  p_school_id uuid,p_endpoint text,p_p256dh_key text,p_auth_key text,p_user_agent text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); subscription_id uuid;
begin
  if actor is null or not public.is_school_member(p_school_id) then raise exception 'not_authorized'; end if;
  if length(trim(p_endpoint)) not between 20 and 2048 or trim(p_endpoint)!~'^https://'
    or length(trim(p_p256dh_key)) not between 40 and 200 or length(trim(p_auth_key)) not between 10 and 100
    or length(coalesce(p_user_agent,''))>500 then raise exception 'invalid_push_subscription'; end if;
  insert into public.user_push_subscriptions(profile_id,endpoint,p256dh_key,auth_key,user_agent,status)
  values(actor,trim(p_endpoint),trim(p_p256dh_key),trim(p_auth_key),nullif(left(trim(coalesce(p_user_agent,'')),500),''),'active')
  on conflict(endpoint) do update set profile_id=actor,p256dh_key=excluded.p256dh_key,auth_key=excluded.auth_key,
    user_agent=excluded.user_agent,status='active'
  returning id into subscription_id;
  insert into public.school_notification_preferences(school_id,profile_id,browser_push_enabled)
  values(p_school_id,actor,true)
  on conflict(school_id,profile_id) do update set browser_push_enabled=true;
  return subscription_id;
end $$;
revoke all on function public.save_my_push_subscription(uuid,text,text,text,text) from public,anon;
grant execute on function public.save_my_push_subscription(uuid,text,text,text,text) to authenticated;

create or replace function public.revoke_my_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  update public.user_push_subscriptions set status='revoked'
  where profile_id=auth.uid() and endpoint=trim(p_endpoint);
end $$;
revoke all on function public.revoke_my_push_subscription(text) from public,anon;
grant execute on function public.revoke_my_push_subscription(text) to authenticated;

create or replace function public.set_my_school_notification_preferences(
  p_school_id uuid,p_browser_push_enabled boolean,p_billing_activity boolean,p_schedule_requests boolean,p_lesson_updates boolean
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not public.is_school_member(p_school_id) then raise exception 'not_authorized'; end if;
  insert into public.school_notification_preferences(
    school_id,profile_id,browser_push_enabled,billing_activity,schedule_requests,lesson_updates
  ) values(
    p_school_id,actor,p_browser_push_enabled,p_billing_activity,p_schedule_requests,p_lesson_updates
  ) on conflict(school_id,profile_id) do update set
    browser_push_enabled=excluded.browser_push_enabled,billing_activity=excluded.billing_activity,
    schedule_requests=excluded.schedule_requests,lesson_updates=excluded.lesson_updates;
end $$;
revoke all on function public.set_my_school_notification_preferences(uuid,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.set_my_school_notification_preferences(uuid,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.queue_owner_notification_push()
returns trigger language plpgsql security definer set search_path='' as $$
declare category_value text;
begin
  category_value:=case
    when new.kind in('payer_approved','payer_rejected','payment_failed') then 'billing_activity'
    when new.kind in('lesson_change_requested','teacher_rescheduled','teacher_reschedule_requested') then 'schedule_requests'
    when new.kind='lesson_created' then 'lesson_updates'
    else null end;
  if category_value is null then return new; end if;
  insert into public.push_notification_deliveries(notification_id,school_id,profile_id,category)
  select new.id,new.school_id,new.recipient_profile_id,category_value
  from public.school_notification_preferences preference
  where preference.school_id=new.school_id and preference.profile_id=new.recipient_profile_id
    and preference.browser_push_enabled
    and case category_value when 'billing_activity' then preference.billing_activity when 'schedule_requests' then preference.schedule_requests else preference.lesson_updates end
    and exists(select 1 from public.user_push_subscriptions subscription where subscription.profile_id=new.recipient_profile_id and subscription.status='active')
  on conflict(notification_id,profile_id) do nothing;
  return new;
end $$;
create trigger owner_notifications_queue_push after insert on public.owner_notifications
for each row execute function public.queue_owner_notification_push();
revoke all on function public.queue_owner_notification_push() from public,anon,authenticated;

create or replace function public.claim_push_notification_deliveries(p_limit integer default 25)
returns table(id uuid,profile_id uuid,title text,message text,href text)
language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  return query
  with candidates as(
    select delivery.id from public.push_notification_deliveries delivery
    where (delivery.status='pending' or (delivery.status='processing' and delivery.claimed_at<now()-interval '10 minutes'))
      and delivery.attempt_count<5
    order by delivery.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,25),100))
  ),claimed as(
    update public.push_notification_deliveries delivery set status='processing',claimed_at=now(),attempt_count=delivery.attempt_count+1,last_error=null
    from candidates where delivery.id=candidates.id returning delivery.id,delivery.profile_id,delivery.notification_id
  )
  select claimed.id,claimed.profile_id,notification.title,notification.message,notification.href
  from claimed join public.owner_notifications notification on notification.id=claimed.notification_id;
end $$;
revoke all on function public.claim_push_notification_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_push_notification_deliveries(integer) to service_role;

create or replace function public.complete_push_notification_delivery(p_delivery_id uuid,p_delivered boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  update public.push_notification_deliveries set
    status=case when p_delivered then 'delivered' when attempt_count>=5 then 'failed' else 'pending' end,
    delivered_at=case when p_delivered then now() else null end,
    claimed_at=null,last_error=case when p_delivered then null else left(coalesce(p_error,'push_delivery_failed'),500) end
  where id=p_delivery_id and status='processing';
end $$;
revoke all on function public.complete_push_notification_delivery(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.complete_push_notification_delivery(uuid,boolean,text) to service_role;

comment on table public.user_push_subscriptions is 'Private browser push endpoints and encryption keys owned by an authenticated Common Time profile.';
comment on table public.school_notification_preferences is 'Per-user delivery choices scoped to one school membership.';
comment on table public.push_notification_deliveries is 'Durable browser-push work queued from owner notifications and delivered outside the database transaction.';
