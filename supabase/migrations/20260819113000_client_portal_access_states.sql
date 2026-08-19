create table public.payer_portal_authorizations (
  school_id uuid not null,
  billing_account_id uuid not null,
  normalized_email text not null check (
    normalized_email=lower(trim(normalized_email))
    and normalized_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and length(normalized_email)<=320
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (billing_account_id),
  unique (school_id,normalized_email),
  foreign key (school_id,billing_account_id)
    references public.billing_accounts(school_id,id) on delete cascade
);

alter table public.payer_portal_authorizations enable row level security;
revoke all on table public.payer_portal_authorizations from anon,authenticated;

with candidates as (
  select account.school_id,account.id as billing_account_id,lower(trim(person.email)) as normalized_email,
    count(*) over(partition by account.school_id,lower(trim(person.email))) as email_count
  from public.billing_accounts account
  join public.people person on person.school_id=account.school_id and person.id=account.billing_contact_person_id
  where account.status='active' and person.status='active'
    and lower(trim(person.email)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and length(lower(trim(person.email)))<=320
)
insert into public.payer_portal_authorizations(school_id,billing_account_id,normalized_email)
select school_id,billing_account_id,normalized_email from candidates where email_count=1;

create or replace function public.client_portal_email_access_state(p_email text)
returns text
language sql stable security definer set search_path=''
as $$
  with normalized as (
    select lower(nullif(trim(p_email),'')) as email
  ), raw_accounts as (
    select account.school_id, account.id
    from normalized
    join public.people person on lower(trim(person.email))=normalized.email and person.status='active'
    join public.billing_accounts account on account.school_id=person.school_id
      and account.billing_contact_person_id=person.id and account.status='active'
  ), school_counts as (
    select school_id, count(distinct id) as account_count from raw_accounts group by school_id
  ), authorized_accounts as (
    select portal_auth.school_id,portal_auth.billing_account_id
    from normalized
    join public.payer_portal_authorizations portal_auth on portal_auth.normalized_email=normalized.email
    join public.billing_accounts account on account.school_id=portal_auth.school_id
      and account.id=portal_auth.billing_account_id and account.status='active'
  )
  select case
    when exists(select 1 from school_counts where account_count>1) then 'ambiguous'
    when not exists(select 1 from authorized_accounts) then 'not_setup'
    when not exists(
      select 1 from auth.users auth_user, normalized
      where lower(trim(auth_user.email))=normalized.email and auth_user.deleted_at is null
    ) then 'not_setup'
    else 'ready'
  end;
$$;

revoke all on function public.client_portal_email_access_state(text) from public;
grant execute on function public.client_portal_email_access_state(text) to anon,authenticated;

create or replace function public.current_client_portal_access_state()
returns text
language sql stable security definer set search_path=''
as $$
  select case when auth.role()<>'authenticated' then 'not_setup'
    else public.client_portal_email_access_state(auth.jwt()->>'email') end;
$$;

revoke all on function public.current_client_portal_access_state() from public,anon;
grant execute on function public.current_client_portal_access_state() to authenticated;

create or replace function public.get_portal_auth_user_id_by_email(p_email text)
returns uuid
language sql stable security definer set search_path=''
as $$
  select id from auth.users
  where lower(trim(email))=lower(trim(p_email)) and deleted_at is null
  order by created_at limit 1;
$$;

revoke all on function public.get_portal_auth_user_id_by_email(text) from public,anon,authenticated;
grant execute on function public.get_portal_auth_user_id_by_email(text) to service_role;

create or replace function public.sync_payer_portal_authorization()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  normalized_email text;
  account_row public.billing_accounts%rowtype;
begin
  if tg_table_name='billing_accounts' then
    delete from public.payer_portal_authorizations where billing_account_id=new.id;
    if new.status<>'active' then return new; end if;
    select lower(nullif(trim(email),'')) into normalized_email from public.people
    where school_id=new.school_id and id=new.billing_contact_person_id and status='active';
    if normalized_email is not null then
      insert into public.payer_portal_authorizations(school_id,billing_account_id,normalized_email)
      values(new.school_id,new.id,normalized_email);
    end if;
    return new;
  end if;

  normalized_email:=lower(nullif(trim(new.email),''));
  for account_row in select * from public.billing_accounts
    where school_id=new.school_id and billing_contact_person_id=new.id and status='active'
  loop
    delete from public.payer_portal_authorizations where billing_account_id=account_row.id;
    if new.status='active' and normalized_email is not null then
      insert into public.payer_portal_authorizations(school_id,billing_account_id,normalized_email)
      values(account_row.school_id,account_row.id,normalized_email);
    end if;
  end loop;
  return new;
exception when unique_violation then
  raise exception 'duplicate_payer_email' using errcode='23505';
end;
$$;

revoke all on function public.sync_payer_portal_authorization() from public,anon,authenticated;

drop trigger if exists billing_accounts_sync_portal_authorization on public.billing_accounts;
create trigger billing_accounts_sync_portal_authorization
after insert or update of billing_contact_person_id,status on public.billing_accounts
for each row execute function public.sync_payer_portal_authorization();

drop trigger if exists people_sync_payer_portal_authorization on public.people;
create trigger people_sync_payer_portal_authorization
before update of email,status on public.people
for each row execute function public.sync_payer_portal_authorization();

create or replace function public.get_client_portal_lessons()
returns table (
  lesson_id uuid, school_id uuid, school_name text, school_timezone text,
  student_id uuid, student_name text, teacher_name text, product_name text,
  place_name text, starts_at timestamptz, ends_at timestamptz,
  reschedule_allowed boolean, reschedule_blocked_reason text
)
language sql stable security definer set search_path=''
as $$
  with identity as (
    select lower(nullif(trim(auth.jwt()->>'email'),'')) as email
    where auth.role()='authenticated' and public.current_client_portal_access_state()='ready'
  ), authorized_students as (
    select distinct account.school_id, account_student.student_id
    from identity
    join public.payer_portal_authorizations portal_auth on portal_auth.normalized_email=identity.email
    join public.billing_accounts account on account.school_id=portal_auth.school_id
      and account.id=portal_auth.billing_account_id and account.status='active'
    join public.billing_account_students account_student on account_student.school_id=account.school_id
      and account_student.billing_account_id=account.id
    join public.students student on student.school_id=account_student.school_id
      and student.person_id=account_student.student_id and student.enrollment_status in ('active','paused')
  )
  select event.id,school.id,school.name,school.timezone,event.student_id,
    concat_ws(' ',coalesce(nullif(trim(student_person.preferred_name),''),student_person.first_name),student_person.last_name),
    concat_ws(' ',coalesce(nullif(trim(teacher_person.preferred_name),''),teacher_person.first_name),teacher_person.last_name),
    product.name,place.name,event.starts_at,event.ends_at,event.reschedule_allowed,event.reschedule_blocked_reason
  from authorized_students access
  join public.lesson_events event on event.school_id=access.school_id and event.student_id=access.student_id
  join public.schools school on school.id=event.school_id
  join public.people student_person on student_person.school_id=event.school_id and student_person.id=event.student_id
  join public.people teacher_person on teacher_person.school_id=event.school_id and teacher_person.id=event.teacher_id
  join public.service_products product on product.school_id=event.school_id and product.id=event.product_id
  join public.lesson_places place on place.school_id=event.school_id and place.id=event.place_id
  where event.status='scheduled' and event.starts_at>=now() and event.starts_at<now()+interval '3 months'
  order by event.starts_at,event.id;
$$;

revoke all on function public.get_client_portal_lessons() from public,anon;
grant execute on function public.get_client_portal_lessons() to authenticated;

comment on function public.client_portal_email_access_state(text) is
  'Returns ready, not_setup, or ambiguous for a payer email without exposing family data.';
comment on function public.current_client_portal_access_state() is
  'Returns portal access state for the current authenticated email.';
comment on function public.get_portal_auth_user_id_by_email(text) is
  'Service-role-only lookup used to provision silent passwordless payer identities.';
comment on function public.get_client_portal_lessons() is
  'Returns lessons only through active payer-account assignments for an unambiguous authenticated email.';
