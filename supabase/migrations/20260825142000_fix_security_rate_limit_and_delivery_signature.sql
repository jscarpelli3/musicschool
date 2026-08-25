create or replace function public.consume_security_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer default 60
)
returns table(allowed boolean,retry_after_seconds integer,remaining integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  bucket public.security_rate_limit_buckets%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  if p_scope !~ '^[a-z0-9_.:-]{1,80}$' or p_subject_hash !~ '^[a-f0-9]{64}$'
    or p_limit not between 1 and 10000 or p_window_seconds not between 1 and 86400
    or p_block_seconds not between 1 and 86400 then raise exception 'invalid_rate_limit'; end if;

  insert into public.security_rate_limit_buckets(scope,subject_hash,window_started_at,request_count,updated_at)
  values(p_scope,p_subject_hash,v_now,0,v_now)
  on conflict(scope,subject_hash) do nothing;

  select * into bucket from public.security_rate_limit_buckets
  where scope=p_scope and subject_hash=p_subject_hash for update;
  if bucket.blocked_until is not null and bucket.blocked_until>v_now then
    return query select false,ceil(extract(epoch from bucket.blocked_until-v_now))::integer,0;
    return;
  end if;
  if bucket.window_started_at+make_interval(secs=>p_window_seconds)<=v_now then
    bucket.window_started_at:=v_now; bucket.request_count:=0; bucket.blocked_until:=null;
  end if;
  bucket.request_count:=bucket.request_count+1;
  if bucket.request_count>p_limit then bucket.blocked_until:=v_now+make_interval(secs=>p_block_seconds); end if;
  update public.security_rate_limit_buckets set window_started_at=bucket.window_started_at,
    request_count=bucket.request_count,blocked_until=bucket.blocked_until,updated_at=v_now
  where scope=p_scope and subject_hash=p_subject_hash;
  return query select bucket.request_count<=p_limit,
    case when bucket.request_count>p_limit then p_block_seconds else 0 end,
    greatest(0,p_limit-bucket.request_count);
end;
$$;

create or replace function public.record_lesson_request_email_submission(
  p_delivery_id uuid,p_provider_email_id text default null,p_error_code text default null,p_error_message text default null
)
returns boolean language plpgsql security definer set search_path='' as $$ begin
  if auth.role()<>'service_role' then return false; end if;
  if p_provider_email_id is not null then update public.lesson_request_email_outbox set status='accepted',provider_email_id=p_provider_email_id,
    accepted_at=now(),provider_error_code=null,provider_error_message=null where id=p_delivery_id and status='pending';
  else update public.lesson_request_email_outbox set status='failed',provider_error_code=coalesce(p_error_code,'request_failed'),
    provider_error_message=left(coalesce(p_error_message,'Provider request failed'),500),failed_at=now() where id=p_delivery_id and status='pending'; end if;
  return found;
end $$;

revoke all on function public.consume_security_rate_limit(text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_security_rate_limit(text,text,integer,integer,integer) to service_role;
revoke all on function public.record_lesson_request_email_submission(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_lesson_request_email_submission(uuid,text,text,text) to service_role;
