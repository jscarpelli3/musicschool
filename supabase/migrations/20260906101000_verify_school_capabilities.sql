do $$
begin
  if (select count(*) from public.school_capabilities)<>15 then
    raise exception 'school_capability_catalog_incomplete';
  end if;
  if (select count(*) from public.school_role_capability_defaults where role='owner')<>15
    or (select count(*) from public.school_role_capability_defaults where role='admin')<>13
    or (select count(*) from public.school_role_capability_defaults where role='teacher')<>2
    or (select count(*) from public.school_role_capability_defaults where role='staff')<>1
  then raise exception 'school_capability_role_defaults_incomplete'; end if;
  if has_table_privilege('authenticated','public.school_capabilities','SELECT')
    or has_table_privilege('authenticated','public.school_role_capability_defaults','SELECT')
    or has_table_privilege('authenticated','public.school_member_capability_overrides','SELECT')
    or has_table_privilege('authenticated','public.school_member_capability_overrides','INSERT')
  then raise exception 'school_capability_internals_exposed'; end if;
  if not has_function_privilege('authenticated','public.get_my_school_capabilities(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.has_school_capability(uuid,text)','EXECUTE')
  then raise exception 'school_capability_contract_unavailable'; end if;
end $$;
