create or replace function public.enrich_teacher_reschedule_notification()
returns trigger language plpgsql set search_path='' as $$
declare proposal public.lesson_schedule_proposals%rowtype; teacher_name text; student_name text;
begin
  if new.entity_type<>'lesson_schedule_proposal' then return new; end if;
  select * into proposal from public.lesson_schedule_proposals where school_id=new.school_id and id=new.entity_id;
  if not found or proposal.proposal_kind<>'reschedule' or proposal.status<>'pending_owner' then return new; end if;
  select coalesce(nullif(trim(preferred_name),''),first_name)||' '||last_name into teacher_name from public.people where school_id=new.school_id and id=proposal.teacher_id;
  select coalesce(nullif(trim(preferred_name),''),first_name)||' '||last_name into student_name from public.people where school_id=new.school_id and id=proposal.student_id;
  new.title:='Reschedule proposal from '||coalesce(teacher_name,'teacher');
  new.message:=coalesce(teacher_name,'The teacher')||' proposed a new time for '||coalesce(student_name,'a student')||'. The original lesson remains scheduled until an owner decides.';
  new.href:='/schools/'||new.school_id||'/approvals?proposal='||new.entity_id;
  return new;
end $$;

update public.owner_notifications n set href='/schools/'||n.school_id||'/approvals?proposal='||n.entity_id
where n.entity_type='lesson_schedule_proposal' and exists(select 1 from public.lesson_schedule_proposals p where p.school_id=n.school_id and p.id=n.entity_id and p.proposal_kind='reschedule');

create or replace function public.resolve_linked_approval_notifications()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='pending_owner' and new.status<>'pending_owner' then
    update public.owner_notifications set
      read_at=case when recipient_profile_id=new.decided_by then coalesce(read_at,now()) else read_at end,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('approval_status',new.status,'resolved_at',new.decided_at,'resolved_by',new.decided_by)
    where school_id=new.school_id and entity_type='lesson_schedule_proposal' and entity_id=new.id;
  end if;
  return new;
end $$;
create trigger lesson_schedule_proposals_resolve_notifications after update of status on public.lesson_schedule_proposals for each row execute function public.resolve_linked_approval_notifications();
