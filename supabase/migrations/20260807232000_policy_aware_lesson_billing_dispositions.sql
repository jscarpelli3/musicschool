-- Deterministic lesson billing disposition preview. Rich-text policy content is
-- never parsed; only a published, effective structured rule may drive billing.

alter table public.cancellation_policy_rules
  add column timely_cancel_disposition text not null default 'waive'
    check (timely_cancel_disposition in ('charge', 'credit', 'waive', 'manual_review'));

create or replace function public.guard_published_policy_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.published_at is not null then
    raise exception 'Published policy versions cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and old.published_at is not null then
    raise exception 'Published policy versions are immutable';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger school_policy_versions_guard_published
before update or delete on public.school_policy_versions
for each row execute function public.guard_published_policy_version();

create or replace function public.guard_published_policy_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid := coalesce(new.policy_version_id, old.policy_version_id);
begin
  if exists (
    select 1
    from public.school_policy_versions version
    where version.id = target_version_id
      and version.published_at is not null
  ) then
    raise exception 'Rules for a published policy version are immutable';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger cancellation_policy_rules_guard_published
before update or delete on public.cancellation_policy_rules
for each row execute function public.guard_published_policy_rules();

create trigger payment_policy_rules_guard_published
before update or delete on public.payment_policy_rules
for each row execute function public.guard_published_policy_rules();

create or replace function public.compute_lesson_event_billing_disposition(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  event_row public.lesson_events%rowtype;
  policy_row record;
  raw_disposition text;
  disposition text;
  reason_code text;
begin
  select * into event_row
  from public.lesson_events
  where school_id = p_school_id and id = p_lesson_event_id;

  if not found then
    raise exception 'lesson_event_not_found';
  end if;

  if event_row.status = 'scheduled' then
    if event_row.starts_at > p_as_of then
      return jsonb_build_object(
        'lesson_event_id', event_row.id,
        'state', 'not_ready',
        'disposition', null,
        'reason_code', 'future_scheduled_lesson',
        'policy_version_id', null,
        'policy_disposition', null
      );
    end if;

    return jsonb_build_object(
      'lesson_event_id', event_row.id,
      'state', 'owner_review',
      'disposition', 'owner_review',
      'reason_code', 'past_lesson_missing_outcome',
      'policy_version_id', null,
      'policy_disposition', null
    );
  end if;

  if event_row.status = 'completed' or event_row.outcome in ('completed', 'partial') then
    return jsonb_build_object(
      'lesson_event_id', event_row.id,
      'state', 'resolved',
      'disposition', 'charge',
      'reason_code', case when event_row.outcome = 'partial' then 'partially_serviced' else 'serviced' end,
      'policy_version_id', null,
      'policy_disposition', null
    );
  end if;

  if event_row.status = 'rescheduled' then
    return jsonb_build_object(
      'lesson_event_id', event_row.id,
      'state', 'resolved',
      'disposition', 'waive',
      'reason_code', 'rescheduled_original',
      'policy_version_id', null,
      'policy_disposition', null
    );
  end if;

  select
    version.id as policy_version_id,
    rules.timely_cancel_disposition,
    rules.late_cancel_disposition,
    rules.no_show_disposition,
    rules.teacher_cancel_disposition
  into policy_row
  from public.school_policies policy
  join public.school_policy_versions version
    on version.school_id = policy.school_id
   and version.policy_id = policy.id
  join public.cancellation_policy_rules rules
    on rules.policy_version_id = version.id
  where policy.school_id = event_row.school_id
    and policy.kind = 'cancellation'
    and policy.status = 'active'
    and policy.id = coalesce(
      (
        select selection.policy_id
        from public.service_product_policy_selections selection
        where selection.school_id = event_row.school_id
          and selection.product_id = event_row.product_id
          and selection.policy_kind = 'cancellation'
          and not selection.use_school_default
      ),
      (
        select default_policy.id
        from public.school_policies default_policy
        where default_policy.school_id = event_row.school_id
          and default_policy.kind = 'cancellation'
          and default_policy.status = 'active'
          and default_policy.is_default
      )
    )
    and version.published_at is not null
    and coalesce(version.effective_from, version.published_at) <= event_row.starts_at
  order by coalesce(version.effective_from, version.published_at) desc, version.version_number desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'lesson_event_id', event_row.id,
      'state', 'owner_review',
      'disposition', 'owner_review',
      'reason_code', 'missing_effective_cancellation_policy',
      'policy_version_id', null,
      'policy_disposition', null
    );
  end if;

  if event_row.status = 'no_show' or event_row.outcome = 'no_show' then
    raw_disposition := policy_row.no_show_disposition;
    reason_code := 'student_no_show';
  elsif event_row.status = 'cancelled' and event_row.outcome = 'teacher_cancelled' then
    raw_disposition := policy_row.teacher_cancel_disposition;
    reason_code := 'teacher_cancelled';
  elsif event_row.status = 'cancelled'
    and event_row.outcome = 'student_cancelled'
    and event_row.cancellation_timing = 'late'
  then
    raw_disposition := policy_row.late_cancel_disposition;
    reason_code := 'late_student_cancellation';
  elsif event_row.status = 'cancelled'
    and event_row.outcome = 'student_cancelled'
    and event_row.cancellation_timing = 'timely'
  then
    raw_disposition := policy_row.timely_cancel_disposition;
    reason_code := 'timely_student_cancellation';
  else
    return jsonb_build_object(
      'lesson_event_id', event_row.id,
      'state', 'owner_review',
      'disposition', 'owner_review',
      'reason_code', 'ambiguous_lesson_outcome',
      'policy_version_id', policy_row.policy_version_id,
      'policy_disposition', null
    );
  end if;

  disposition := case raw_disposition
    when 'charge' then 'charge'
    when 'waive' then 'waive'
    when 'credit' then 'credit'
    when 'refund' then 'credit'
    when 'makeup' then 'waive'
    else 'owner_review'
  end;

  return jsonb_build_object(
    'lesson_event_id', event_row.id,
    'state', case when disposition = 'owner_review' then 'owner_review' else 'resolved' end,
    'disposition', disposition,
    'reason_code', reason_code,
    'policy_version_id', policy_row.policy_version_id,
    'policy_disposition', raw_disposition
  );
end;
$$;

revoke all on function public.compute_lesson_event_billing_disposition(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.compute_lesson_event_billing_disposition(uuid, uuid, timestamptz) to service_role;

create or replace function public.preview_lesson_event_billing_disposition(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_school_role(p_school_id, array['owner','admin']) then
    raise exception 'permission_denied';
  end if;

  return public.compute_lesson_event_billing_disposition(
    p_school_id,
    p_lesson_event_id,
    p_as_of
  );
end;
$$;

revoke all on function public.preview_lesson_event_billing_disposition(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.preview_lesson_event_billing_disposition(uuid, uuid, timestamptz) to authenticated;

comment on function public.preview_lesson_event_billing_disposition(uuid, uuid, timestamptz) is
  'Owner/admin-only deterministic preview. It performs no write and creates no billing line item.';
