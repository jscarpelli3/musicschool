-- Request origin and business scenario are independent. Downstream decisions
-- must branch on scenario, never infer service truth from the UI that submitted it.
alter table public.lesson_change_requests
  add column origin_kind text not null default 'family'
    check (origin_kind in ('family','teacher','owner','system')),
  add column scenario text
    check (scenario in (
      'student_cancellation','student_reschedule','student_no_show',
      'teacher_cancellation','school_cancellation'
    ));

update public.lesson_change_requests
set scenario=case request_type
  when 'reschedule' then 'student_reschedule'
  else 'student_cancellation'
end;

create function public.derive_lesson_change_request_scenario()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.scenario is null then
    new.scenario:=case
      when new.origin_kind='teacher' then 'teacher_cancellation'
      when new.origin_kind in ('owner','system') then 'school_cancellation'
      when new.request_type='reschedule' then 'student_reschedule'
      else 'student_cancellation'
    end;
  end if;
  return new;
end $$;

create trigger lesson_change_requests_derive_scenario
before insert on public.lesson_change_requests for each row
execute function public.derive_lesson_change_request_scenario();

alter table public.lesson_change_requests alter column scenario set not null;

comment on column public.lesson_change_requests.origin_kind is
  'The channel/actor class that originated the request; it does not determine service or financial truth.';
comment on column public.lesson_change_requests.scenario is
  'The business event used to select policy and service semantics independently from request origin.';

revoke all on function public.derive_lesson_change_request_scenario() from public,anon,authenticated;

do $$
begin
  if exists(
    select 1 from public.lesson_change_requests
    where scenario not in ('student_cancellation','student_reschedule','student_no_show','teacher_cancellation','school_cancellation')
  ) then raise exception 'lesson change scenario backfill failed'; end if;
end $$;
