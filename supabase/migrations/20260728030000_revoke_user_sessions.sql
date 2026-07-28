-- D-22 fix: Auth Admin signOut(jwt) cannot revoke by user id.
-- Owner force-logout / deactivate need a service_role-only path that deletes
-- auth.sessions for one user (refresh_tokens CASCADE via session_id FK).

create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22004';
  end if;

  delete from auth.sessions where user_id = p_user_id;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public;
revoke all on function public.revoke_user_sessions(uuid) from anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

comment on function public.revoke_user_sessions(uuid) is
  'Revoke all GoTrue sessions for one auth user (owner force-logout / deactivate, D12). service_role only — SA enforces owner gate first.';
