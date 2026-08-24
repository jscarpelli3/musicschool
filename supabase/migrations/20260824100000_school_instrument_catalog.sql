create table public.school_instruments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  normalized_name text generated always as (lower(trim(name))) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, normalized_name),
  unique (school_id, id)
);

create table public.teacher_instruments (
  school_id uuid not null,
  teacher_id uuid not null,
  instrument_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (school_id, teacher_id, instrument_id),
  foreign key (school_id, teacher_id) references public.teachers(school_id, person_id) on delete cascade,
  foreign key (school_id, instrument_id) references public.school_instruments(school_id, id) on delete cascade
);

alter table public.school_instruments enable row level security;
alter table public.teacher_instruments enable row level security;

create policy school_instruments_member_select on public.school_instruments
for select to authenticated using (public.has_school_role(school_id, array['owner','admin','teacher']));
create policy teacher_instruments_member_select on public.teacher_instruments
for select to authenticated using (
  public.has_school_role(school_id, array['owner','admin'])
  or exists (
    select 1 from public.people person
    where person.school_id=teacher_instruments.school_id
      and person.id=teacher_instruments.teacher_id
      and person.profile_id=auth.uid()
  )
);

grant select on public.school_instruments, public.teacher_instruments to authenticated;
revoke insert, update, delete on public.school_instruments, public.teacher_instruments from authenticated;

create or replace function public.set_school_instrument_catalog(p_school_id uuid, p_names text[])
returns void language plpgsql security definer set search_path='' as $$
declare actor_id uuid := auth.uid(); clean_names text[];
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner']) then raise exception 'not_authorized'; end if;
  select coalesce(array_agg(display_name order by display_name), '{}') into clean_names
  from (
    select min(trim(raw_name)) as display_name
    from unnest(coalesce(p_names, '{}')) raw_name
    where length(trim(raw_name)) between 1 and 80
    group by lower(trim(raw_name))
  ) names;
  if cardinality(clean_names) > 40 then raise exception 'too_many_instruments'; end if;

  update public.school_instruments set is_active=false, updated_at=now()
  where school_id=p_school_id and normalized_name <> all(select lower(value) from unnest(clean_names) value);
  insert into public.school_instruments(school_id,name,is_active)
  select p_school_id,value,true from unnest(clean_names) value
  on conflict(school_id,normalized_name) do update set name=excluded.name,is_active=true,updated_at=now();

  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'school.instrument_catalog_updated','school',p_school_id,jsonb_build_object('instruments',clean_names));
end $$;

drop function if exists public.create_teacher_record(uuid,text,text,text,integer);
create function public.create_teacher_record(
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_instrument_names text[] default '{}'
)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); teacher_id uuid; clean_email text:=lower(trim(p_email)); instrument_count integer;
begin
  if actor_id is null or not public.has_school_role(p_school_id,array['owner']) then raise exception 'not_authorized'; end if;
  if length(trim(p_first_name)) not between 1 and 80 or length(trim(p_last_name)) not between 1 and 80 then raise exception 'invalid_teacher_name'; end if;
  if clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(clean_email)>320 then raise exception 'invalid_email'; end if;
  if exists(select 1 from public.people person join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id where person.school_id=p_school_id and lower(trim(person.email))=clean_email) then raise exception 'duplicate_teacher_email'; end if;
  select count(distinct lower(trim(value))) into instrument_count from unnest(coalesce(p_instrument_names,'{}')) value where trim(value)<>'';
  if instrument_count=0 then raise exception 'teacher_instrument_required'; end if;
  if exists(
    select 1 from unnest(p_instrument_names) requested
    where not exists(select 1 from public.school_instruments catalog where catalog.school_id=p_school_id and catalog.is_active and catalog.normalized_name=lower(trim(requested)))
  ) then raise exception 'invalid_teacher_instrument'; end if;

  insert into public.people(school_id,first_name,last_name,email) values(p_school_id,trim(p_first_name),trim(p_last_name),clean_email) returning id into teacher_id;
  insert into public.teachers(school_id,person_id,default_lesson_minutes) values(p_school_id,teacher_id,30);
  insert into public.teacher_instruments(school_id,teacher_id,instrument_id)
  select p_school_id,teacher_id,catalog.id from public.school_instruments catalog
  where catalog.school_id=p_school_id and catalog.is_active and catalog.normalized_name=any(select lower(trim(value)) from unnest(p_instrument_names) value);
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'teacher.created','teacher',teacher_id,jsonb_build_object('instruments',p_instrument_names));
  return teacher_id;
end $$;

revoke all on function public.set_school_instrument_catalog(uuid,text[]) from public,anon;
revoke all on function public.create_teacher_record(uuid,text,text,text,text[]) from public,anon;
grant execute on function public.set_school_instrument_catalog(uuid,text[]) to authenticated;
grant execute on function public.create_teacher_record(uuid,text,text,text,text[]) to authenticated;
