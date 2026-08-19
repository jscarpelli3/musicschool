do $$ declare school_row record; policy_id uuid; version_id uuid;
begin
  for school_row in select school.id,school.created_by from public.schools school where school.name='ScarpsSchool' and not exists (
    select 1 from public.school_policies policy where policy.school_id=school.id and policy.kind='cancellation' and policy.status='active' and policy.is_default
  ) loop
    insert into public.school_policies(school_id,kind,name,is_default,status,created_by)
    values(school_row.id,'cancellation','Standard 24-hour cancellation policy',true,'active',school_row.created_by) returning id into policy_id;
    insert into public.school_policy_versions(school_id,policy_id,version_number,plain_text,effective_from,published_at,created_by)
    values(school_row.id,policy_id,1,'Cancellation and reschedule requests require 24 hours notice. Requests submitted inside that window may be counted as serviced.',now(),now(),school_row.created_by) returning id into version_id;
    insert into public.cancellation_policy_rules(policy_version_id,student_cancel_cutoff_hours,student_reschedule_cutoff_hours,
      timely_cancel_disposition,late_cancel_disposition,no_show_disposition,teacher_cancel_disposition,timely_request_guidance,late_request_guidance)
    values(version_id,24,24,'waive','charge','charge','credit','Requests made within the cancellation period are normally approved.',
      'This request was made outside the cancellation period. If canceled, the lesson will still be counted as a serviced lesson.');
  end loop;
end $$;
