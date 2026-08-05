-- Allow multiple distinct daily availability blocks while rejecting overlaps.

create or replace function public.prevent_overlapping_teacher_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.teacher_availability_rules existing
    where existing.school_id = new.school_id
      and existing.teacher_id = new.teacher_id
      and existing.weekday = new.weekday
      and existing.id <> new.id
      and new.effective_from <= coalesce(existing.effective_until, 'infinity'::date)
      and existing.effective_from <= coalesce(new.effective_until, 'infinity'::date)
      and new.start_time < existing.end_time
      and new.end_time > existing.start_time
  ) then
    raise exception 'Teacher availability blocks cannot overlap';
  end if;

  return new;
end;
$$;

create trigger teacher_availability_rules_prevent_overlap
before insert or update on public.teacher_availability_rules
for each row execute function public.prevent_overlapping_teacher_availability();

revoke all on function public.prevent_overlapping_teacher_availability() from public;

insert into public.teacher_availability_rules (
  school_id,
  teacher_id,
  weekday,
  start_time,
  end_time,
  effective_from,
  created_by
)
select
  school.id,
  owner_person.id,
  3,
  time '09:00',
  time '12:00',
  date_trunc('month', current_date)::date,
  school.created_by
from public.schools school
join public.people owner_person
  on owner_person.school_id = school.id
  and owner_person.profile_id = school.created_by
where (select count(*) from public.schools) = 1;
