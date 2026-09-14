alter table public.schools drop constraint if exists schools_font_key_check;

alter table public.schools add constraint schools_font_key_check
check (font_key in (
  'editorial',
  'grotesk',
  'swiss',
  'traditional',
  'contemporary',
  'expressive',
  'literary',
  'monospace'
));
