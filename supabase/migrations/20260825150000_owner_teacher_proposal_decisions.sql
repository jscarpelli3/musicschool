create or replace function public.can_decide_teacher_proposal(p_school_id uuid,p_teacher_id uuid,p_profile_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.people person
  join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id
  join public.school_members member on member.school_id=person.school_id and member.profile_id=person.profile_id and member.status='active'
  where person.school_id=p_school_id and person.id=p_teacher_id and person.profile_id=p_profile_id and person.status='active'
    and member.role in('teacher','owner','admin')
 );
$$;
revoke all on function public.can_decide_teacher_proposal(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.decide_outside_availability_lesson_proposal(p_school_id uuid,p_proposal_id uuid,p_decision text,p_note text default null)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); proposal public.lesson_schedule_proposals%rowtype; event_id uuid; series_id uuid; occurrence_date date; occurrence_start timestamptz; occurrence_end timestamptz; product public.service_products%rowtype; school public.schools%rowtype;
begin
 if actor is null or p_decision not in('accept','decline') or length(coalesce(trim(p_note),''))>500 then raise exception 'invalid_decision'; end if;
 select * into proposal from public.lesson_schedule_proposals where school_id=p_school_id and id=p_proposal_id for update;
 if not found then raise exception 'proposal_not_found'; end if;
 if not public.can_decide_teacher_proposal(p_school_id,proposal.teacher_id,actor) then raise exception 'not_authorized'; end if;
 if proposal.status<>'pending_teacher' then return proposal.status; end if;
 if p_decision='decline' then update public.lesson_schedule_proposals set status='declined',decided_by=actor,decided_at=now(),decision_note=nullif(trim(p_note),''),updated_at=now() where id=proposal.id; insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload) values(p_school_id,'lesson_schedule_proposal.declined','lesson_schedule_proposal',proposal.id,actor,'teacher','teacher_schedule',jsonb_build_object('note',nullif(trim(p_note),''))); return 'declined'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_school_id::text,0));
 if exists(select 1 from public.lesson_events e where e.school_id=p_school_id and e.teacher_id=proposal.teacher_id and e.status not in('cancelled','rescheduled') and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(proposal.proposed_starts_at,proposal.proposed_ends_at,'[)')) then raise exception 'teacher_conflict'; end if;
 if exists(select 1 from public.lesson_events e where e.school_id=p_school_id and e.student_id=proposal.student_id and e.status not in('cancelled','rescheduled') and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(proposal.proposed_starts_at,proposal.proposed_ends_at,'[)')) then raise exception 'student_conflict'; end if;
 if proposal.schedule_type='weekly' then
  select * into product from public.service_products where school_id=p_school_id and id=proposal.product_id and status='active'; select * into school from public.schools where id=p_school_id;
  for occurrence_date in select generate_series(proposal.proposed_local_start::date,proposal.ends_on,interval '7 days')::date loop occurrence_start:=(occurrence_date+proposal.proposed_local_start::time) at time zone school.timezone; occurrence_end:=(occurrence_date+proposal.proposed_local_start::time+make_interval(mins=>product.duration_minutes)) at time zone school.timezone; if exists(select 1 from public.lesson_events e where e.school_id=p_school_id and e.status not in('cancelled','rescheduled') and (e.teacher_id=proposal.teacher_id or e.student_id=proposal.student_id) and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(occurrence_start,occurrence_end,'[)')) then raise exception 'series_conflict'; end if; end loop;
  insert into public.lesson_series(school_id,product_id,teacher_id,student_id,default_place_id,recurrence_rule,starts_on,ends_on,status,created_by) values(p_school_id,proposal.product_id,proposal.teacher_id,proposal.student_id,proposal.place_id,jsonb_build_object('frequency','weekly','interval',1,'weekday',extract(dow from proposal.proposed_local_start)::int,'local_time',to_char(proposal.proposed_local_start::time,'HH24:MI')),proposal.proposed_local_start::date,proposal.ends_on,'active',proposal.created_by) returning id into series_id;
  insert into public.lesson_series_billing_terms(school_id,lesson_series_id,source_product_id,billing_mode,billing_timing,amount_cents,currency,offering_name,effective_from,effective_until,created_by) values(p_school_id,series_id,product.id,product.pricing_model,coalesce(product.billing_timing_override,school.billing_timing_default),product.price_cents,product.currency,product.name,proposal.proposed_local_start::date,proposal.ends_on,proposal.created_by);
  for occurrence_date in select generate_series(proposal.proposed_local_start::date,proposal.ends_on,interval '7 days')::date loop occurrence_start:=(occurrence_date+proposal.proposed_local_start::time) at time zone school.timezone; occurrence_end:=(occurrence_date+proposal.proposed_local_start::time+make_interval(mins=>product.duration_minutes)) at time zone school.timezone; insert into public.lesson_events(school_id,product_id,teacher_id,student_id,place_id,starts_at,ends_at,status,notes,lesson_series_id,is_series_exception,created_by) values(p_school_id,proposal.product_id,proposal.teacher_id,proposal.student_id,proposal.place_id,occurrence_start,occurrence_end,'scheduled',proposal.notes,series_id,false,proposal.created_by); end loop;
  update public.lesson_schedule_proposals set status='applied',decided_by=actor,decided_at=now(),applied_entity_type='lesson_series',applied_entity_id=series_id,updated_at=now() where id=proposal.id; insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor,'lesson_series.created','lesson_series',series_id,jsonb_build_object('teacher_approved',true,'proposal_id',proposal.id)); return 'applied';
 end if;
 insert into public.lesson_events(school_id,product_id,teacher_id,student_id,place_id,starts_at,ends_at,status,notes,is_series_exception,exception_reason,created_by) values(p_school_id,proposal.product_id,proposal.teacher_id,proposal.student_id,proposal.place_id,proposal.proposed_starts_at,proposal.proposed_ends_at,'scheduled',proposal.notes,true,'Outside availability approved by teacher: '||proposal.reason,proposal.created_by) returning id into event_id;
 update public.lesson_schedule_proposals set status='applied',decided_by=actor,decided_at=now(),applied_entity_type='lesson_event',applied_entity_id=event_id,updated_at=now() where id=proposal.id; insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor,'lesson.created','lesson_event',event_id,jsonb_build_object('teacher_approved',true,'proposal_id',proposal.id)); return 'applied';
end $$;
revoke all on function public.decide_outside_availability_lesson_proposal(uuid,uuid,text,text) from public,anon;
grant execute on function public.decide_outside_availability_lesson_proposal(uuid,uuid,text,text) to authenticated;
