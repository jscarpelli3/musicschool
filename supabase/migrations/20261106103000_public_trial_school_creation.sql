create function public.create_trial_school(school_name text,school_timezone text default 'America/Chicago')
returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();new_school_id uuid;existing_school_id uuid;base_slug text;generated_slug text;
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id and email_confirmed_at is not null) then raise exception 'verified_authentication_required'; end if;
 if length(trim(school_name)) not between 1 and 120 then raise exception 'invalid_school_name'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=school_timezone) then raise exception 'invalid_timezone'; end if;
 select school_id into existing_school_id from public.school_members where profile_id=actor_id and status='active' order by joined_at limit 1;
 if existing_school_id is not null then return existing_school_id; end if;
 insert into public.profiles(id,email) select id,email from auth.users where id=actor_id on conflict(id) do nothing;
 base_slug:=trim(both '-' from lower(regexp_replace(trim(school_name),'[^a-zA-Z0-9]+','-','g')));if base_slug='' then base_slug:='school';end if;
 generated_slug:=base_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
 insert into public.schools(name,slug,timezone,created_by) values(trim(school_name),generated_slug,school_timezone,actor_id) returning id into new_school_id;
 insert into public.school_members(school_id,profile_id,role,status,joined_at) values(new_school_id,actor_id,'owner','active',now());
 insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata) values(new_school_id,actor_id,'school.created_from_public_trial','school',new_school_id,jsonb_build_object('billing_terms','standard'));
 return new_school_id;
end;$$;
revoke all on function public.create_trial_school(text,text) from public,anon;
grant execute on function public.create_trial_school(text,text) to authenticated;
