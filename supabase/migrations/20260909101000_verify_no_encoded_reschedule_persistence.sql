do $$
declare definition text;
begin
  definition:=pg_get_functiondef('public.normalize_reschedule_reason()'::regprocedure)
    ||pg_get_functiondef('public.reschedule_lesson_as_owner_v2(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,text,boolean)'::regprocedure)
    ||pg_get_functiondef('public.propose_or_reschedule_assigned_lesson_as_teacher_v2(uuid,uuid,timestamp without time zone,text,text)'::regprocedure);
  if definition like '%split_part%'
    or definition like '%position(''::''%'
    or definition like '%p_reason_code||''::''%'
  then raise exception 'encoded_reschedule_persistence_remaining'; end if;
end
$$;
