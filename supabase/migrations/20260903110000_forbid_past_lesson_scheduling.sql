-- Scheduled occurrences must begin in the future regardless of which RPC or
-- application surface attempts the write.

create function public.reject_past_scheduled_lesson()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='scheduled' and new.starts_at<=now() then
    raise exception 'lesson_start_must_be_future';
  end if;
  return new;
end $$;

create trigger lesson_events_reject_past_schedule
before insert or update of starts_at,status on public.lesson_events
for each row execute function public.reject_past_scheduled_lesson();

revoke all on function public.reject_past_scheduled_lesson() from public,anon,authenticated;

