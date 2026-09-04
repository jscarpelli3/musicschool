alter table public.teacher_invitation_deliveries
  drop constraint teacher_invitation_deliveries_status_check;
alter table public.teacher_invitation_deliveries
  add constraint teacher_invitation_deliveries_status_check check(status in (
    'pending','accepted','sent','delivered','delayed','failed','bounced','complained','suppressed','reconciliation_required'
  ));
alter table public.teacher_invitation_deliveries
  add column delivered_at timestamptz,
  add column updated_at timestamptz not null default now();

alter table public.lesson_proposal_email_outbox
  drop constraint lesson_proposal_email_outbox_status_check;
alter table public.lesson_proposal_email_outbox
  add constraint lesson_proposal_email_outbox_status_check check(status in (
    'pending','accepted','sent','delivered','delayed','failed','bounced','complained','suppressed','reconciliation_required'
  ));
alter table public.lesson_proposal_email_outbox
  add column accepted_at timestamptz,
  add column delivered_at timestamptz,
  add column failed_at timestamptz;

comment on table public.teacher_invitation_deliveries is
  'Durable teacher-access email attempts. Signed Resend events advance provider delivery truth independently from membership state.';
comment on table public.lesson_proposal_email_outbox is
  'Durable schedule-proposal emails. Signed Resend events advance provider delivery truth independently from proposal state.';
