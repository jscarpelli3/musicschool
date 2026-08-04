-- Limit authenticated writes to intentionally mutable columns.

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, phone) on public.profiles to authenticated;

revoke update on public.schools from authenticated;
grant update (
  name,
  timezone,
  currency,
  family_billing_mode,
  logo_path,
  primary_color
) on public.schools to authenticated;

revoke all on function public.is_school_member(uuid) from public;
revoke all on function public.has_school_role(uuid, text[]) from public;
revoke all on function public.shares_school_with(uuid) from public;

grant execute on function public.is_school_member(uuid) to authenticated;
grant execute on function public.has_school_role(uuid, text[]) to authenticated;
grant execute on function public.shares_school_with(uuid) to authenticated;
