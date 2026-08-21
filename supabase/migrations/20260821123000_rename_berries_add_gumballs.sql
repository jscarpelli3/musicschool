alter table public.schools
  drop constraint if exists schools_theme_key_check;

update public.schools
set theme_key = 'berries'
where theme_key = 'bubblegum';

alter table public.schools
  add constraint schools_theme_key_check
  check (theme_key in (
    'midnight',
    'conservatory',
    'paper',
    'ember',
    'monochrome',
    'orchid',
    'tidepool',
    'lemonade',
    'berries',
    'gumballs'
  ));
