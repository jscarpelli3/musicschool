alter table public.school_notification_preferences
add column daily_hello boolean not null default false;

create table public.daily_hello_push_deliveries(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  status text not null default 'pending' check(status in('pending','processing','delivered','failed')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error text check(last_error is null or length(last_error)<=500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,profile_id,local_date)
);
create index daily_hello_push_dispatch_idx on public.daily_hello_push_deliveries(status,created_at);
create trigger daily_hello_push_deliveries_set_updated_at before update on public.daily_hello_push_deliveries for each row execute function public.set_updated_at();
alter table public.daily_hello_push_deliveries enable row level security;
revoke all on public.daily_hello_push_deliveries from public,anon,authenticated;

drop function public.set_my_school_notification_preferences(uuid,boolean,boolean,boolean,boolean);
create or replace function public.set_my_school_notification_preferences(
  p_school_id uuid,p_browser_push_enabled boolean,p_billing_activity boolean,p_schedule_requests boolean,p_lesson_updates boolean,p_daily_hello boolean
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not public.is_school_member(p_school_id) then raise exception 'not_authorized'; end if;
  insert into public.school_notification_preferences(
    school_id,profile_id,browser_push_enabled,billing_activity,schedule_requests,lesson_updates,daily_hello
  ) values(
    p_school_id,actor,p_browser_push_enabled,p_billing_activity,p_schedule_requests,p_lesson_updates,p_daily_hello
  ) on conflict(school_id,profile_id) do update set
    browser_push_enabled=excluded.browser_push_enabled,billing_activity=excluded.billing_activity,
    schedule_requests=excluded.schedule_requests,lesson_updates=excluded.lesson_updates,daily_hello=excluded.daily_hello;
end $$;
revoke all on function public.set_my_school_notification_preferences(uuid,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.set_my_school_notification_preferences(uuid,boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.claim_daily_hello_push_deliveries(p_limit integer default 25)
returns table(id uuid,profile_id uuid,school_id uuid,school_name text,school_timezone text,local_date date,member_role text)
language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  insert into public.daily_hello_push_deliveries(school_id,profile_id,local_date)
  select preference.school_id,preference.profile_id,(now() at time zone school.timezone)::date
  from public.school_notification_preferences preference
  join public.schools school on school.id=preference.school_id
  join public.school_members member on member.school_id=preference.school_id and member.profile_id=preference.profile_id and member.status='active'
  where preference.browser_push_enabled and preference.daily_hello
    and (now() at time zone school.timezone)::time>=time '07:00'
    and (now() at time zone school.timezone)::time<time '08:00'
    and exists(select 1 from public.user_push_subscriptions subscription where subscription.profile_id=preference.profile_id and subscription.status='active')
  on conflict(school_id,profile_id,local_date) do nothing;

  return query
  with candidates as(
    select delivery.id from public.daily_hello_push_deliveries delivery
    where (delivery.status='pending' or (delivery.status='processing' and delivery.claimed_at<now()-interval '10 minutes'))
      and delivery.attempt_count<5
    order by delivery.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,25),100))
  ),claimed as(
    update public.daily_hello_push_deliveries delivery set status='processing',claimed_at=now(),attempt_count=delivery.attempt_count+1,last_error=null
    from candidates where delivery.id=candidates.id returning delivery.*
  )
  select claimed.id,claimed.profile_id,claimed.school_id,school.name,school.timezone,claimed.local_date,member.role
  from claimed join public.schools school on school.id=claimed.school_id
  join public.school_members member on member.school_id=claimed.school_id and member.profile_id=claimed.profile_id and member.status='active';
end $$;
revoke all on function public.claim_daily_hello_push_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_daily_hello_push_deliveries(integer) to service_role;

create or replace function public.complete_daily_hello_push_delivery(p_delivery_id uuid,p_delivered boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  update public.daily_hello_push_deliveries set
    status=case when p_delivered then 'delivered' when attempt_count>=5 then 'failed' else 'pending' end,
    delivered_at=case when p_delivered then now() else null end,
    claimed_at=null,last_error=case when p_delivered then null else left(coalesce(p_error,'daily_hello_delivery_failed'),500) end
  where id=p_delivery_id and status='processing';
end $$;
revoke all on function public.complete_daily_hello_push_delivery(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.complete_daily_hello_push_delivery(uuid,boolean,text) to service_role;

comment on column public.school_notification_preferences.daily_hello is 'Opt-in morning dashboard summary delivered at approximately 7:00 AM in the school timezone.';
comment on table public.daily_hello_push_deliveries is 'One durable, deduplicated daily hello per school member and local calendar day.';
