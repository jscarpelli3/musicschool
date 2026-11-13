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
  on conflict on constraint daily_hello_push_deliveries_school_id_profile_id_local_date_key do nothing;

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
