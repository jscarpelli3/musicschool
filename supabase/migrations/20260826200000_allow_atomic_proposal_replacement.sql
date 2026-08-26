drop index if exists public.lesson_schedule_proposals_one_pending_reschedule;
create unique index lesson_schedule_proposals_one_pending_reschedule
  on public.lesson_schedule_proposals(school_id,lesson_event_id)
  where proposal_kind='reschedule'
    and status in('pending_owner','pending_teacher')
    and replaces_proposal_id is null;

comment on index public.lesson_schedule_proposals_one_pending_reschedule is
  'Guards root pending reschedule proposals. Replacement chains are serialized by row locks in manage_own_lesson_schedule_proposal; direct writes remain revoked.';
