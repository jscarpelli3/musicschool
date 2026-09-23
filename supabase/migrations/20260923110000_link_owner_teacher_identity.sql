-- An owner or admin may also teach. Keep their authoritative school membership
-- role intact while linking their existing identity to a teacher person record.
create function public.link_current_manager_teacher_identity(
  p_school_id uuid,
  p_teacher_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := auth.uid();
  clean_email text := lower(trim(p_email));
  linked_person_id uuid;
  final_teacher_id uuid := p_teacher_id;
begin
  if actor_id is null
    or not public.has_school_role(p_school_id, array['owner','admin']) then
    raise exception 'not_authorized';
  end if;
  if clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or lower(trim(coalesce(auth.jwt()->>'email',''))) <> clean_email then
    raise exception 'not_current_identity';
  end if;
  if not exists(
    select 1
    from public.people person
    join public.teachers teacher
      on teacher.school_id=person.school_id and teacher.person_id=person.id
    where person.school_id=p_school_id and person.id=p_teacher_id
      and lower(trim(person.email))=clean_email and person.status='active'
  ) then
    raise exception 'teacher_not_found';
  end if;
  select id into linked_person_id from public.people
  where school_id=p_school_id and profile_id=actor_id;

  if linked_person_id is null or linked_person_id=p_teacher_id then
    update public.people
    set profile_id=actor_id, email=clean_email
    where school_id=p_school_id and id=p_teacher_id
      and (profile_id is null or profile_id=actor_id);
    if not found then raise exception 'teacher_link_conflict'; end if;
  else
    -- The owner may already be represented as a payer/contact. Reuse that
    -- person instead of creating two profile-linked identities in one school.
    insert into public.teachers(school_id,person_id,default_lesson_minutes)
    select school_id,linked_person_id,default_lesson_minutes
    from public.teachers where school_id=p_school_id and person_id=p_teacher_id
    on conflict(school_id,person_id) do nothing;
    insert into public.teacher_instruments(school_id,teacher_id,instrument_id)
    select school_id,linked_person_id,instrument_id
    from public.teacher_instruments where school_id=p_school_id and teacher_id=p_teacher_id
    on conflict(school_id,teacher_id,instrument_id) do nothing;
    delete from public.teachers where school_id=p_school_id and person_id=p_teacher_id;
    delete from public.people where school_id=p_school_id and id=p_teacher_id and profile_id is null;
    if found then final_teacher_id := linked_person_id;
    else raise exception 'teacher_link_conflict'; end if;
  end if;

  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'teacher.manager_identity_linked','teacher',final_teacher_id,
    jsonb_build_object('membership_role_preserved',(
      select role from public.school_members
      where school_id=p_school_id and profile_id=actor_id and status='active'
    )));
end;
$$;

revoke all on function public.link_current_manager_teacher_identity(uuid,uuid,text) from public,anon;
grant execute on function public.link_current_manager_teacher_identity(uuid,uuid,text) to authenticated;

do $$
declare signature regprocedure := 'public.link_current_manager_teacher_identity(uuid,uuid,text)'::regprocedure;
begin
  if has_function_privilege('anon',signature,'execute')
    or has_function_privilege('public',signature,'execute')
    or not has_function_privilege('authenticated',signature,'execute')
    or position('has_school_role' in pg_get_functiondef(signature))=0
    or position('auth.jwt' in pg_get_functiondef(signature))=0 then
    raise exception 'manager_teacher_identity_boundary_incorrect';
  end if;
end;
$$;
