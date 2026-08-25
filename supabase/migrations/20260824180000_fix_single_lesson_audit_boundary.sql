-- Creating a lesson and its audit entry is one privileged transaction. The
-- function still verifies the caller's owner/admin membership before writing;
-- SECURITY DEFINER lets the audit insert remain unavailable as a direct API.
revoke insert on public.audit_log from public, anon, authenticated;

alter function public.create_single_lesson(
  uuid, uuid, uuid, uuid, uuid, timestamp without time zone, text, boolean, text
) security definer;

do $$
declare
  function_security_definer boolean;
begin
  select procedure.prosecdef
  into function_security_definer
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_single_lesson'
    and pg_get_function_identity_arguments(procedure.oid) =
      'p_school_id uuid, p_product_id uuid, p_teacher_id uuid, p_student_id uuid, p_place_id uuid, p_local_start timestamp without time zone, p_notes text, p_allow_outside_availability boolean, p_override_reason text';

  if function_security_definer is distinct from true then
    raise exception 'create_single_lesson must own its audit transaction';
  end if;

  if has_table_privilege('authenticated', 'public.audit_log', 'insert') then
    raise exception 'authenticated must not receive direct audit_log inserts';
  end if;
end;
$$;
