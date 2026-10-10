begin;

-- Fixed, caller-bound checks bypass RLS solely to avoid recursive policies.
create function private.current_role()
returns public.user_role language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;
create function private.is_assigned_trainee(p_trainee_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.coach_trainees
    where coach_id = (select auth.uid()) and trainee_id = p_trainee_id)
$$;
revoke all on function private.current_role(), private.is_assigned_trainee(uuid)
  from public, anon, service_role, supabase_auth_admin;
grant usage on schema private to authenticated;
grant execute on function private.current_role(), private.is_assigned_trainee(uuid) to authenticated;
comment on function private.current_role() is 'Caller-bound persisted role check; no user-supplied identity and no metadata roles.';
comment on function private.is_assigned_trainee(uuid) is 'Only checks whether the current authenticated identity coaches the given trainee. No arbitrary query capability.';

grant select on public.profiles, public.coach_trainees, public.daily_steps, public.step_targets to authenticated;
grant insert(trainee_id,date,steps), update(steps) on public.daily_steps to authenticated;
grant insert(trainee_id,target_steps,effective_from,created_by) on public.step_targets to authenticated;
-- Hashes cannot be selected, including via SELECT * or the Data API.
grant select(id,email,role,coach_id,invited_by,expires_at,accepted_at,created_at,initial_target_steps)
  on public.invitations to authenticated;
grant insert(email,role,token_hash,coach_id,invited_by,expires_at,initial_target_steps)
  on public.invitations to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (select private.current_role()) = 'admin' or private.is_assigned_trainee(id)
);
create policy relationships_read on public.coach_trainees for select to authenticated using (
  coach_id = (select auth.uid()) or trainee_id = (select auth.uid()) or (select private.current_role()) = 'admin'
);
create policy steps_read on public.daily_steps for select to authenticated using (
  (trainee_id = (select auth.uid()) and (select private.current_role()) = 'trainee')
  or private.is_assigned_trainee(trainee_id) or (select private.current_role()) = 'admin'
);
create policy steps_insert on public.daily_steps for insert to authenticated with check (
  trainee_id = (select auth.uid()) and (select private.current_role()) = 'trainee'
);
create policy steps_update on public.daily_steps for update to authenticated
  using (trainee_id = (select auth.uid()) and (select private.current_role()) = 'trainee')
  with check (trainee_id = (select auth.uid()) and (select private.current_role()) = 'trainee');

create policy targets_read on public.step_targets for select to authenticated using (
  (trainee_id = (select auth.uid()) and (select private.current_role()) = 'trainee')
  or private.is_assigned_trainee(trainee_id) or (select private.current_role()) = 'admin'
);
create policy targets_insert on public.step_targets for insert to authenticated with check (
  (select private.current_role()) = 'coach' and private.is_assigned_trainee(trainee_id)
  and created_by = (select auth.uid())
);
create policy invitations_read on public.invitations for select to authenticated using (
  (select private.current_role()) = 'admin'
  or ((select private.current_role()) = 'coach' and invited_by = (select auth.uid()))
);
create policy invitations_insert on public.invitations for insert to authenticated with check (
  invited_by = (select auth.uid()) and (
    ((select private.current_role()) = 'admin' and role = 'coach' and coach_id is null and initial_target_steps is null)
    or ((select private.current_role()) = 'coach' and role = 'trainee' and coach_id = (select auth.uid()) and initial_target_steps > 0)
  )
);

commit;
