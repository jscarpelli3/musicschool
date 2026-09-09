alter table public.lesson_schedule_proposals
  add column reason_code text,
  add column reason_detail text,
  add constraint lesson_schedule_proposals_reason_code_check check(
    reason_code is null or reason_code in('family_request','teacher_request','school_closure','illness','schedule_conflict','other')
  ),
  add constraint lesson_schedule_proposals_other_reason_check check(
    reason_code is distinct from 'other' or nullif(trim(reason_detail),'') is not null
  );

create or replace function public.normalize_reschedule_reason()
returns trigger language plpgsql set search_path='' as $$
declare
  code text:=nullif(current_setting('app.reschedule_reason_code',true),'');
  detail text:=nullif(current_setting('app.reschedule_reason_detail',true),'');
  label text;
begin
  if code is null and tg_table_name='lesson_events' then
    select proposal.reason_code,proposal.reason_detail into code,detail
    from public.lesson_schedule_proposals proposal
    where proposal.school_id=new.school_id and proposal.lesson_event_id=new.id
      and proposal.proposal_kind='reschedule' and proposal.status='pending_owner'
    order by proposal.created_at desc limit 1;
  elsif code is null and tg_table_name='lesson_event_changes' then
    select proposal.reason_code,proposal.reason_detail into code,detail
    from public.lesson_schedule_proposals proposal
    where proposal.school_id=new.school_id and proposal.lesson_event_id=new.lesson_event_id
      and proposal.proposal_kind='reschedule' and proposal.status='pending_owner'
    order by proposal.created_at desc limit 1;
  end if;
  if code is null then return new; end if;
  label:=case code
    when 'family_request' then 'Family requested another time'
    when 'teacher_request' then 'Teacher requested another time'
    when 'school_closure' then 'School closure or holiday'
    when 'illness' then 'Illness'
    when 'schedule_conflict' then 'Schedule conflict'
    when 'other' then detail
  end;
  if label is null then raise exception 'invalid_reschedule_reason'; end if;

  if tg_table_name='lesson_events' then
    new.reschedule_reason_code:=code;
    new.reschedule_reason_detail:=detail;
    new.exception_reason:='Rescheduled: '||label;
  elsif tg_table_name='lesson_schedule_proposals' then
    new.reason_code:=code;
    new.reason_detail:=detail;
    new.reason:=label;
  else
    new.reason_code:=code;
    new.reason:=label;
  end if;
  return new;
end
$$;

drop trigger lesson_events_normalize_reschedule_reason on public.lesson_events;
create trigger lesson_events_normalize_reschedule_reason
before update of exception_reason on public.lesson_events for each row
when (new.exception_reason is distinct from old.exception_reason and new.exception_reason like 'Rescheduled:%')
execute function public.normalize_reschedule_reason();

create trigger lesson_schedule_proposals_normalize_reschedule_reason
before insert on public.lesson_schedule_proposals for each row
when (new.proposal_kind='reschedule')
execute function public.normalize_reschedule_reason();

drop trigger lesson_event_changes_normalize_reschedule_reason on public.lesson_event_changes;
create trigger lesson_event_changes_normalize_reschedule_reason
before insert on public.lesson_event_changes for each row
when (new.change_type='rescheduled')
execute function public.normalize_reschedule_reason();

create or replace function public.reschedule_lesson_as_owner_v2(
  p_school_id uuid,p_lesson_event_id uuid,p_teacher_id uuid,p_place_id uuid,
  p_local_start timestamp without time zone,p_source text,p_reason_code text,
  p_reason_detail text default null,p_allow_outside_availability boolean default false
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare reason_label text;
begin
  reason_label:=case p_reason_code
    when 'family_request' then 'Family requested another time'
    when 'teacher_request' then 'Teacher requested another time'
    when 'school_closure' then 'School closure or holiday'
    when 'illness' then 'Illness'
    when 'schedule_conflict' then 'Schedule conflict'
    when 'other' then nullif(trim(coalesce(p_reason_detail,'')),'')
  end;
  if reason_label is null or length(coalesce(p_reason_detail,''))>400
  then raise exception 'invalid_reschedule_reason'; end if;
  perform set_config('app.reschedule_reason_code',p_reason_code,true);
  perform set_config('app.reschedule_reason_detail',coalesce(trim(p_reason_detail),''),true);
  return public.reschedule_lesson_as_owner(
    p_school_id,p_lesson_event_id,p_teacher_id,p_place_id,p_local_start,p_source,
    reason_label,p_allow_outside_availability
  );
end
$$;

create or replace function public.propose_or_reschedule_assigned_lesson_as_teacher_v2(
  p_school_id uuid,p_lesson_event_id uuid,p_local_start timestamp without time zone,
  p_reason_code text,p_reason_detail text default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare reason_label text;
begin
  reason_label:=case p_reason_code
    when 'family_request' then 'Family requested another time'
    when 'teacher_request' then 'Teacher requested another time'
    when 'school_closure' then 'School closure or holiday'
    when 'illness' then 'Illness'
    when 'schedule_conflict' then 'Schedule conflict'
    when 'other' then nullif(trim(coalesce(p_reason_detail,'')),'')
  end;
  if reason_label is null or length(coalesce(p_reason_detail,''))>400
  then raise exception 'invalid_reschedule_reason'; end if;
  perform set_config('app.reschedule_reason_code',p_reason_code,true);
  perform set_config('app.reschedule_reason_detail',coalesce(trim(p_reason_detail),''),true);
  return public.propose_or_reschedule_assigned_lesson_as_teacher(
    p_school_id,p_lesson_event_id,p_local_start,reason_label
  );
end
$$;

comment on function public.normalize_reschedule_reason() is
  'Persists independently supplied reason code/detail fields; it does not parse display text.';
