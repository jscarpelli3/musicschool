drop function if exists public.get_client_portal_lessons();

create function public.get_client_portal_lessons()
returns table (
  lesson_id uuid, school_id uuid, school_name text, school_timezone text,
  school_phone text, school_email text,
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
  select event.id,school.id,school.name,school.timezone,school.phone,school.reply_to_email,event.student_id,
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

comment on function public.get_client_portal_lessons() is
  'Returns upcoming authorized payer lessons plus the school public phone and reply-to email configured in School Settings.';

do $$ begin
  if has_function_privilege('anon','public.get_client_portal_lessons()','EXECUTE')
    or not has_function_privilege('authenticated','public.get_client_portal_lessons()','EXECUTE')
  then raise exception 'client portal lesson contact grants are incorrect'; end if;
  if position('payer_portal_authorizations' in pg_get_functiondef('public.get_client_portal_lessons()'::regprocedure))=0
    or position('school.reply_to_email' in pg_get_functiondef('public.get_client_portal_lessons()'::regprocedure))=0
  then raise exception 'client portal lesson contact authorization is incomplete'; end if;
end $$;
