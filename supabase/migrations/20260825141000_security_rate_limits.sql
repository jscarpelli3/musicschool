create table public.security_rate_limit_buckets (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope,subject_hash)
);

alter table public.security_rate_limit_buckets enable row level security;
revoke all on table public.security_rate_limit_buckets from public,anon,authenticated;

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

  if bucket.window_started_at + make_interval(secs=>p_window_seconds)<=v_now then
    bucket.window_started_at:=v_now;
    bucket.request_count:=0;
    bucket.blocked_until:=null;
  end if;
  bucket.request_count:=bucket.request_count+1;
  if bucket.request_count>p_limit then bucket.blocked_until:=v_now+make_interval(secs=>p_block_seconds); end if;

  update public.security_rate_limit_buckets set
    window_started_at=bucket.window_started_at,request_count=bucket.request_count,
    blocked_until=bucket.blocked_until,updated_at=v_now
  where scope=p_scope and subject_hash=p_subject_hash;

  return query select bucket.request_count<=p_limit,
    case when bucket.request_count>p_limit then p_block_seconds else 0 end,
    greatest(0,p_limit-bucket.request_count);
end;
$$;

revoke all on function public.consume_security_rate_limit(text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_security_rate_limit(text,text,integer,integer,integer) to service_role;

create index security_rate_limit_updated_idx on public.security_rate_limit_buckets(updated_at);

create or replace function public.prune_security_rate_limit_buckets()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare removed integer;
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  delete from public.security_rate_limit_buckets where updated_at<now()-interval '2 days';
  get diagnostics removed=row_count;
  return removed;
end;
$$;
revoke all on function public.prune_security_rate_limit_buckets() from public,anon,authenticated;
grant execute on function public.prune_security_rate_limit_buckets() to service_role;
