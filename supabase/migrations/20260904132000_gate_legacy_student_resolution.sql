-- Preserve the proven family transaction as a compatibility implementation,
-- but prevent any other scenario from entering its student-specific writes.
alter function public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text)
  rename to resolve_owner_student_lesson_change_request;

revoke all on function public.resolve_owner_student_lesson_change_request(uuid,uuid,text,text,text,integer,text)
  from public,anon,authenticated;

create function public.resolve_owner_lesson_change_request(
  p_school_id uuid,p_request_id uuid,p_decision text,p_lesson_resolution text,
  p_adjustment_kind text,p_adjustment_amount_cents integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_role text; request_scenario text;
begin
  select member.role into actor_role
  from public.school_members member
  where member.school_id=p_school_id and member.profile_id=actor_id and member.status='active';
  if actor_id is null or actor_role not in ('owner','admin') then raise exception 'not_authorized'; end if;

  select request.scenario into request_scenario
  from public.lesson_change_requests request
  where request.school_id=p_school_id and request.id=p_request_id;
  if not found then raise exception 'request_not_found'; end if;
  if request_scenario not in ('student_cancellation','student_reschedule') then
    raise exception 'scenario_resolution_not_supported';
  end if;

  return public.resolve_owner_student_lesson_change_request(
    p_school_id,p_request_id,p_decision,p_lesson_resolution,
    p_adjustment_kind,p_adjustment_amount_cents,p_reason
  );
end $$;

revoke all on function public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text)
  from public,anon;
grant execute on function public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text)
  to authenticated;

comment on function public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text) is
  'Compatibility gate for the student-only resolver. Non-student scenarios fail closed until handled by the canonical scenario-driven transaction.';

do $$
declare definition text;
begin
  select pg_get_functiondef('public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text)'::regprocedure)
    into definition;
  if definition not like '%scenario_resolution_not_supported%' then
    raise exception 'student resolution scenario gate missing';
  end if;
end $$;
