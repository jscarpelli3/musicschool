-- Verify fan-out and deduplication without retaining notifications.
do $$
declare request_row public.billing_approval_requests%rowtype; recipient_count integer; notification_count integer; outbox_count integer;
begin
  begin
    select * into strict request_row from public.billing_approval_requests order by created_at desc limit 1;
    select count(*) into recipient_count from public.school_members member join public.profiles profile on profile.id=member.profile_id
      where member.school_id=request_row.school_id and member.status='active' and member.role in ('owner','admin');
    perform public.queue_payer_response_notifications(request_row,'payer_approved',null);
    perform public.queue_payer_response_notifications(request_row,'payer_approved',null);
    select count(*) into notification_count from public.owner_notifications where entity_id=request_row.id and kind='payer_approved';
    select count(*) into outbox_count from public.owner_notification_email_outbox outbox join public.owner_notifications notice on notice.id=outbox.notification_id
      where notice.entity_id=request_row.id and notice.kind='payer_approved';
    if notification_count<>recipient_count then raise exception 'notification_fanout_failed:%:%',notification_count,recipient_count; end if;
    if outbox_count>(select count(*) from public.school_members member join public.profiles profile on profile.id=member.profile_id where member.school_id=request_row.school_id and member.status='active' and member.role in ('owner','admin') and nullif(trim(profile.email),'') is not null) then raise exception 'notification_email_dedupe_failed'; end if;
    raise exception using errcode='P0001',message='owner_notifications_verification_rollback';
  exception when raise_exception then if sqlerrm<>'owner_notifications_verification_rollback' then raise; end if; end;
end; $$;
