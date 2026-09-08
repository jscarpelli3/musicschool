do $$
begin
  if has_function_privilege('authenticated',
    'public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,boolean)','execute')
    or has_function_privilege('authenticated',
    'public.propose_or_reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp without time zone,text)','execute')
  then raise exception 'legacy_encoded_reschedule_rpc_is_still_public'; end if;

  if not has_function_privilege('authenticated',
    'public.reschedule_lesson_as_owner_v2(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,text,boolean)','execute')
    or not has_function_privilege('authenticated',
    'public.propose_or_reschedule_assigned_lesson_as_teacher_v2(uuid,uuid,timestamp without time zone,text,text)','execute')
  then raise exception 'structured_reschedule_rpc_is_not_public'; end if;
end
$$;
