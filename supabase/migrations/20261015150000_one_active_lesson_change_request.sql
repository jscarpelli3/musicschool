with ranked as (
  select id,row_number() over(partition by lesson_event_id order by requested_at,id) as position
  from public.lesson_change_requests where status in ('pending','in_progress')
)
update public.lesson_change_requests request set status='superseded',updated_at=now()
from ranked where request.id=ranked.id and ranked.position>1;

drop index if exists public.lesson_change_requests_one_pending_scenario;
create unique index lesson_change_requests_one_active_per_lesson
  on public.lesson_change_requests(lesson_event_id) where status in ('pending','in_progress');

drop function if exists public.get_client_portal_lessons();
create function public.get_client_portal_lessons()
returns table (
  lesson_id uuid, school_id uuid, school_name text, school_timezone text,
  school_phone text, school_email text, student_id uuid, student_name text,
  teacher_name text, product_name text, place_name text, starts_at timestamptz,
  ends_at timestamptz, reschedule_allowed boolean, reschedule_blocked_reason text,
  pending_request_id uuid, pending_request_type text, pending_request_status text,
  pending_requested_at timestamptz
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
    join public.billing_accounts account on account.school_id=portal_auth.school_id and account.id=portal_auth.billing_account_id and account.status='active'
    join public.billing_account_students account_student on account_student.school_id=account.school_id and account_student.billing_account_id=account.id
    join public.students student on student.school_id=account_student.school_id and student.person_id=account_student.student_id and student.enrollment_status in ('active','paused')
  )
  select event.id,school.id,school.name,school.timezone,school.phone,school.reply_to_email,event.student_id,
    concat_ws(' ',coalesce(nullif(trim(student_person.preferred_name),''),student_person.first_name),student_person.last_name),
    concat_ws(' ',coalesce(nullif(trim(teacher_person.preferred_name),''),teacher_person.first_name),teacher_person.last_name),
    product.name,place.name,event.starts_at,event.ends_at,event.reschedule_allowed,event.reschedule_blocked_reason,
    pending.id,pending.request_type,pending.status,pending.requested_at
  from authorized_students access
  join public.lesson_events event on event.school_id=access.school_id and event.student_id=access.student_id
  join public.schools school on school.id=event.school_id
  join public.people student_person on student_person.school_id=event.school_id and student_person.id=event.student_id
  join public.people teacher_person on teacher_person.school_id=event.school_id and teacher_person.id=event.teacher_id
  join public.service_products product on product.school_id=event.school_id and product.id=event.product_id
  join public.lesson_places place on place.school_id=event.school_id and place.id=event.place_id
  left join lateral (
    select request.id,request.request_type,request.status,request.requested_at
    from public.lesson_change_requests request
    where request.school_id=event.school_id and request.lesson_event_id=event.id and request.status in ('pending','in_progress')
    order by request.requested_at,request.id limit 1
  ) pending on true
  where event.status='scheduled' and event.starts_at>=now() and event.starts_at<now()+interval '3 months'
  order by event.starts_at,event.id;
$$;
revoke all on function public.get_client_portal_lessons() from public,anon;
grant execute on function public.get_client_portal_lessons() to authenticated;

do $$ begin
  if has_function_privilege('anon','public.get_client_portal_lessons()','EXECUTE')
    or not has_function_privilege('authenticated','public.get_client_portal_lessons()','EXECUTE')
  then raise exception 'client portal pending request grants are incorrect'; end if;
  if position('payer_portal_authorizations' in pg_get_functiondef('public.get_client_portal_lessons()'::regprocedure))=0
    or position('lesson_change_requests' in pg_get_functiondef('public.get_client_portal_lessons()'::regprocedure))=0
  then raise exception 'client portal pending request authorization is incomplete'; end if;
end $$;
