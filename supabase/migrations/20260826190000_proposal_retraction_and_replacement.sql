alter table public.lesson_schedule_proposals drop constraint lesson_schedule_proposals_status_check;
alter table public.lesson_schedule_proposals add constraint lesson_schedule_proposals_status_check
  check (status in ('pending_teacher','pending_owner','accepted','declined','withdrawn','superseded','expired','applied','failed'));
alter table public.lesson_schedule_proposals
  add column replaces_proposal_id uuid references public.lesson_schedule_proposals(id),
  add column superseded_by_proposal_id uuid references public.lesson_schedule_proposals(id);

create or replace function public.manage_own_lesson_schedule_proposal(p_school_id uuid,p_proposal_id uuid,p_action text,p_local_start timestamp default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old public.lesson_schedule_proposals%rowtype; replacement_id uuid; tz text; starts timestamptz; finishes timestamptz; duration interval; recipient uuid; recipient_email text; owner_row record;
begin
 if actor is null or p_action not in('withdraw','replace') then raise exception 'invalid_request'; end if;
 select * into old from public.lesson_schedule_proposals where school_id=p_school_id and id=p_proposal_id for update;
 if not found or old.created_by<>actor then raise exception 'not_authorized'; end if;
 if old.status not in('pending_teacher','pending_owner') then
   return jsonb_build_object('outcome','stale','status',old.status,'replacement_id',old.superseded_by_proposal_id);
 end if;
 if p_action='withdraw' then
   update public.lesson_schedule_proposals set status='withdrawn',decided_by=actor,decided_at=now(),updated_at=now() where id=old.id;
   update public.owner_notifications set archived_at=coalesce(archived_at,now()),read_at=coalesce(read_at,now()),resolved_at=coalesce(resolved_at,now()),metadata=coalesce(metadata,'{}')||jsonb_build_object('approval_status','withdrawn') where school_id=p_school_id and entity_type='lesson_schedule_proposal' and entity_id=old.id;
   if old.status='pending_teacher' then
     select lower(trim(p.email)) into recipient_email from public.people p where p.school_id=p_school_id and p.id=old.teacher_id and p.status='active';
     insert into public.lesson_proposal_email_outbox(school_id,proposal_id,recipient_email,subject,message_text,idempotency_key) values(p_school_id,old.id,recipient_email,'Lesson proposal withdrawn','The proposed lesson was withdrawn. No lesson was added to your calendar and no action is needed.','lesson-proposal-withdrawn/'||old.id);
   end if;
   insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload) values(p_school_id,'lesson_schedule_proposal.withdrawn','lesson_schedule_proposal',old.id,actor,'proposer','calendar',jsonb_build_object('previous_status',old.status));
   return jsonb_build_object('outcome','withdrawn','proposal_id',old.id);
 end if;
 if p_local_start is null or nullif(trim(p_reason),'') is null or length(trim(p_reason))>500 then raise exception 'invalid_replacement'; end if;
 select timezone into tz from public.schools where id=p_school_id; duration:=old.proposed_ends_at-old.proposed_starts_at; starts:=p_local_start at time zone tz; finishes:=starts+duration;
 if starts<=now() then raise exception 'new_lesson_time_must_be_future'; end if;
 insert into public.lesson_schedule_proposals(school_id,teacher_id,student_id,product_id,place_id,schedule_type,proposed_local_start,proposed_starts_at,proposed_ends_at,ends_on,notes,reason,status,created_by,lesson_event_id,proposal_kind,replaces_proposal_id)
 values(old.school_id,old.teacher_id,old.student_id,old.product_id,old.place_id,old.schedule_type,p_local_start,starts,finishes,case when old.schedule_type='weekly' then old.ends_on else p_local_start::date end,old.notes,trim(p_reason),old.status,actor,old.lesson_event_id,old.proposal_kind,old.id) returning id into replacement_id;
 update public.lesson_schedule_proposals set status='superseded',superseded_by_proposal_id=replacement_id,decided_by=actor,decided_at=now(),updated_at=now() where id=old.id;
 update public.owner_notifications set archived_at=coalesce(archived_at,now()),read_at=coalesce(read_at,now()),resolved_at=coalesce(resolved_at,now()),metadata=coalesce(metadata,'{}')||jsonb_build_object('approval_status','superseded','replacement_id',replacement_id) where school_id=p_school_id and entity_type='lesson_schedule_proposal' and entity_id=old.id;
 if old.status='pending_teacher' then
   select p.profile_id,lower(trim(p.email)) into recipient,recipient_email from public.people p where p.school_id=p_school_id and p.id=old.teacher_id and p.status='active';
   insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata) values(p_school_id,recipient,'lesson_created','Lesson proposal updated','The proposed lesson time changed. Review the replacement before it is added to your calendar.','/schools/'||p_school_id||'/teacher','lesson-proposal:'||replacement_id,'lesson_schedule_proposal',replacement_id,jsonb_build_object('requires_approval',true,'starts_at',starts,'replaces',old.id));
   insert into public.lesson_proposal_email_outbox(school_id,proposal_id,recipient_email,subject,message_text,idempotency_key) values(p_school_id,replacement_id,recipient_email,'Lesson proposal updated','A proposed lesson time changed. Sign in to Common Time to review the replacement.','lesson-proposal-replaced/'||replacement_id);
 else
   for owner_row in select profile_id from public.school_members where school_id=p_school_id and status='active' and role in('owner','admin') loop
     insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata) values(p_school_id,owner_row.profile_id,'lesson_created','Teacher updated a proposed lesson time','The previous proposal was withdrawn and replaced. The original lesson remains scheduled.','/schools/'||p_school_id||'/approvals?proposal='||replacement_id,'teacher-reschedule-proposal:'||replacement_id,'lesson_schedule_proposal',replacement_id,jsonb_build_object('proposed_starts_at',starts,'replaces',old.id));
   end loop;
 end if;
 insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload) values(p_school_id,'lesson_schedule_proposal.replaced','lesson_schedule_proposal',replacement_id,actor,'proposer','calendar',jsonb_build_object('replaces_proposal_id',old.id,'starts_at',starts));
 return jsonb_build_object('outcome','replaced','proposal_id',replacement_id);
end $$;
revoke all on function public.manage_own_lesson_schedule_proposal(uuid,uuid,text,timestamp,text) from public,anon;
grant execute on function public.manage_own_lesson_schedule_proposal(uuid,uuid,text,timestamp,text) to authenticated;
