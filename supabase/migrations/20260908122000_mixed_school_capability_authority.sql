create or replace function public.rewrite_school_authority_gate(
  p_function regprocedure,p_capability text,p_roles text default 'owner_admin'
) returns void language plpgsql security definer set search_path='' as $$
declare definition text; rewritten text; pattern text;
begin
  select pg_get_functiondef(p_function) into definition;
  if p_roles='owner' then
    pattern:='public\.has_school_role\(p_school_id,\s*array\[''owner''\]\)';
  elsif p_roles='owner_admin' then
    pattern:='public\.has_school_role\(p_school_id,\s*array\[''owner''\s*,\s*''admin''\]\)';
  else
    raise exception 'unknown_role_gate_kind: %',p_roles;
  end if;
  rewritten:=regexp_replace(definition,pattern,
    format('public.has_school_capability(p_school_id,%L)',p_capability),'gi');
  if rewritten=definition then raise exception 'capability_function_rewrite_missed: %',p_function; end if;
  execute rewritten;
end
$$;

select public.rewrite_school_authority_gate(
  'public.create_teacher_record(uuid,text,text,text,text[])'::regprocedure,
  'school.staff.directory_manage','owner');
select public.rewrite_school_authority_gate(
  'public.prepare_teacher_invitation(uuid,uuid,uuid,text)'::regprocedure,
  'school.staff.directory_manage','owner');
select public.rewrite_school_authority_gate(
  'public.deactivate_teacher_access(uuid,uuid)'::regprocedure,
  'school.staff.directory_manage','owner');
select public.rewrite_school_authority_gate(
  'public.set_school_instrument_catalog(uuid,text[])'::regprocedure,
  'school.staff.directory_manage','owner');
select public.rewrite_school_authority_gate(
  'public.set_teacher_scheduling_settings(uuid,uuid,text,boolean,text)'::regprocedure,
  'school.teacher_records.manage','owner');
select public.rewrite_school_authority_gate(
  'public.set_teacher_self_reschedule_permission(uuid,uuid,boolean)'::regprocedure,
  'school.teacher_records.manage','owner');
select public.rewrite_school_authority_gate(
  'public.create_outside_availability_entitlement_proposal(uuid,uuid,uuid,uuid,timestamp without time zone,text,text)'::regprocedure,
  'school.lessons.manage');
select public.rewrite_school_authority_gate(
  'public.decide_teacher_reschedule_proposal(uuid,uuid,text,text)'::regprocedure,
  'school.approvals.review');

drop function public.rewrite_school_authority_gate(regprocedure,text,text);

-- These wrappers retain the actor's role as audit context, but capability is
-- the authorization decision. Removing the role filter does not broaden access
-- because the following predicate fails closed before the private core is called.
do $$
declare target record; definition text; rewritten text;
begin
  for target in select * from (values
    ('public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,boolean)'::regprocedure,'school.lessons.manage'),
    ('public.submit_school_cancellation(uuid,uuid,text)'::regprocedure,'school.lessons.manage')
  ) mapping(signature,capability)
  loop
    select pg_get_functiondef(target.signature) into definition;
    rewritten:=regexp_replace(definition,
      '\s+and member\.role in \(''owner'',''admin''\)', '', 'gi');
    rewritten:=regexp_replace(rewritten,
      'actor_id is null or actor_role is null',
      format('actor_id is null or not public.has_school_capability(p_school_id,%L)',target.capability),'gi');
    if rewritten=definition or rewritten like '%member.role in (''owner'',''admin'')%' then
      raise exception 'mixed_capability_function_rewrite_missed: %',target.signature;
    end if;
    execute rewritten;
  end loop;
end
$$;
