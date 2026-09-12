create or replace function public.assign_mandate_charge_categories()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.permitted_charge_categories is null then
    new.permitted_charge_categories:=array(
      select category.code from public.billing_charge_categories category
      where category.active and category.automatic_charge_eligible order by category.display_order,category.code
    );
  end if;
  if cardinality(new.permitted_charge_categories)=0 or exists(
    select 1 from unnest(new.permitted_charge_categories) as selected(code_value)
    left join public.billing_charge_categories category on category.code=selected.code_value
    where category.code is null or not category.active or not category.automatic_charge_eligible
  ) then raise exception 'invalid_mandate_charge_categories'; end if;
  return new;
end;
$$;
revoke all on function public.assign_mandate_charge_categories() from public,anon,authenticated;
