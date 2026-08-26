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
  new.href:='/schools/'||new.school_id||'/notifications?proposal='||new.entity_id;
  return new;
end $$;

create trigger owner_notifications_enrich_teacher_reschedule
before insert on public.owner_notifications for each row execute function public.enrich_teacher_reschedule_notification();

update public.owner_notifications n set
  title='Reschedule proposal from '||coalesce(names.teacher_name,'teacher'),
  message=coalesce(names.teacher_name,'The teacher')||' proposed a new time for '||coalesce(names.student_name,'a student')||'. The original lesson remains scheduled until an owner decides.',
  href='/schools/'||n.school_id||'/notifications?proposal='||n.entity_id
from (
  select p.id,p.school_id,
    coalesce(nullif(trim(tp.preferred_name),''),tp.first_name)||' '||tp.last_name teacher_name,
    coalesce(nullif(trim(sp.preferred_name),''),sp.first_name)||' '||sp.last_name student_name
  from public.lesson_schedule_proposals p
  join public.people tp on tp.school_id=p.school_id and tp.id=p.teacher_id
  join public.people sp on sp.school_id=p.school_id and sp.id=p.student_id
  where p.proposal_kind='reschedule' and p.status='pending_owner'
) names where n.school_id=names.school_id and n.entity_id=names.id and n.entity_type='lesson_schedule_proposal';
