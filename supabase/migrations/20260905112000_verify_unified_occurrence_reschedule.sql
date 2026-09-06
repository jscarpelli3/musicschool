do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.reschedule_lesson_occurrence_core(uuid,uuid,uuid,uuid,timestamp without time zone,text,uuid,text,text,text,boolean,boolean,text)',
    'EXECUTE'
  ) then raise exception 'authenticated_can_execute_private_reschedule_core'; end if;

  if position(
    'reschedule_lesson_occurrence_core' in
    pg_get_functiondef('public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,boolean)'::regprocedure)
  )=0 then raise exception 'owner_reschedule_does_not_delegate_to_core'; end if;

  if position(
    'reschedule_lesson_occurrence_core' in
    pg_get_functiondef('public.propose_or_reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp without time zone,text)'::regprocedure)
  )=0 then raise exception 'teacher_reschedule_does_not_delegate_to_core'; end if;

  if position(
    'teacher_schedule' in
    pg_get_constraintdef((select constraint_row.oid from pg_catalog.pg_constraint constraint_row
      where constraint_row.conrelid='public.lesson_event_changes'::regclass
        and constraint_row.conname='lesson_event_changes_source_check'))
  )=0 then raise exception 'teacher_schedule_history_channel_missing'; end if;
end $$;
