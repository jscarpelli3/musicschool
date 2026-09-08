do $$
declare expected record; definition text;
begin
  for expected in select * from (values
    ('public.create_teacher_record(uuid,text,text,text,text[])'::regprocedure,'school.staff.directory_manage'),
    ('public.prepare_teacher_invitation(uuid,uuid,uuid,text)'::regprocedure,'school.staff.directory_manage'),
    ('public.deactivate_teacher_access(uuid,uuid)'::regprocedure,'school.staff.directory_manage'),
    ('public.set_school_instrument_catalog(uuid,text[])'::regprocedure,'school.staff.directory_manage'),
    ('public.set_teacher_scheduling_settings(uuid,uuid,text,boolean,text)'::regprocedure,'school.teacher_records.manage'),
    ('public.set_teacher_self_reschedule_permission(uuid,uuid,boolean)'::regprocedure,'school.teacher_records.manage'),
    ('public.create_outside_availability_entitlement_proposal(uuid,uuid,uuid,uuid,timestamp without time zone,text,text)'::regprocedure,'school.lessons.manage'),
    ('public.create_outside_availability_lesson_proposal(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,date,text,text)'::regprocedure,'school.lessons.manage'),
    ('public.decide_teacher_reschedule_proposal(uuid,uuid,text,text)'::regprocedure,'school.approvals.review'),
    ('public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,boolean)'::regprocedure,'school.lessons.manage'),
    ('public.submit_school_cancellation(uuid,uuid,text)'::regprocedure,'school.lessons.manage'),
    ('public.replace_teacher_weekly_availability(uuid,uuid,jsonb)'::regprocedure,'school.teacher_records.manage')
  ) checks(signature,capability)
  loop
    definition:=pg_get_functiondef(expected.signature);
    if position(format('has_school_capability(p_school_id,%L',expected.capability) in definition)=0 then
      raise exception 'mixed_capability_authority_missing: %',expected.signature;
    end if;
  end loop;

  if exists(
    select 1 from pg_policies
    where schemaname='public' and tablename in('lesson_schedule_proposals','lesson_proposal_email_outbox')
      and (coalesce(qual,'')||coalesce(with_check,'')) ~ 'has_school_role.*owner.*admin'
  ) then raise exception 'legacy_schedule_proposal_policy_authority_remaining'; end if;
end
$$;
