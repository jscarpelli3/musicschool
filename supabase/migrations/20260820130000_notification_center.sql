alter table public.owner_notifications add column archived_at timestamptz;
create index owner_notifications_recipient_active_idx on public.owner_notifications(recipient_profile_id,created_at desc) where archived_at is null;
create or replace function public.manage_my_notifications(p_school_id uuid,p_notification_ids uuid[],p_action text)
returns integer language plpgsql volatile security definer set search_path='' as $$
declare changed integer;
begin
  if auth.uid() is null or p_action not in ('read','unread','archive','restore') or coalesce(array_length(p_notification_ids,1),0) not between 1 and 100 then raise exception 'invalid_notification_action'; end if;
  update public.owner_notifications notification set
    read_at=case when p_action='read' then coalesce(notification.read_at,now()) when p_action='unread' then null else notification.read_at end,
    archived_at=case when p_action='archive' then coalesce(notification.archived_at,now()) when p_action='restore' then null else notification.archived_at end
  where notification.school_id=p_school_id and notification.recipient_profile_id=auth.uid() and notification.id=any(p_notification_ids);
  get diagnostics changed=row_count; return changed;
end $$;
revoke all on function public.manage_my_notifications(uuid,uuid[],text) from public,anon;
grant execute on function public.manage_my_notifications(uuid,uuid[],text) to authenticated;
do $$ begin if has_function_privilege('anon','public.manage_my_notifications(uuid,uuid[],text)','EXECUTE') then raise exception 'Anonymous notification management escaped'; end if; end $$;
