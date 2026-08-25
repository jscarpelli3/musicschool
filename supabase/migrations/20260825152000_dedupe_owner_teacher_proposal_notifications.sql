update public.owner_notifications notification
set href='/schools/'||notification.school_id||'/teacher#lesson-proposals'
where notification.entity_type='lesson_schedule_proposal'
  and exists(
    select 1 from public.lesson_schedule_proposals proposal
    join public.people person on person.school_id=proposal.school_id and person.id=proposal.teacher_id
    where proposal.school_id=notification.school_id and proposal.id=notification.entity_id
      and person.profile_id=notification.recipient_profile_id
  );

create or replace function public.queue_owner_lesson_proposal_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record; proposal public.lesson_schedule_proposals%rowtype; title_text text; message_text text; teacher_profile_id uuid;
begin
 if new.event_type not in('lesson_schedule_proposal.created','lesson_schedule_proposal.declined') then return new; end if;
 select * into proposal from public.lesson_schedule_proposals where school_id=new.school_id and id=new.entity_id;
 select profile_id into teacher_profile_id from public.people where school_id=new.school_id and id=proposal.teacher_id;
 title_text:=case when new.event_type='lesson_schedule_proposal.created' then 'Teacher approval requested' else 'Teacher declined proposed lesson' end;
 message_text:=case when new.event_type='lesson_schedule_proposal.created' then 'The outside-hours lesson is pending and has not been added to the calendar.' else 'The proposed outside-hours lesson was declined and was not added to the calendar.' end;
 for recipient in select profile_id from public.school_members where school_id=new.school_id and status='active' and role in('owner','admin') and profile_id is distinct from teacher_profile_id loop
  insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
  values(new.school_id,recipient.profile_id,'lesson_created',title_text,message_text,'/schools/'||new.school_id,'proposal-state:'||new.event_type||':'||new.entity_id,'lesson_schedule_proposal',new.entity_id,jsonb_build_object('teacher_id',proposal.teacher_id,'status',proposal.status,'starts_at',proposal.proposed_starts_at)) on conflict(recipient_profile_id,dedupe_key) do nothing;
 end loop;
 return new;
end $$;
revoke all on function public.queue_owner_lesson_proposal_notification() from public,anon,authenticated;
