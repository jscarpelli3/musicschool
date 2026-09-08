do $$
declare definition text; rewritten text;
begin
  select pg_get_functiondef(
    'public.create_outside_availability_lesson_proposal(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,date,text,text)'::regprocedure
  ) into definition;
  rewritten:=regexp_replace(definition,
    'public\.has_school_role\(p_school_id,\s*array\[''owner''\s*,\s*''admin''\]\)',
    'public.has_school_capability(p_school_id,''school.lessons.manage'')','gi');
  if rewritten=definition then raise exception 'outside_availability_capability_rewrite_missed'; end if;
  execute rewritten;

  select pg_get_functiondef(
    'public.replace_teacher_weekly_availability(uuid,uuid,jsonb)'::regprocedure
  ) into definition;
  rewritten:=regexp_replace(definition,
    'coalesce\(actor_school_role in \(''owner'',''admin''\),false\)',
    'public.has_school_capability(p_school_id,''school.teacher_records.manage'')','gi');
  if rewritten=definition then raise exception 'availability_capability_rewrite_missed'; end if;
  execute rewritten;
end
$$;

drop policy if exists lesson_schedule_proposals_management_select on public.lesson_schedule_proposals;
create policy lesson_schedule_proposals_management_select
on public.lesson_schedule_proposals for select to authenticated using(
  public.has_school_capability(school_id,'school.approvals.review')
  or exists(
    select 1 from public.people person
    where person.school_id=lesson_schedule_proposals.school_id
      and person.id=lesson_schedule_proposals.teacher_id
      and person.profile_id=auth.uid()
      and person.status='active'
  )
);

drop policy if exists lesson_proposal_email_owner_select on public.lesson_proposal_email_outbox;
create policy lesson_proposal_email_owner_select
on public.lesson_proposal_email_outbox for select to authenticated
using(public.has_school_capability(school_id,'school.approvals.review'));
