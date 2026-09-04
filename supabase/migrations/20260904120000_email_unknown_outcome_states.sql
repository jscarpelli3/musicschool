alter table public.owner_notification_email_outbox
  drop constraint owner_notification_email_outbox_status_check;
alter table public.owner_notification_email_outbox
  add constraint owner_notification_email_outbox_status_check check(status in (
    'pending','accepted','sent','delivered','delayed','failed','bounced','complained','suppressed','reconciliation_required'
  ));

alter table public.lesson_request_email_outbox
  drop constraint lesson_request_email_outbox_status_check;
alter table public.lesson_request_email_outbox
  add constraint lesson_request_email_outbox_status_check check(status in (
    'pending','accepted','sent','delivered','delayed','failed','bounced','complained','suppressed','reconciliation_required'
  ));

comment on column public.owner_notification_email_outbox.status is
  'Provider submission and delivery truth. reconciliation_required means a timed-out provider call must not be treated as a definite failure.';
comment on column public.lesson_request_email_outbox.status is
  'Provider submission and delivery truth. reconciliation_required means a timed-out provider call must not be treated as a definite failure.';
