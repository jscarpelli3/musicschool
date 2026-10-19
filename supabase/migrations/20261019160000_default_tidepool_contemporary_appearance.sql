alter table public.schools alter column theme_key set default 'tidepool';
alter table public.schools alter column font_key set default 'contemporary';

comment on column public.schools.theme_key is
  'School workspace palette. New schools default to Tidepool; existing explicit choices are preserved.';
comment on column public.schools.font_key is
  'School workspace typography. New schools default to Contemporary; existing explicit choices are preserved.';
