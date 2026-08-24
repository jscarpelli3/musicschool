create or replace function public.is_current_assigned_teacher(p_school_id uuid,p_teacher_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.people person
    join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id
    join public.school_members member on member.school_id=person.school_id and member.profile_id=person.profile_id
    where person.school_id=p_school_id and person.id=p_teacher_id and person.profile_id=auth.uid()
      and person.status='active' and member.status='active' and member.role='teacher'
  )
$$;

create or replace function public.current_teacher_is_assigned_to_student(p_school_id uuid,p_student_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.people teacher_person
    join public.school_members member on member.school_id=teacher_person.school_id and member.profile_id=teacher_person.profile_id
    join public.lesson_events lesson on lesson.school_id=teacher_person.school_id and lesson.teacher_id=teacher_person.id
    where teacher_person.school_id=p_school_id and teacher_person.profile_id=auth.uid()
      and teacher_person.status='active' and member.status='active' and member.role='teacher'
      and lesson.student_id=p_student_id
  )
$$;

revoke all on function public.is_current_assigned_teacher(uuid,uuid) from public,anon;
revoke all on function public.current_teacher_is_assigned_to_student(uuid,uuid) from public,anon;
grant execute on function public.is_current_assigned_teacher(uuid,uuid) to authenticated;
grant execute on function public.current_teacher_is_assigned_to_student(uuid,uuid) to authenticated;

drop policy profiles_select_related on public.profiles;
create policy profiles_select_self on public.profiles for select to authenticated
using(id=auth.uid());

drop policy school_members_select_school on public.school_members;
create policy school_members_select_scoped on public.school_members for select to authenticated
using(profile_id=auth.uid() or public.has_school_role(school_id,array['owner','admin']));

drop policy people_select_member on public.people;
create policy people_select_scoped on public.people for select to authenticated
using(
  public.has_school_role(school_id,array['owner','admin'])
  or profile_id=auth.uid()
  or public.current_teacher_is_assigned_to_student(school_id,id)
);

drop policy teachers_select_member on public.teachers;
create policy teachers_select_scoped on public.teachers for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']) or public.is_current_assigned_teacher(school_id,person_id));

drop policy students_select_member on public.students;
create policy students_select_scoped on public.students for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']) or public.current_teacher_is_assigned_to_student(school_id,person_id));

drop policy student_contacts_select_member on public.student_contacts;
create policy student_contacts_select_management on public.student_contacts for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']));

drop policy billing_accounts_select_member on public.billing_accounts;
create policy billing_accounts_select_management on public.billing_accounts for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']));

drop policy billing_account_students_select_member on public.billing_account_students;
create policy billing_account_students_select_management on public.billing_account_students for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']));

drop policy teacher_availability_select_member on public.teacher_availability_rules;
create policy teacher_availability_select_scoped on public.teacher_availability_rules for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']) or public.is_current_assigned_teacher(school_id,teacher_id));

drop policy lesson_events_select_member on public.lesson_events;
create policy lesson_events_select_scoped on public.lesson_events for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']) or public.is_current_assigned_teacher(school_id,teacher_id));

drop policy lesson_series_member_select on public.lesson_series;
create policy lesson_series_select_scoped on public.lesson_series for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']) or public.is_current_assigned_teacher(school_id,teacher_id));

drop policy lesson_event_changes_member_select on public.lesson_event_changes;
create policy lesson_event_changes_select_scoped on public.lesson_event_changes for select to authenticated
using(
  public.has_school_role(school_id,array['owner','admin'])
  or exists(select 1 from public.lesson_events lesson where lesson.school_id=lesson_event_changes.school_id and lesson.id=lesson_event_changes.lesson_event_id and public.is_current_assigned_teacher(lesson.school_id,lesson.teacher_id))
);

drop policy lesson_event_price_snapshots_member_select on public.lesson_event_price_snapshots;
create policy lesson_event_price_snapshots_select_management on public.lesson_event_price_snapshots for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']));

drop policy lesson_series_billing_terms_member_select on public.lesson_series_billing_terms;
create policy lesson_series_billing_terms_select_management on public.lesson_series_billing_terms for select to authenticated
using(public.has_school_role(school_id,array['owner','admin']));
