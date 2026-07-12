-- A1: Prevent privilege escalation via profiles self-update (CODE-REVIEW-2026-07)

drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and clinic_id = (select current_clinic_id())
  and role = (
    select p.role from public.profiles p where p.id = (select auth.uid())
  )
  and is_active = (
    select p.is_active from public.profiles p where p.id = (select auth.uid())
  )
  and clinic_id = (
    select p.clinic_id from public.profiles p where p.id = (select auth.uid())
  )
);

create or replace function public.profiles_guard_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception 'profile_clinic_id_immutable' using errcode = '42501';
  end if;

  if new.id = (select auth.uid()) then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active then
      raise exception 'profile_self_privilege_escalation' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_sensitive_columns on public.profiles;

create trigger profiles_guard_sensitive_columns
before update on public.profiles
for each row
execute function public.profiles_guard_sensitive_columns();

revoke update on public.profiles from authenticated;

grant update (full_name) on public.profiles to authenticated;
grant update (role, is_active, full_name) on public.profiles to authenticated;

revoke all on function public.profiles_guard_sensitive_columns() from public;
revoke all on function public.profiles_guard_sensitive_columns() from anon, authenticated;

comment on function public.profiles_guard_sensitive_columns() is
  'Blocks self role/is_active escalation and any clinic_id change (A1 / CODE-REVIEW-2026-07).';
