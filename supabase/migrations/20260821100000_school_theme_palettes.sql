alter table public.schools
  add column theme_key text not null default 'midnight'
  check (theme_key in ('midnight', 'conservatory', 'aubergine', 'ember', 'monochrome'));

grant update (theme_key) on public.schools to authenticated;

create or replace function public.require_owner_for_school_theme_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.theme_key is distinct from old.theme_key
    and (select auth.uid()) is not null
    and not public.has_school_role(old.id, array['owner'])
  then
    raise exception 'Only the school owner can change the workspace palette.';
  end if;

  return new;
end;
$$;

create trigger schools_require_owner_for_theme_change
before update of theme_key on public.schools
for each row execute function public.require_owner_for_school_theme_change();

comment on column public.schools.theme_key is
  'Constrained, platform-defined workspace palette selected by the school owner.';
