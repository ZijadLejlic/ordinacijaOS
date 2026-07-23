-- DentOrd — idempotent seed: plans / limits / entitlements (QA Implementation-Plan.md P0.3)
--
-- Loaded automatically by `supabase db reset` (see supabase/config.toml [db.seed]).
-- Safe to re-run any number of times (upsert by natural key, never by generated id) —
-- matches the "idempotent seed used by `db reset`" exit criterion.
--
-- Values verified 2026-07-23 against the live Supabase project via MCP `execute_sql`
-- (read-only) to guarantee local/CI parity with remote `phase1_plans_and_entitlements`.
-- Source of truth for intent: docs/PRD-OrdinacijaOS.md §4.1–§4.3 (D2, D8, D22, D42);
-- source of truth for feature keys: lib/entitlements/features.ts `FEATURE_KEYS`;
-- public marketing mirror: lib/marketing/plans.ts (keep all three in sync — see
-- lib/marketing/plans.test.ts which asserts the marketing matrix, and update this file
-- + that test together if the PRD feature matrix ever changes).
--
-- Does NOT seed any clinic/profile/auth rows — that is out of scope for P0.3; see
-- lib/security/factories.ts (P0.9) / scripts/seed-demo-clinic.ts for clinic fixtures.

begin;

-- 1) Plans + hard limits (PRD §4.1 pricing, §4.2 limits — D8 hard block, D22 images).
insert into public.plans (code, name, price_eur_monthly, limits_json, is_active, sort_order)
values
  (
    'starter',
    'Starter',
    15.00,
    jsonb_build_object(
      'users', 3,
      'doctors', 2,
      'locations', 1,
      'images_per_patient', 10
    ),
    true,
    1
  ),
  (
    'professional',
    'Professional',
    25.00,
    jsonb_build_object(
      'users', 10,
      'doctors', 5,
      'locations', 2,
      'images_per_patient', 20
    ),
    true,
    2
  ),
  (
    'premium_ai',
    'Premium AI',
    35.00,
    jsonb_build_object(
      'users', 25,
      'doctors', 10,
      'locations', 5,
      'images_per_patient', 30
    ),
    true,
    3
  ),
  (
    'enterprise',
    'Enterprise',
    60.00,
    jsonb_build_object(
      'users', null,
      'doctors', null,
      'locations', null,
      'images_per_patient', 40
    ),
    true,
    4
  )
on conflict (code) do update set
  name = excluded.name,
  price_eur_monthly = excluded.price_eur_monthly,
  limits_json = excluded.limits_json,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 2) Feature entitlement matrix (PRD §4.3). One row per (plan, feature_key); must cover
-- every key in lib/entitlements/features.ts FEATURE_KEYS for every plan (21 x 4 = 84 rows).
with matrix (code, feature_key, enabled, is_metered) as (
  values
    -- Starter
    ('starter', 'patients_chart', true, false),
    ('starter', 'odontogram', true, false),
    ('starter', 'treatment_plan', true, false),
    ('starter', 'calendar_basic', true, false),
    ('starter', 'calendar_advanced', false, false),
    ('starter', 'invoices', true, false),
    ('starter', 'expenses_reports_excel', false, false),
    ('starter', 'installments_calculator', false, false),
    ('starter', 'email_reminders', true, false),
    ('starter', 'branding_custom', false, false),
    ('starter', 'crm_light', false, false),
    ('starter', 'waitlist_auto', false, false),
    ('starter', 'consent_draw_sign', false, false),
    ('starter', 'inventory_basic', false, false),
    ('starter', 'sms_whatsapp', false, true),
    ('starter', 'ai_copilot', false, true),
    ('starter', 'patient_portal', false, false),
    ('starter', 'mini_website', false, false),
    ('starter', 'online_booking', false, false),
    ('starter', 'lab_technician', false, false),
    ('starter', 'marketing_campaigns', false, false),
    -- Professional (free-trial-2026 baseline; see FREE_PERIOD_DISABLED_FEATURES app override)
    ('professional', 'patients_chart', true, false),
    ('professional', 'odontogram', true, false),
    ('professional', 'treatment_plan', true, false),
    ('professional', 'calendar_basic', true, false),
    ('professional', 'calendar_advanced', true, false),
    ('professional', 'invoices', true, false),
    ('professional', 'expenses_reports_excel', true, false),
    ('professional', 'installments_calculator', true, false),
    ('professional', 'email_reminders', true, false),
    ('professional', 'branding_custom', true, false),
    ('professional', 'crm_light', true, false),
    ('professional', 'waitlist_auto', true, false),
    ('professional', 'consent_draw_sign', true, false),
    ('professional', 'inventory_basic', true, false),
    ('professional', 'sms_whatsapp', true, true),
    ('professional', 'ai_copilot', false, true),
    ('professional', 'patient_portal', false, false),
    ('professional', 'mini_website', false, false),
    ('professional', 'online_booking', false, false),
    ('professional', 'lab_technician', false, false),
    ('professional', 'marketing_campaigns', false, false),
    -- Premium AI
    ('premium_ai', 'patients_chart', true, false),
    ('premium_ai', 'odontogram', true, false),
    ('premium_ai', 'treatment_plan', true, false),
    ('premium_ai', 'calendar_basic', true, false),
    ('premium_ai', 'calendar_advanced', true, false),
    ('premium_ai', 'invoices', true, false),
    ('premium_ai', 'expenses_reports_excel', true, false),
    ('premium_ai', 'installments_calculator', true, false),
    ('premium_ai', 'email_reminders', true, false),
    ('premium_ai', 'branding_custom', true, false),
    ('premium_ai', 'crm_light', true, false),
    ('premium_ai', 'waitlist_auto', true, false),
    ('premium_ai', 'consent_draw_sign', true, false),
    ('premium_ai', 'inventory_basic', true, false),
    ('premium_ai', 'sms_whatsapp', true, true),
    ('premium_ai', 'ai_copilot', true, true),
    ('premium_ai', 'patient_portal', false, false),
    ('premium_ai', 'mini_website', false, false),
    ('premium_ai', 'online_booking', false, false),
    ('premium_ai', 'lab_technician', false, false),
    ('premium_ai', 'marketing_campaigns', false, false),
    -- Enterprise
    ('enterprise', 'patients_chart', true, false),
    ('enterprise', 'odontogram', true, false),
    ('enterprise', 'treatment_plan', true, false),
    ('enterprise', 'calendar_basic', true, false),
    ('enterprise', 'calendar_advanced', true, false),
    ('enterprise', 'invoices', true, false),
    ('enterprise', 'expenses_reports_excel', true, false),
    ('enterprise', 'installments_calculator', true, false),
    ('enterprise', 'email_reminders', true, false),
    ('enterprise', 'branding_custom', true, false),
    ('enterprise', 'crm_light', true, false),
    ('enterprise', 'waitlist_auto', true, false),
    ('enterprise', 'consent_draw_sign', true, false),
    ('enterprise', 'inventory_basic', true, false),
    ('enterprise', 'sms_whatsapp', true, true),
    ('enterprise', 'ai_copilot', true, true),
    ('enterprise', 'patient_portal', true, false),
    ('enterprise', 'mini_website', true, false),
    ('enterprise', 'online_booking', true, false),
    ('enterprise', 'lab_technician', true, false),
    ('enterprise', 'marketing_campaigns', true, false)
)
insert into public.plan_entitlements (plan_id, feature_key, enabled, is_metered)
select p.id, m.feature_key, m.enabled, m.is_metered
from matrix m
join public.plans p on p.code = m.code
on conflict (plan_id, feature_key) do update set
  enabled = excluded.enabled,
  is_metered = excluded.is_metered;

commit;

-- Sanity check (fails `db reset` loudly instead of leaving a silently incomplete seed):
-- every plan must end up with exactly one row per FEATURE_KEYS entry (21 today).
do $$
declare
  v_bad_plan text;
  v_count int;
begin
  for v_bad_plan, v_count in
    select p.code, count(*)
    from public.plans p
    join public.plan_entitlements pe on pe.plan_id = p.id
    group by p.code
    having count(*) <> 21
  loop
    raise exception 'seed.sql: plan % has % plan_entitlements rows, expected 21', v_bad_plan, v_count;
  end loop;
end $$;
