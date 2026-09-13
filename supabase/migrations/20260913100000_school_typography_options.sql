alter table public.schools add column font_key text not null default 'editorial'
check(font_key in ('editorial','grotesk','swiss','traditional'));

grant update(font_key) on public.schools to authenticated;

create or replace function public.require_owner_for_school_theme_change()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.theme_key is distinct from old.theme_key or new.font_key is distinct from old.font_key)
    and (select auth.uid()) is not null
    and not public.has_school_capability(old.id,'school.appearance.palette_manage')
  then raise exception 'Only the school owner can change shared appearance settings.'; end if;
  return new;
end;
$$;

drop trigger schools_require_owner_for_theme_change on public.schools;
create trigger schools_require_owner_for_theme_change
before update of theme_key,font_key on public.schools
for each row execute function public.require_owner_for_school_theme_change();

comment on column public.schools.font_key is
  'Constrained, platform-defined typography pairing selected by the school owner.';
