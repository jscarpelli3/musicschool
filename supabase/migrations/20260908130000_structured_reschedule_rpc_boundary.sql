create function public.reschedule_lesson_as_owner_v2(
  p_school_id uuid,p_lesson_event_id uuid,p_teacher_id uuid,p_place_id uuid,
  p_local_start timestamp without time zone,p_source text,p_reason_code text,
  p_reason_detail text default null,p_allow_outside_availability boolean default false
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare encoded_reason text;
begin
  if p_reason_code not in('family_request','teacher_request','school_closure','illness','schedule_conflict','other')
    or (p_reason_code='other' and nullif(trim(coalesce(p_reason_detail,'')),'') is null)
    or length(coalesce(p_reason_detail,''))>400
  then raise exception 'invalid_reschedule_reason'; end if;
  encoded_reason:=p_reason_code||'::'||coalesce(trim(p_reason_detail),'');
  return public.reschedule_lesson_as_owner(
    p_school_id,p_lesson_event_id,p_teacher_id,p_place_id,p_local_start,p_source,
    encoded_reason,p_allow_outside_availability
  );
end
$$;

create function public.propose_or_reschedule_assigned_lesson_as_teacher_v2(
  p_school_id uuid,p_lesson_event_id uuid,p_local_start timestamp without time zone,
  p_reason_code text,p_reason_detail text default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare encoded_reason text;
begin
  if p_reason_code not in('family_request','teacher_request','school_closure','illness','schedule_conflict','other')
    or (p_reason_code='other' and nullif(trim(coalesce(p_reason_detail,'')),'') is null)
    or length(coalesce(p_reason_detail,''))>400
  then raise exception 'invalid_reschedule_reason'; end if;
  encoded_reason:=p_reason_code||'::'||coalesce(trim(p_reason_detail),'');
  return public.propose_or_reschedule_assigned_lesson_as_teacher(
    p_school_id,p_lesson_event_id,p_local_start,encoded_reason
  );
end
$$;

revoke all on function public.reschedule_lesson_as_owner(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,boolean)
  from authenticated;
revoke all on function public.propose_or_reschedule_assigned_lesson_as_teacher(uuid,uuid,timestamp without time zone,text)
  from authenticated;
revoke all on function public.reschedule_lesson_as_owner_v2(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,text,boolean)
  from public,anon;
revoke all on function public.propose_or_reschedule_assigned_lesson_as_teacher_v2(uuid,uuid,timestamp without time zone,text,text)
  from public,anon;
grant execute on function public.reschedule_lesson_as_owner_v2(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,text,boolean)
  to authenticated;
grant execute on function public.propose_or_reschedule_assigned_lesson_as_teacher_v2(uuid,uuid,timestamp without time zone,text,text)
  to authenticated;

comment on function public.reschedule_lesson_as_owner_v2(uuid,uuid,uuid,uuid,timestamp without time zone,text,text,text,boolean) is
  'Structured public reschedule boundary. Reason code and free-form detail are independent inputs.';
