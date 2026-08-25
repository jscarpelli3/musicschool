update public.owner_notifications
set href=href||'#lesson-proposals'
where entity_type='lesson_schedule_proposal' and href like '%/teacher' and href not like '%#lesson-proposals';

create or replace function public.anchor_teacher_proposal_notification()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.entity_type='lesson_schedule_proposal' and new.href like '%/teacher' and new.href not like '%#lesson-proposals' then new.href:=new.href||'#lesson-proposals'; end if;
 return new;
end $$;
create trigger owner_notifications_anchor_teacher_proposal before insert on public.owner_notifications for each row execute function public.anchor_teacher_proposal_notification();
revoke all on function public.anchor_teacher_proposal_notification() from public,anon,authenticated;
