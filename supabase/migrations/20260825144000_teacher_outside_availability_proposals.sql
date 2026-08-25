create table public.lesson_schedule_proposals (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
 teacher_id uuid not null, student_id uuid not null, product_id uuid not null, place_id uuid not null,
 schedule_type text not null check(schedule_type in('one_time','weekly')), proposed_local_start timestamp not null,
 proposed_starts_at timestamptz not null, proposed_ends_at timestamptz not null, ends_on date, notes text, reason text not null,
 status text not null default 'pending_teacher' check(status in('pending_teacher','accepted','declined','withdrawn','expired','applied','failed')),
 created_by uuid not null references public.profiles(id), decided_by uuid references public.profiles(id), decided_at timestamptz,
 decision_note text, applied_entity_type text, applied_entity_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(school_id,teacher_id) references public.teachers(school_id,person_id),
 foreign key(school_id,student_id) references public.students(school_id,person_id),
 foreign key(school_id,product_id) references public.service_products(school_id,id),
 foreign key(school_id,place_id) references public.lesson_places(school_id,id)
);
create index lesson_schedule_proposals_teacher_pending on public.lesson_schedule_proposals(school_id,teacher_id,created_at desc) where status='pending_teacher';
create table public.lesson_proposal_email_outbox(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),proposal_id uuid not null references public.lesson_schedule_proposals(id),recipient_email text not null,subject text not null,message_text text not null,idempotency_key text not null unique,status text not null default 'pending' check(status in('pending','accepted','failed')),provider_email_id text unique,provider_error_code text,provider_error_message text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.lesson_proposal_email_outbox enable row level security;
create policy lesson_proposal_email_owner_select on public.lesson_proposal_email_outbox for select to authenticated using(public.has_school_role(school_id,array['owner','admin']));
grant select on public.lesson_proposal_email_outbox to authenticated; revoke insert,update,delete on public.lesson_proposal_email_outbox from public,anon,authenticated;
alter table public.lesson_schedule_proposals enable row level security;
create policy lesson_schedule_proposals_management_select on public.lesson_schedule_proposals for select to authenticated using(
 public.has_school_role(school_id,array['owner','admin']) or exists(select 1 from public.people p where p.school_id=school_id and p.id=teacher_id and p.profile_id=auth.uid() and p.status='active')
);
grant select on public.lesson_schedule_proposals to authenticated;
revoke insert,update,delete on public.lesson_schedule_proposals from public,anon,authenticated;

create or replace function public.create_outside_availability_lesson_proposal(p_school_id uuid,p_product_id uuid,p_teacher_id uuid,p_student_id uuid,p_place_id uuid,p_local_start timestamp,p_schedule_type text,p_ends_on date,p_notes text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); tz text; duration integer; proposal_id uuid; starts timestamptz; finishes timestamptz; teacher_profile uuid; teacher_email text; student_name text;
begin
 if actor is null or not public.has_school_role(p_school_id,array['owner','admin']) then raise exception 'not_authorized'; end if;
 if p_schedule_type not in('one_time','weekly') or nullif(trim(p_reason),'') is null or length(trim(p_reason))>240 then raise exception 'invalid_proposal'; end if;
 select s.timezone,p.duration_minutes into tz,duration from public.schools s join public.service_products p on p.school_id=s.id and p.id=p_product_id and p.status='active' where s.id=p_school_id and p.format='private_lesson';
 if tz is null then raise exception 'invalid_school_or_offering'; end if;
 if not exists(select 1 from public.teachers t where t.school_id=p_school_id and t.person_id=p_teacher_id and t.outside_availability_policy='require_approval') then raise exception 'approval_not_required'; end if;
 if not exists(select 1 from public.students where school_id=p_school_id and person_id=p_student_id and enrollment_status in('active','prospect')) then raise exception 'invalid_student'; end if;
 if not exists(select 1 from public.lesson_places where school_id=p_school_id and id=p_place_id and status='active') then raise exception 'invalid_place'; end if;
 starts:=p_local_start at time zone tz; finishes:=(p_local_start+make_interval(mins=>duration)) at time zone tz;
 if starts<=now() then raise exception 'new_lesson_time_must_be_future'; end if;
 if exists(select 1 from public.teacher_availability_rules r where r.school_id=p_school_id and r.teacher_id=p_teacher_id and r.weekday=extract(dow from p_local_start)::int and r.effective_from<=p_local_start::date and (r.effective_until is null or r.effective_until>=p_local_start::date) and r.start_time<=p_local_start::time and r.end_time>=(p_local_start+make_interval(mins=>duration))::time) then raise exception 'inside_teacher_availability'; end if;
 if p_schedule_type='weekly' and (p_ends_on is null or p_ends_on<p_local_start::date or p_ends_on>p_local_start::date+371) then raise exception 'invalid_recurrence_end'; end if;
 insert into public.lesson_schedule_proposals(school_id,teacher_id,student_id,product_id,place_id,schedule_type,proposed_local_start,proposed_starts_at,proposed_ends_at,ends_on,notes,reason,created_by)
 values(p_school_id,p_teacher_id,p_student_id,p_product_id,p_place_id,p_schedule_type,p_local_start,starts,finishes,p_ends_on,nullif(trim(p_notes),''),trim(p_reason),actor) returning id into proposal_id;
 select p.profile_id,lower(trim(p.email)) into teacher_profile,teacher_email from public.people p where p.school_id=p_school_id and p.id=p_teacher_id and p.status='active';
 select coalesce(nullif(trim(preferred_name),''),first_name)||' '||last_name into student_name from public.people where school_id=p_school_id and id=p_student_id;
 if teacher_profile is null then raise exception 'teacher_login_required'; end if;
 insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
 values(p_school_id,teacher_profile,'lesson_created','Lesson requires your approval','A lesson with '||student_name||' is outside your saved availability. Accept or decline before it is added to the calendar.','/schools/'||p_school_id||'/teacher','lesson-proposal:'||proposal_id,'lesson_schedule_proposal',proposal_id,jsonb_build_object('outside_availability',true,'requires_approval',true,'starts_at',starts));
 insert into public.lesson_proposal_email_outbox(school_id,proposal_id,recipient_email,subject,message_text,idempotency_key) values(p_school_id,proposal_id,teacher_email,'Lesson requires your approval','A lesson with '||student_name||' is outside your saved availability. Sign in to Common Time to accept or decline it.','lesson-proposal/'||proposal_id);
 insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload) values(p_school_id,'lesson_schedule_proposal.created','lesson_schedule_proposal',proposal_id,actor,'owner','lesson_creation',jsonb_build_object('teacher_id',p_teacher_id,'starts_at',starts));
 return proposal_id;
end $$;
revoke all on function public.create_outside_availability_lesson_proposal(uuid,uuid,uuid,uuid,uuid,timestamp,text,date,text,text) from public,anon;
grant execute on function public.create_outside_availability_lesson_proposal(uuid,uuid,uuid,uuid,uuid,timestamp,text,date,text,text) to authenticated;

create or replace function public.decide_outside_availability_lesson_proposal(p_school_id uuid,p_proposal_id uuid,p_decision text,p_note text default null)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); proposal public.lesson_schedule_proposals%rowtype; event_id uuid; series_id uuid; occurrence_date date; occurrence_start timestamptz; occurrence_end timestamptz; product public.service_products%rowtype; school public.schools%rowtype;
begin
 if actor is null or p_decision not in('accept','decline') or length(coalesce(trim(p_note),''))>500 then raise exception 'invalid_decision'; end if;
 select * into proposal from public.lesson_schedule_proposals where school_id=p_school_id and id=p_proposal_id for update;
 if not found then raise exception 'proposal_not_found'; end if;
 if not exists(select 1 from public.people p join public.school_members m on m.school_id=p.school_id and m.profile_id=p.profile_id and m.status='active' and m.role='teacher' where p.school_id=p_school_id and p.id=proposal.teacher_id and p.profile_id=actor and p.status='active') then raise exception 'not_authorized'; end if;
 if proposal.status<>'pending_teacher' then return proposal.status; end if;
 if p_decision='decline' then
  update public.lesson_schedule_proposals set status='declined',decided_by=actor,decided_at=now(),decision_note=nullif(trim(p_note),''),updated_at=now() where id=proposal.id;
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload) values(p_school_id,'lesson_schedule_proposal.declined','lesson_schedule_proposal',proposal.id,actor,'teacher','teacher_schedule',jsonb_build_object('note',nullif(trim(p_note),'')));
  return 'declined';
 end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text,0));
 if exists(select 1 from public.lesson_events e where e.school_id=p_school_id and e.teacher_id=proposal.teacher_id and e.status not in('cancelled','rescheduled') and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(proposal.proposed_starts_at,proposal.proposed_ends_at,'[)')) then raise exception 'teacher_conflict'; end if;
 if exists(select 1 from public.lesson_events e where e.school_id=p_school_id and e.student_id=proposal.student_id and e.status not in('cancelled','rescheduled') and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(proposal.proposed_starts_at,proposal.proposed_ends_at,'[)')) then raise exception 'student_conflict'; end if;
 if proposal.schedule_type='weekly' then
  select * into product from public.service_products where school_id=p_school_id and id=proposal.product_id and status='active'; select * into school from public.schools where id=p_school_id;
  for occurrence_date in select generate_series(proposal.proposed_local_start::date,proposal.ends_on,interval '7 days')::date loop
   occurrence_start:=(occurrence_date+proposal.proposed_local_start::time) at time zone school.timezone; occurrence_end:=(occurrence_date+proposal.proposed_local_start::time+make_interval(mins=>product.duration_minutes)) at time zone school.timezone;
   if exists(select 1 from public.lesson_events e where e.school_id=p_school_id and e.status not in('cancelled','rescheduled') and (e.teacher_id=proposal.teacher_id or e.student_id=proposal.student_id) and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(occurrence_start,occurrence_end,'[)')) then raise exception 'series_conflict'; end if;
  end loop;
  insert into public.lesson_series(school_id,product_id,teacher_id,student_id,default_place_id,recurrence_rule,starts_on,ends_on,status,created_by) values(p_school_id,proposal.product_id,proposal.teacher_id,proposal.student_id,proposal.place_id,jsonb_build_object('frequency','weekly','interval',1,'weekday',extract(dow from proposal.proposed_local_start)::int,'local_time',to_char(proposal.proposed_local_start::time,'HH24:MI')),proposal.proposed_local_start::date,proposal.ends_on,'active',proposal.created_by) returning id into series_id;
  insert into public.lesson_series_billing_terms(school_id,lesson_series_id,source_product_id,billing_mode,billing_timing,amount_cents,currency,offering_name,effective_from,effective_until,created_by) values(p_school_id,series_id,product.id,product.pricing_model,coalesce(product.billing_timing_override,school.billing_timing_default),product.price_cents,product.currency,product.name,proposal.proposed_local_start::date,proposal.ends_on,proposal.created_by);
  for occurrence_date in select generate_series(proposal.proposed_local_start::date,proposal.ends_on,interval '7 days')::date loop
   occurrence_start:=(occurrence_date+proposal.proposed_local_start::time) at time zone school.timezone; occurrence_end:=(occurrence_date+proposal.proposed_local_start::time+make_interval(mins=>product.duration_minutes)) at time zone school.timezone;
   insert into public.lesson_events(school_id,product_id,teacher_id,student_id,place_id,starts_at,ends_at,status,notes,lesson_series_id,is_series_exception,created_by) values(p_school_id,proposal.product_id,proposal.teacher_id,proposal.student_id,proposal.place_id,occurrence_start,occurrence_end,'scheduled',proposal.notes,series_id,false,proposal.created_by);
  end loop;
  update public.lesson_schedule_proposals set status='applied',decided_by=actor,decided_at=now(),decision_note=nullif(trim(p_note),''),applied_entity_type='lesson_series',applied_entity_id=series_id,updated_at=now() where id=proposal.id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor,'lesson_series.created','lesson_series',series_id,jsonb_build_object('outside_availability_override',true,'teacher_approved',true,'proposal_id',proposal.id));
  return 'applied';
 end if;
 insert into public.lesson_events(school_id,product_id,teacher_id,student_id,place_id,starts_at,ends_at,status,notes,is_series_exception,exception_reason,created_by)
 values(p_school_id,proposal.product_id,proposal.teacher_id,proposal.student_id,proposal.place_id,proposal.proposed_starts_at,proposal.proposed_ends_at,'scheduled',proposal.notes,true,'Outside availability approved by teacher: '||proposal.reason,proposal.created_by) returning id into event_id;
 update public.lesson_schedule_proposals set status='applied',decided_by=actor,decided_at=now(),decision_note=nullif(trim(p_note),''),applied_entity_type='lesson_event',applied_entity_id=event_id,updated_at=now() where id=proposal.id;
 insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor,'lesson.created','lesson_event',event_id,jsonb_build_object('outside_availability_override',true,'teacher_approved',true,'proposal_id',proposal.id));
 insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload) values(p_school_id,'lesson_schedule_proposal.applied','lesson_schedule_proposal',proposal.id,actor,'teacher','teacher_schedule',jsonb_build_object('lesson_event_id',event_id));
 return 'applied';
end $$;
revoke all on function public.decide_outside_availability_lesson_proposal(uuid,uuid,text,text) from public,anon;
grant execute on function public.decide_outside_availability_lesson_proposal(uuid,uuid,text,text) to authenticated;

create or replace function public.set_teacher_scheduling_settings(p_school_id uuid,p_teacher_id uuid,p_scheduling_authority text,p_can_manage_own_availability boolean,p_outside_availability_policy text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); before_settings jsonb;
begin
 if actor is null or not public.has_school_role(p_school_id,array['owner']) then raise exception 'not_authorized'; end if;
 if p_scheduling_authority not in('propose_only','manage_assigned_lessons') or p_outside_availability_policy not in('notify_only','require_approval') then raise exception 'invalid_scheduling_settings'; end if;
 select jsonb_build_object('scheduling_authority',scheduling_authority,'can_manage_own_availability',can_manage_own_availability,'outside_availability_policy',outside_availability_policy) into before_settings from public.teachers where school_id=p_school_id and person_id=p_teacher_id for update;
 if before_settings is null then raise exception 'teacher_not_found'; end if;
 update public.teachers set scheduling_authority=p_scheduling_authority,can_manage_own_availability=p_can_manage_own_availability,outside_availability_policy=p_outside_availability_policy,can_self_reschedule=(p_scheduling_authority='manage_assigned_lessons') where school_id=p_school_id and person_id=p_teacher_id;
 insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(p_school_id,actor,'teacher.scheduling_settings_changed','teacher',p_teacher_id,jsonb_build_object('before',before_settings,'outside_availability_policy',p_outside_availability_policy));
end $$;
revoke all on function public.set_teacher_scheduling_settings(uuid,uuid,text,boolean,text) from public,anon;
grant execute on function public.set_teacher_scheduling_settings(uuid,uuid,text,boolean,text) to authenticated;
