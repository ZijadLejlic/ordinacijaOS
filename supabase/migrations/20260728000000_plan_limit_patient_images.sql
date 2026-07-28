-- P1.11 / D-02: Enforce images_per_patient at DB layer (D8 hard block / D22)
-- Mirrors plan_limit_users / plan_limit_doctors / plan_limit_locations.

create or replace function public.enforce_patient_image_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_image_limit int;
  v_images_count int;
begin
  select p.limits_json
  into v_limits
  from public.clinics c
  join public.plans p on p.id = c.plan_id
  where c.id = new.clinic_id;

  if v_limits is null then
    return new;
  end if;

  v_image_limit := nullif(v_limits->>'images_per_patient', '')::int;

  select count(*)::int
  into v_images_count
  from public.patient_images
  where patient_id = new.patient_id;

  if v_image_limit is not null and v_images_count >= v_image_limit then
    raise exception 'plan_limit_images' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists patient_images_enforce_limits on public.patient_images;

create trigger patient_images_enforce_limits
before insert on public.patient_images
for each row
execute function public.enforce_patient_image_limits();

revoke all on function public.enforce_patient_image_limits() from public;
revoke all on function public.enforce_patient_image_limits() from anon, authenticated;

comment on function public.enforce_patient_image_limits() is
  'Hard-block plan images_per_patient limit on patient_images INSERT (D8/D22).';
