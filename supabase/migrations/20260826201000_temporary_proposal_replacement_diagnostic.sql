create or replace function public.diagnose_proposal_replacement(p_proposal_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare proposal public.lesson_schedule_proposals%rowtype; result jsonb; diagnosis text;
begin
 select * into proposal from public.lesson_schedule_proposals where id=p_proposal_id;
 if not found then return 'proposal_not_found'; end if;
 begin
   perform set_config('request.jwt.claim.sub',proposal.created_by::text,true);
   result:=public.manage_own_lesson_schedule_proposal(proposal.school_id,proposal.id,'replace',proposal.proposed_local_start+interval '5 minutes',proposal.reason);
   raise exception 'diagnostic_rollback:%',result::text;
 exception when others then
   diagnosis:=sqlstate||':'||sqlerrm;
 end;
 return diagnosis;
end $$;
revoke all on function public.diagnose_proposal_replacement(uuid) from public,anon,authenticated;
grant execute on function public.diagnose_proposal_replacement(uuid) to service_role;
