alter table public.family_service_locations
  drop constraint if exists family_service_locations_address_shape;

alter table public.family_service_locations
  add constraint family_service_locations_address_shape check (
    (status = 'active' and mode = 'stored'
      and length(trim(address_line_1)) between 1 and 160
      and length(trim(city)) between 1 and 120)
    or
    (status = 'active' and mode = 'arranged_privately'
      and address_line_1 is null and address_line_2 is null
      and city is null and region is null and postal_code is null and access_notes is null)
    or
    (status = 'retired'
      and address_line_1 is null and address_line_2 is null and city is null
      and region is null and postal_code is null and access_notes is null)
  );

comment on table public.family_service_locations is
  'Private family locations for in-home lessons. The product collects only street address and city; legacy optional address columns remain for existing records.';
