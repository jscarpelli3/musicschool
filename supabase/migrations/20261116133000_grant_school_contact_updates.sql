-- School contact fields were added after authenticated school updates were
-- narrowed to an explicit column allowlist. Keep the existing owner/admin RLS
-- boundary and permit those fields through the table privilege layer.

grant update (
  phone,
  address_line_1,
  address_line_2,
  city,
  region,
  postal_code
) on public.schools to authenticated;

do $$
declare
  column_name text;
begin
  foreach column_name in array array[
    'phone',
    'address_line_1',
    'address_line_2',
    'city',
    'region',
    'postal_code'
  ]
  loop
    if not has_column_privilege('authenticated', 'public.schools', column_name, 'UPDATE') then
      raise exception 'authenticated update privilege is missing for schools.%', column_name;
    end if;
  end loop;
end
$$;
