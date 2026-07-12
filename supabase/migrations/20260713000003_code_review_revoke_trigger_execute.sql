-- Revoke RPC EXECUTE on trigger-only functions (security advisor)

revoke all on function public.profiles_guard_sensitive_columns() from public;
revoke all on function public.enforce_invite_limits() from public;
revoke all on function public.enforce_location_limits() from public;

revoke all on function public.profiles_guard_sensitive_columns() from anon, authenticated;
revoke all on function public.enforce_invite_limits() from anon, authenticated;
revoke all on function public.enforce_location_limits() from anon, authenticated;
