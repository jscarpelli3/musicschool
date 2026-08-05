-- School-scoped people, teaching, student, family, and billing relationships.

create table public.people (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  external_ref text,
  first_name text not null check (length(trim(first_name)) between 1 and 80),
  last_name text not null check (length(trim(last_name)) between 1 and 80),
  preferred_name text,
  email text,
  phone text,
  avatar_path text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, profile_id),
  unique (school_id, external_ref)
);

create index people_school_name_idx on public.people(school_id, last_name, first_name);

create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();

create table public.teachers (
  person_id uuid primary key,
  school_id uuid not null,
  bio text,
  default_lesson_minutes integer not null default 30
    check (default_lesson_minutes between 15 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, person_id),
  foreign key (school_id, person_id)
    references public.people(school_id, id) on delete cascade
);

create index teachers_school_idx on public.teachers(school_id);

create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

create table public.students (
  person_id uuid primary key,
  school_id uuid not null,
  birth_date date,
  enrollment_status text not null default 'active'
    check (enrollment_status in ('prospect', 'active', 'paused', 'former')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, person_id),
  foreign key (school_id, person_id)
    references public.people(school_id, id) on delete cascade
);

create index students_school_status_idx on public.students(school_id, enrollment_status);

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create table public.student_contacts (
  school_id uuid not null,
  student_id uuid not null,
  contact_person_id uuid not null,
  relationship text not null,
  is_primary boolean not null default false,
  is_billing_contact boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (student_id, contact_person_id),
  foreign key (school_id, student_id)
    references public.students(school_id, person_id) on delete cascade,
  foreign key (school_id, contact_person_id)
    references public.people(school_id, id) on delete cascade,
  check (student_id <> contact_person_id)
);

create index student_contacts_school_contact_idx
  on public.student_contacts(school_id, contact_person_id);

create table public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  billing_contact_person_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'inactive')),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, billing_contact_person_id)
    references public.people(school_id, id) on delete restrict
);

create index billing_accounts_school_contact_idx
  on public.billing_accounts(school_id, billing_contact_person_id);

create trigger billing_accounts_set_updated_at
before update on public.billing_accounts
for each row execute function public.set_updated_at();

create table public.billing_account_students (
  school_id uuid not null,
  billing_account_id uuid not null,
  student_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (billing_account_id, student_id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete cascade,
  foreign key (school_id, student_id)
    references public.students(school_id, person_id) on delete cascade
);

create index billing_account_students_school_student_idx
  on public.billing_account_students(school_id, student_id);

alter table public.people enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.student_contacts enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.billing_account_students enable row level security;

create policy people_select_member on public.people for select to authenticated
using (public.is_school_member(school_id));
create policy people_manage_admin on public.people for all to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy teachers_select_member on public.teachers for select to authenticated
using (public.is_school_member(school_id));
create policy teachers_manage_admin on public.teachers for all to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy students_select_member on public.students for select to authenticated
using (public.is_school_member(school_id));
create policy students_manage_admin on public.students for all to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy student_contacts_select_member on public.student_contacts for select to authenticated
using (public.is_school_member(school_id));
create policy student_contacts_manage_admin on public.student_contacts for all to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy billing_accounts_select_member on public.billing_accounts for select to authenticated
using (public.is_school_member(school_id));
create policy billing_accounts_manage_admin on public.billing_accounts for all to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy billing_account_students_select_member
on public.billing_account_students for select to authenticated
using (public.is_school_member(school_id));
create policy billing_account_students_manage_admin
on public.billing_account_students for all to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.teachers to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.student_contacts to authenticated;
grant select, insert, update, delete on public.billing_accounts to authenticated;
grant select, insert, update, delete on public.billing_account_students to authenticated;

-- Seed the sole existing school with a coherent demo roster. Refuse to guess if
-- the project contains more than one school.
do $$
declare
  target_school_id uuid;
  owner_profile_id uuid;
  school_count integer;
begin
  select count(*) into school_count from public.schools;
  if school_count <> 1 then
    raise exception 'Demo roster requires exactly one school; found %', school_count;
  end if;

  select s.id, s.created_by
  into target_school_id, owner_profile_id
  from public.schools s;

  insert into public.people (
    school_id, profile_id, external_ref, first_name, last_name, email
  )
  select
    target_school_id,
    p.id,
    'demo-owner',
    coalesce(nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''), 'School'),
    coalesce(nullif(substr(coalesce(p.full_name, ''), length(split_part(coalesce(p.full_name, ''), ' ', 1)) + 2), ''), 'Owner'),
    p.email
  from public.profiles p
  where p.id = owner_profile_id;

  insert into public.people (school_id, external_ref, first_name, last_name, email)
  values
    (target_school_id, 'demo-teacher-lena', 'Lena', 'Ortiz', 'lena.ortiz@example.com'),
    (target_school_id, 'demo-teacher-evan', 'Evan', 'Brooks', 'evan.brooks@example.com'),
    (target_school_id, 'demo-student-maya', 'Maya', 'Chen', null),
    (target_school_id, 'demo-student-leo', 'Leo', 'Chen', null),
    (target_school_id, 'demo-student-noah', 'Noah', 'Williams', null),
    (target_school_id, 'demo-student-sophie', 'Sophie', 'Patel', null),
    (target_school_id, 'demo-student-amelia', 'Amelia', 'Davis', null),
    (target_school_id, 'demo-student-oliver', 'Oliver', 'Davis', null),
    (target_school_id, 'demo-student-lucas', 'Lucas', 'Martin', null),
    (target_school_id, 'demo-student-harper', 'Harper', 'Thompson', null),
    (target_school_id, 'demo-student-ethan', 'Ethan', 'Garcia', null),
    (target_school_id, 'demo-student-grace', 'Grace', 'Kim', null),
    (target_school_id, 'demo-student-ava', 'Ava', 'Morgan', 'ava.morgan@example.com'),
    (target_school_id, 'demo-student-julian', 'Julian', 'Reed', 'julian.reed@example.com'),
    (target_school_id, 'demo-payer-rachel', 'Rachel', 'Chen', 'rachel.chen@example.com'),
    (target_school_id, 'demo-payer-dana', 'Dana', 'Williams', 'dana.williams@example.com'),
    (target_school_id, 'demo-payer-priya', 'Priya', 'Patel', 'priya.patel@example.com'),
    (target_school_id, 'demo-payer-jordan', 'Jordan', 'Davis', 'jordan.davis@example.com'),
    (target_school_id, 'demo-payer-elise', 'Elise', 'Martin', 'elise.martin@example.com'),
    (target_school_id, 'demo-payer-renee', 'Renee', 'Thompson', 'renee.thompson@example.com'),
    (target_school_id, 'demo-payer-marisol', 'Marisol', 'Garcia', 'marisol.garcia@example.com'),
    (target_school_id, 'demo-payer-daniel', 'Daniel', 'Kim', 'daniel.kim@example.com');

  insert into public.teachers (school_id, person_id, bio)
  select target_school_id, id,
    case external_ref
      when 'demo-owner' then 'School owner and instructor.'
      when 'demo-teacher-lena' then 'Piano and voice instructor.'
      else 'Guitar and beginner piano instructor.'
    end
  from public.people
  where school_id = target_school_id
    and external_ref in ('demo-owner', 'demo-teacher-lena', 'demo-teacher-evan');

  insert into public.students (school_id, person_id, birth_date)
  select target_school_id, id,
    case external_ref
      when 'demo-student-maya' then date '2014-04-12'
      when 'demo-student-leo' then date '2017-09-03'
      when 'demo-student-noah' then date '2012-11-20'
      when 'demo-student-sophie' then date '2015-02-08'
      when 'demo-student-amelia' then date '2011-06-17'
      when 'demo-student-oliver' then date '2016-12-01'
      when 'demo-student-lucas' then date '2013-08-24'
      when 'demo-student-harper' then date '2015-10-14'
      when 'demo-student-ethan' then date '2012-03-29'
      when 'demo-student-grace' then date '2014-07-07'
      when 'demo-student-ava' then date '1994-05-16'
      else date '1988-01-22'
    end
  from public.people
  where school_id = target_school_id and external_ref like 'demo-student-%';

  insert into public.student_contacts (
    school_id, student_id, contact_person_id, relationship, is_primary, is_billing_contact
  )
  select
    target_school_id,
    student.id,
    payer.id,
    'parent',
    true,
    true
  from (values
    ('demo-student-maya', 'demo-payer-rachel'),
    ('demo-student-leo', 'demo-payer-rachel'),
    ('demo-student-noah', 'demo-payer-dana'),
    ('demo-student-sophie', 'demo-payer-priya'),
    ('demo-student-amelia', 'demo-payer-jordan'),
    ('demo-student-oliver', 'demo-payer-jordan'),
    ('demo-student-lucas', 'demo-payer-elise'),
    ('demo-student-harper', 'demo-payer-renee'),
    ('demo-student-ethan', 'demo-payer-marisol'),
    ('demo-student-grace', 'demo-payer-daniel')
  ) as links(student_ref, payer_ref)
  join public.people student
    on student.school_id = target_school_id and student.external_ref = links.student_ref
  join public.people payer
    on payer.school_id = target_school_id and payer.external_ref = links.payer_ref;

  insert into public.billing_accounts (school_id, billing_contact_person_id, name)
  select
    target_school_id,
    p.id,
    case
      when p.external_ref like 'demo-payer-%' then p.last_name || ' family'
      else p.first_name || ' ' || p.last_name
    end
  from public.people p
  where p.school_id = target_school_id
    and (p.external_ref like 'demo-payer-%'
      or p.external_ref in ('demo-student-ava', 'demo-student-julian'));

  insert into public.billing_account_students (school_id, billing_account_id, student_id)
  select target_school_id, account.id, student.id
  from (values
    ('demo-student-maya', 'demo-payer-rachel'),
    ('demo-student-leo', 'demo-payer-rachel'),
    ('demo-student-noah', 'demo-payer-dana'),
    ('demo-student-sophie', 'demo-payer-priya'),
    ('demo-student-amelia', 'demo-payer-jordan'),
    ('demo-student-oliver', 'demo-payer-jordan'),
    ('demo-student-lucas', 'demo-payer-elise'),
    ('demo-student-harper', 'demo-payer-renee'),
    ('demo-student-ethan', 'demo-payer-marisol'),
    ('demo-student-grace', 'demo-payer-daniel'),
    ('demo-student-ava', 'demo-student-ava'),
    ('demo-student-julian', 'demo-student-julian')
  ) as links(student_ref, payer_ref)
  join public.people student
    on student.school_id = target_school_id and student.external_ref = links.student_ref
  join public.people payer
    on payer.school_id = target_school_id and payer.external_ref = links.payer_ref
  join public.billing_accounts account
    on account.school_id = target_school_id and account.billing_contact_person_id = payer.id;

  insert into public.audit_log (
    school_id, actor_profile_id, action, entity_type, metadata
  ) values (
    target_school_id,
    owner_profile_id,
    'demo_roster.created',
    'school',
    jsonb_build_object(
      'teachers', 3,
      'students', 12,
      'guardian_payers', 8,
      'self_paying_students', 2,
      'billing_accounts', 10
    )
  );
end;
$$;
