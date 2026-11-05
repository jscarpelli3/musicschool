create function public.default_student_to_sole_teacher()
returns trigger language plpgsql security definer set search_path='' as $$
declare sole_teacher_id uuid;
begin
  if new.primary_teacher_id is not null then return new; end if;
  if (select count(*) from public.teachers where school_id=new.school_id)=1 then
    select teacher.person_id into sole_teacher_id
    from public.teachers teacher where teacher.school_id=new.school_id;
  end if;
  new.primary_teacher_id:=sole_teacher_id;
  return new;
end;
$$;

create trigger students_default_to_sole_teacher
before insert on public.students
for each row execute function public.default_student_to_sole_teacher();

create function public.assign_unassigned_students_to_first_teacher()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from public.teachers where school_id=new.school_id)=1 then
    update public.students
    set primary_teacher_id=new.person_id
    where school_id=new.school_id and primary_teacher_id is null;
  end if;
  return new;
end;
$$;

create trigger teachers_assign_first_teacher_students
after insert on public.teachers
for each row execute function public.assign_unassigned_students_to_first_teacher();

revoke all on function public.default_student_to_sole_teacher() from public,anon,authenticated;
revoke all on function public.assign_unassigned_students_to_first_teacher() from public,anon,authenticated;

comment on function public.default_student_to_sole_teacher() is
  'Assigns the only teacher as a new student default without creating a separate solo-mode data model.';
