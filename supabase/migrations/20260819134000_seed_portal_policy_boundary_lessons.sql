do $$ declare account_row record; target_student_id uuid; template public.lesson_events%rowtype;
begin
  select portal_auth.school_id,portal_auth.billing_account_id into account_row
  from public.payer_portal_authorizations portal_auth
  where portal_auth.normalized_email='elscarpo@gmail.com';
  if not found then raise exception 'Davis portal test payer was not found'; end if;
  select mapping.student_id into target_student_id from public.billing_account_students mapping
  where mapping.school_id=account_row.school_id and mapping.billing_account_id=account_row.billing_account_id
  order by mapping.student_id limit 1;
  select event.* into template from public.lesson_events event
  where event.school_id=account_row.school_id and event.student_id=target_student_id
  order by event.starts_at desc limit 1;
  if not found then raise exception 'Portal test student has no lesson template'; end if;
  if not exists(select 1 from public.lesson_events event where event.school_id=account_row.school_id and event.student_id=target_student_id and event.notes='Portal policy test · inside 24-hour window') then
    insert into public.lesson_events(school_id,student_id,teacher_id,product_id,place_id,starts_at,ends_at,status,notes,created_by)
    values(account_row.school_id,target_student_id,template.teacher_id,template.product_id,template.place_id,
      date_trunc('hour',now())+interval '12 hours',date_trunc('hour',now())+interval '12 hours'+(template.ends_at-template.starts_at),
      'scheduled','Portal policy test · inside 24-hour window',template.created_by);
  end if;
  if not exists(select 1 from public.lesson_events event where event.school_id=account_row.school_id and event.student_id=target_student_id and event.notes='Portal policy test · outside 24-hour window') then
    insert into public.lesson_events(school_id,student_id,teacher_id,product_id,place_id,starts_at,ends_at,status,notes,created_by)
    values(account_row.school_id,target_student_id,template.teacher_id,template.product_id,template.place_id,
      date_trunc('hour',now())+interval '36 hours',date_trunc('hour',now())+interval '36 hours'+(template.ends_at-template.starts_at),
      'scheduled','Portal policy test · outside 24-hour window',template.created_by);
  end if;
end $$;
