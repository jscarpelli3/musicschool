create table public.school_capabilities(
  capability text primary key check(capability~'^[a-z][a-z0-9_.]*$'),
  description text not null check(length(trim(description)) between 1 and 300),
  created_at timestamptz not null default now()
);

create table public.school_role_capability_defaults(
  role text not null check(role in ('owner','admin','teacher','staff')),
  capability text not null references public.school_capabilities(capability) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(role,capability)
);

create table public.school_member_capability_overrides(
  school_id uuid not null,
  profile_id uuid not null,
  capability text not null references public.school_capabilities(capability) on delete restrict,
  granted boolean not null,
  reason text not null check(length(trim(reason)) between 1 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(school_id,profile_id,capability),
  foreign key(school_id,profile_id) references public.school_members(school_id,profile_id) on delete cascade
);

insert into public.school_capabilities(capability,description) values
  ('school.workspace.view','Open the school workspace and common roster surfaces.'),
  ('teacher.workspace.use','Open the assigned-teacher workspace.'),
  ('school.lessons.manage','Create, move, block, and initiate school changes for lessons.'),
  ('school.approvals.review','Review scheduling and lesson-change decisions.'),
  ('school.billing.manage','Prepare billing, payment methods, approvals, and collections.'),
  ('school.policies.manage','Publish policy versions and family access settings.'),
  ('school.products.manage','Create and maintain service products.'),
  ('school.places.create','Create a lesson place.'),
  ('school.places.manage','Edit or retire any lesson place.'),
  ('school.setup.manage','Manage general school setup.'),
  ('school.appearance.manage','Manage school branding and appearance.'),
  ('school.appearance.palette_manage','Manage the shared theme palette.'),
  ('school.staff.directory_manage','Manage the staff directory and invitations.'),
  ('school.teacher_records.manage','Manage an individual teacher record.'),
  ('school.student_support.view','View student approvals and replacement entitlements.');

insert into public.school_role_capability_defaults(role,capability)
select role_name,capability from (values
  ('owner','school.workspace.view'),('owner','teacher.workspace.use'),('owner','school.lessons.manage'),
  ('owner','school.approvals.review'),('owner','school.billing.manage'),('owner','school.policies.manage'),
  ('owner','school.products.manage'),('owner','school.places.create'),('owner','school.places.manage'),
  ('owner','school.setup.manage'),('owner','school.appearance.manage'),('owner','school.appearance.palette_manage'),
  ('owner','school.staff.directory_manage'),('owner','school.teacher_records.manage'),('owner','school.student_support.view'),
  ('admin','school.workspace.view'),('admin','teacher.workspace.use'),('admin','school.lessons.manage'),
  ('admin','school.approvals.review'),('admin','school.billing.manage'),('admin','school.policies.manage'),
  ('admin','school.products.manage'),('admin','school.places.create'),('admin','school.places.manage'),
  ('admin','school.setup.manage'),('admin','school.appearance.manage'),('admin','school.teacher_records.manage'),
  ('admin','school.student_support.view'),
  ('teacher','teacher.workspace.use'),('teacher','school.places.create'),
  ('staff','school.workspace.view')
) grants(role_name,capability);

alter table public.school_capabilities enable row level security;
alter table public.school_role_capability_defaults enable row level security;
alter table public.school_member_capability_overrides enable row level security;
revoke all on public.school_capabilities,public.school_role_capability_defaults,
  public.school_member_capability_overrides from public,anon,authenticated;

create function public.get_my_school_capabilities(p_school_id uuid)
returns text[] language sql stable security definer set search_path='' as $$
  with membership as(
    select member.role from public.school_members member
    where member.school_id=p_school_id and member.profile_id=auth.uid() and member.status='active'
  ), candidates as(
    select defaults.capability,true as granted
    from membership join public.school_role_capability_defaults defaults on defaults.role=membership.role
    union all
    select override.capability,override.granted
    from public.school_member_capability_overrides override
    where override.school_id=p_school_id and override.profile_id=auth.uid()
  )
  select coalesce(array_agg(resolved.capability order by resolved.capability) filter(where resolved.granted),'{}'::text[])
  from(
    select candidate.capability,(array_agg(candidate.granted order by candidate.granted asc))[1] as granted
    from candidates candidate group by candidate.capability
  ) resolved
$$;

create function public.has_school_capability(p_school_id uuid,p_capability text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_capability=any(public.get_my_school_capabilities(p_school_id))
$$;

revoke all on function public.get_my_school_capabilities(uuid) from public,anon;
revoke all on function public.has_school_capability(uuid,text) from public,anon;
grant execute on function public.get_my_school_capabilities(uuid) to authenticated;
grant execute on function public.has_school_capability(uuid,text) to authenticated;

comment on table public.school_member_capability_overrides is
  'Explicit per-member grants or denials. Capabilities drive interactions; role remains identity context and the RLS fallback authority.';
