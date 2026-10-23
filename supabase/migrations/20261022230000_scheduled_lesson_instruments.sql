alter table public.lesson_events add column instrument_id uuid;
alter table public.lesson_series add column instrument_id uuid;
alter table public.lesson_schedule_proposals add column instrument_id uuid;

alter table public.lesson_events add foreign key(school_id,instrument_id)
  references public.school_instruments(school_id,id) on delete restrict;
alter table public.lesson_series add foreign key(school_id,instrument_id)
  references public.school_instruments(school_id,id) on delete restrict;
alter table public.lesson_schedule_proposals add foreign key(school_id,instrument_id)
  references public.school_instruments(school_id,id) on delete restrict;

-- Instrument is scheduling context, so surface it beside (not inside) the
-- offering in the payer portal.
drop function public.get_client_portal_lessons();
create function public.get_client_portal_lessons()
returns table (
  lesson_id uuid, school_id uuid, school_name text, school_timezone text,
  school_phone text, school_email text, student_id uuid, student_name text,
  teacher_name text, product_name text, instrument_name text, place_name text,
  starts_at timestamptz, ends_at timestamptz, reschedule_allowed boolean,
  reschedule_blocked_reason text, pending_request_id uuid,
  pending_request_type text, pending_request_status text,
  pending_requested_at timestamptz
)
language sql stable security definer set search_path=''
as $$
  with identity as (
    select lower(nullif(trim(auth.jwt()->>'email'),'')) as email
    where auth.role()='authenticated' and public.current_client_portal_access_state()='ready'
  ), authorized_students as (
    select distinct account.school_id, account_student.student_id
    from identity
    join public.payer_portal_authorizations portal_auth on portal_auth.normalized_email=identity.email
    join public.billing_accounts account on account.school_id=portal_auth.school_id and account.id=portal_auth.billing_account_id and account.status='active'
    join public.billing_account_students account_student on account_student.school_id=account.school_id and account_student.billing_account_id=account.id
    join public.students student on student.school_id=account_student.school_id and student.person_id=account_student.student_id and student.enrollment_status in ('active','paused')
  )
  select event.id,school.id,school.name,school.timezone,school.phone,school.reply_to_email,event.student_id,
    concat_ws(' ',coalesce(nullif(trim(student_person.preferred_name),''),student_person.first_name),student_person.last_name),
    concat_ws(' ',coalesce(nullif(trim(teacher_person.preferred_name),''),teacher_person.first_name),teacher_person.last_name),
    product.name,instrument.name,
    case place.kind when 'student_home' then 'Student home' when 'online' then 'Online' else place.name end,
    event.starts_at,event.ends_at,event.reschedule_allowed,event.reschedule_blocked_reason,
    pending.id,pending.request_type,pending.status,pending.requested_at
  from authorized_students access
  join public.lesson_events event on event.school_id=access.school_id and event.student_id=access.student_id
  join public.schools school on school.id=event.school_id
  join public.people student_person on student_person.school_id=event.school_id and student_person.id=event.student_id
  join public.people teacher_person on teacher_person.school_id=event.school_id and teacher_person.id=event.teacher_id
  join public.service_products product on product.school_id=event.school_id and product.id=event.product_id
  left join public.school_instruments instrument on instrument.school_id=event.school_id and instrument.id=event.instrument_id
  join public.lesson_places place on place.school_id=event.school_id and place.id=event.place_id
  left join lateral (
    select request.id,request.request_type,request.status,request.requested_at
    from public.lesson_change_requests request
    where request.school_id=event.school_id and request.lesson_event_id=event.id and request.status in ('pending','in_progress')
    order by request.requested_at,request.id limit 1
  ) pending on true
  where event.status='scheduled' and event.starts_at>=now() and event.starts_at<now()+interval '3 months'
  order by event.starts_at,event.id;
$$;
revoke all on function public.get_client_portal_lessons() from public,anon;
grant execute on function public.get_client_portal_lessons() to authenticated;

-- Preserve historical uncertainty. Infer only when a teacher or school has one
-- possible active instrument; never guess between several choices.
with sole_teacher_instrument as (
  select mapping.school_id,mapping.teacher_id,(array_agg(mapping.instrument_id))[1] instrument_id
  from public.teacher_instruments mapping
  join public.school_instruments instrument on instrument.school_id=mapping.school_id and instrument.id=mapping.instrument_id and instrument.is_active
  group by mapping.school_id,mapping.teacher_id having count(*)=1
) update public.lesson_events event set instrument_id=choice.instrument_id
from sole_teacher_instrument choice where event.instrument_id is null and choice.school_id=event.school_id and choice.teacher_id=event.teacher_id;

with sole_teacher_instrument as (
  select mapping.school_id,mapping.teacher_id,(array_agg(mapping.instrument_id))[1] instrument_id
  from public.teacher_instruments mapping
  join public.school_instruments instrument on instrument.school_id=mapping.school_id and instrument.id=mapping.instrument_id and instrument.is_active
  group by mapping.school_id,mapping.teacher_id having count(*)=1
) update public.lesson_series series set instrument_id=choice.instrument_id
from sole_teacher_instrument choice where series.instrument_id is null and choice.school_id=series.school_id and choice.teacher_id=series.teacher_id;

with sole_teacher_instrument as (
  select mapping.school_id,mapping.teacher_id,(array_agg(mapping.instrument_id))[1] instrument_id
  from public.teacher_instruments mapping
  join public.school_instruments instrument on instrument.school_id=mapping.school_id and instrument.id=mapping.instrument_id and instrument.is_active
  group by mapping.school_id,mapping.teacher_id having count(*)=1
) update public.lesson_schedule_proposals proposal set instrument_id=choice.instrument_id
from sole_teacher_instrument choice where proposal.instrument_id is null and choice.school_id=proposal.school_id and choice.teacher_id=proposal.teacher_id;

create function public.assert_scheduling_instrument(p_school_id uuid,p_instrument_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.school_instruments where school_id=p_school_id and id=p_instrument_id and is_active)
    then raise exception 'invalid_instrument'; end if;
end $$;
revoke all on function public.assert_scheduling_instrument(uuid,uuid) from public,anon,authenticated;

create function public.create_single_lesson_with_instrument(
  p_school_id uuid,p_product_id uuid,p_teacher_id uuid,p_student_id uuid,p_place_id uuid,p_instrument_id uuid,
  p_local_start timestamp without time zone,p_notes text default null,p_allow_outside_availability boolean default false,p_override_reason text default null
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare event_id uuid;
begin
  perform public.assert_scheduling_instrument(p_school_id,p_instrument_id);
  event_id:=public.create_single_lesson(p_school_id,p_product_id,p_teacher_id,p_student_id,p_place_id,p_local_start,p_notes,p_allow_outside_availability,p_override_reason);
  update public.lesson_events set instrument_id=p_instrument_id where school_id=p_school_id and id=event_id;
  return event_id;
end $$;
revoke all on function public.create_single_lesson_with_instrument(uuid,uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) from public,anon;
grant execute on function public.create_single_lesson_with_instrument(uuid,uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) to authenticated;

create function public.create_weekly_lesson_series_with_instrument(
  p_school_id uuid,p_product_id uuid,p_teacher_id uuid,p_student_id uuid,p_place_id uuid,p_instrument_id uuid,
  p_local_start timestamp without time zone,p_ends_on date,p_notes text default null,p_allow_outside_availability boolean default false,p_override_reason text default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb; series_id uuid;
begin
  perform public.assert_scheduling_instrument(p_school_id,p_instrument_id);
  result:=public.create_weekly_lesson_series(p_school_id,p_product_id,p_teacher_id,p_student_id,p_place_id,p_local_start,p_ends_on,p_notes,p_allow_outside_availability,p_override_reason);
  series_id:=(result->>'series_id')::uuid;
  update public.lesson_series set instrument_id=p_instrument_id where school_id=p_school_id and id=series_id;
  update public.lesson_events set instrument_id=p_instrument_id where school_id=p_school_id and lesson_series_id=series_id;
  return result;
end $$;
revoke all on function public.create_weekly_lesson_series_with_instrument(uuid,uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text) from public,anon;
grant execute on function public.create_weekly_lesson_series_with_instrument(uuid,uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text) to authenticated;

create function public.create_outside_availability_lesson_proposal_with_instrument(
  p_school_id uuid,p_product_id uuid,p_teacher_id uuid,p_student_id uuid,p_place_id uuid,p_instrument_id uuid,
  p_local_start timestamp without time zone,p_schedule_type text,p_ends_on date,p_notes text,p_reason text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare proposal_id uuid;
begin
  perform public.assert_scheduling_instrument(p_school_id,p_instrument_id);
  proposal_id:=public.create_outside_availability_lesson_proposal(p_school_id,p_product_id,p_teacher_id,p_student_id,p_place_id,p_local_start,p_schedule_type,p_ends_on,p_notes,p_reason);
  update public.lesson_schedule_proposals set instrument_id=p_instrument_id where school_id=p_school_id and id=proposal_id;
  return proposal_id;
end $$;
revoke all on function public.create_outside_availability_lesson_proposal_with_instrument(uuid,uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,date,text,text) from public,anon;
grant execute on function public.create_outside_availability_lesson_proposal_with_instrument(uuid,uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,date,text,text) to authenticated;

create function public.schedule_service_entitlement_with_instrument(
  p_school_id uuid,p_entitlement_id uuid,p_teacher_id uuid,p_place_id uuid,p_instrument_id uuid,
  p_local_start timestamp without time zone,p_notes text default null,p_allow_outside_availability boolean default false,p_override_reason text default null
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare event_id uuid;
begin
  perform public.assert_scheduling_instrument(p_school_id,p_instrument_id);
  event_id:=public.schedule_service_entitlement(p_school_id,p_entitlement_id,p_teacher_id,p_place_id,p_local_start,p_notes,p_allow_outside_availability,p_override_reason);
  update public.lesson_events set instrument_id=p_instrument_id where school_id=p_school_id and id=event_id;
  return event_id;
end $$;
revoke all on function public.schedule_service_entitlement_with_instrument(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) from public,anon;
grant execute on function public.schedule_service_entitlement_with_instrument(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) to authenticated;

create function public.create_outside_availability_entitlement_proposal_with_instrument(
  p_school_id uuid,p_entitlement_id uuid,p_teacher_id uuid,p_place_id uuid,p_instrument_id uuid,
  p_local_start timestamp without time zone,p_notes text,p_reason text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare proposal_id uuid;
begin
  perform public.assert_scheduling_instrument(p_school_id,p_instrument_id);
  proposal_id:=public.create_outside_availability_entitlement_proposal(p_school_id,p_entitlement_id,p_teacher_id,p_place_id,p_local_start,p_notes,p_reason);
  update public.lesson_schedule_proposals set instrument_id=p_instrument_id where school_id=p_school_id and id=proposal_id;
  return proposal_id;
end $$;
revoke all on function public.create_outside_availability_entitlement_proposal_with_instrument(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,text) from public,anon;
grant execute on function public.create_outside_availability_entitlement_proposal_with_instrument(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,text) to authenticated;

create function public.apply_proposal_instrument_to_schedule()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='applied' and old.status<>'applied' and new.instrument_id is not null then
    if new.applied_entity_type='lesson_event' then
      update public.lesson_events set instrument_id=new.instrument_id where school_id=new.school_id and id=new.applied_entity_id;
    elsif new.applied_entity_type='lesson_series' then
      update public.lesson_series set instrument_id=new.instrument_id where school_id=new.school_id and id=new.applied_entity_id;
      update public.lesson_events set instrument_id=new.instrument_id where school_id=new.school_id and lesson_series_id=new.applied_entity_id;
    end if;
  end if;
  return new;
end $$;
create trigger lesson_proposal_apply_instrument after update of status on public.lesson_schedule_proposals
for each row execute function public.apply_proposal_instrument_to_schedule();
revoke all on function public.apply_proposal_instrument_to_schedule() from public,anon,authenticated;

create function public.carry_proposal_instrument()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.replaces_proposal_id is not null and new.instrument_id is null then
    select prior.instrument_id into new.instrument_id from public.lesson_schedule_proposals prior
    where prior.school_id=new.school_id and prior.id=new.replaces_proposal_id;
  end if;
  return new;
end $$;
create trigger lesson_proposal_carry_instrument before insert on public.lesson_schedule_proposals
for each row execute function public.carry_proposal_instrument();
revoke all on function public.carry_proposal_instrument() from public,anon,authenticated;

-- Any future occurrence generator inherits the series default automatically.
-- A deliberately supplied occurrence instrument remains an allowed exception.
create function public.carry_series_instrument_to_lesson()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.lesson_series_id is not null and new.instrument_id is null then
    select series.instrument_id into new.instrument_id from public.lesson_series series
    where series.school_id=new.school_id and series.id=new.lesson_series_id;
  end if;
  return new;
end $$;
create trigger lesson_event_carry_series_instrument before insert on public.lesson_events
for each row execute function public.carry_series_instrument_to_lesson();
revoke all on function public.carry_series_instrument_to_lesson() from public,anon,authenticated;

create index lesson_events_instrument_time_idx on public.lesson_events(school_id,instrument_id,starts_at) where instrument_id is not null;
comment on column public.lesson_events.instrument_id is 'Instrument or discipline actually scheduled for this occurrence; independent of the billable offering.';
comment on column public.lesson_series.instrument_id is 'Default instrument or discipline for this recurring schedule; independent of the billable offering.';

-- Home and Online are built-in scheduling choices, not configurable rooms.
update public.lesson_places set kind='online',name='Online',details=null
where lower(trim(name))='online' and status='active';
insert into public.lesson_places(school_id,name,details,status,created_by,kind)
select school.id,'Student home',null,'active',school.created_by,'student_home' from public.schools school
where not exists(select 1 from public.lesson_places place where place.school_id=school.id and place.kind='student_home' and place.status='active')
on conflict(school_id,(lower(name))) do nothing;
insert into public.lesson_places(school_id,name,details,status,created_by,kind)
select school.id,'Online',null,'active',school.created_by,'online' from public.schools school
where not exists(select 1 from public.lesson_places place where place.school_id=school.id and place.kind='online' and place.status='active')
on conflict(school_id,(lower(name))) do nothing;

create function public.add_builtin_lesson_places()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.lesson_places(school_id,name,details,status,created_by,kind) values
    (new.id,'Student home',null,'active',new.created_by,'student_home'),
    (new.id,'Online',null,'active',new.created_by,'online');
  return new;
end $$;
create trigger schools_add_builtin_lesson_places after insert on public.schools
for each row execute function public.add_builtin_lesson_places();
revoke all on function public.add_builtin_lesson_places() from public,anon,authenticated;

-- New scheduling must pass through the instrument-aware boundary. Historical
-- rows may remain unknown, but authenticated callers cannot create new ones.
revoke execute on function public.create_single_lesson(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) from authenticated;
revoke execute on function public.create_weekly_lesson_series(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,date,text,boolean,text) from authenticated;
revoke execute on function public.create_outside_availability_lesson_proposal(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,date,text,text) from authenticated;
revoke execute on function public.schedule_service_entitlement(uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) from authenticated;
revoke execute on function public.create_outside_availability_entitlement_proposal(uuid,uuid,uuid,uuid,timestamp without time zone,text,text) from authenticated;
