-- Per-user, per-school UI preferences that follow a member across devices.

create table public.user_view_preferences (
  school_id uuid not null,
  profile_id uuid not null,
  view_key text not null check (view_key ~ '^[a-z0-9_]+$'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school_id, profile_id, view_key),
  foreign key (school_id, profile_id)
    references public.school_members(school_id, profile_id) on delete cascade
);

create trigger user_view_preferences_set_updated_at
before update on public.user_view_preferences
for each row execute function public.set_updated_at();

alter table public.user_view_preferences enable row level security;

create policy user_view_preferences_select_own
on public.user_view_preferences for select to authenticated
using (profile_id = (select auth.uid()) and public.is_school_member(school_id));

create policy user_view_preferences_insert_own
on public.user_view_preferences for insert to authenticated
with check (profile_id = (select auth.uid()) and public.is_school_member(school_id));

create policy user_view_preferences_update_own
on public.user_view_preferences for update to authenticated
using (profile_id = (select auth.uid()) and public.is_school_member(school_id))
with check (profile_id = (select auth.uid()) and public.is_school_member(school_id));

create policy user_view_preferences_delete_own
on public.user_view_preferences for delete to authenticated
using (profile_id = (select auth.uid()) and public.is_school_member(school_id));

grant select, insert, update, delete on public.user_view_preferences to authenticated;
