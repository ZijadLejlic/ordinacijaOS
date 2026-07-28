import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  resolvePlanId,
  signInAs,
  type AppRole,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P3.5 (docs/QA/Implementation-Plan.md): feature assert on each Pro SA.
 * Closes PLAN-INT-011 / Threat-Model T-RBAC-06 / BR-P03 / D42.
 *
 * Scope (derived from code, not invented): grepped assertFeature /
 * clinicHasFeature across lib server-action modules. Pro-only keys that SAs gate
 * with assertFeature (starter=false, professional=true per seed /
 * plan_entitlements):
 *   - expenses_reports_excel → createExpenseAction (accountant)
 *   - branding_custom → updateBrandingColorsAction (owner)
 *   - crm_light → dismissCrmNotificationAction (reception)
 *   - consent_draw_sign → updateConsentFormAction (owner)
 *   - waitlist_auto → addWaitlistAction (reception)
 *   - calendar_advanced → rescheduleAppointmentAction (reception)
 *
 * Already COVERED elsewhere — not duplicated here:
 *   - inventory_basic → PLAN-SEC-001 (feature-entitlement-bypass.test.ts)
 *   - Excel API expenses_reports_excel → FIN-API-002
 *   - Pure helpers → PLAN-UNIT-*
 *
 * Out of scope (no SA assertFeature, D-03 residual / other IDs):
 *   - Features without SA gates (sms/ai/portal — UI-only or N/A)
 *   - installments_calculator uses clinicHasFeature → FIN-INT-010 (GAP)
 *   - Starter-enabled features (patients_chart, odontogram, …) — no
 *     starter deny path for PLAN-INT-011
 *
 * Pattern: P1.6 / P1.7 / P3.1 SA harness (vi.mock Next + real action +
 * createClinicWithRoles). Each row: starter → featureDisabled;
 * professional → success / past-feature (notFound) proving the gate alone.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

let activeActionClient: DbClient;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => activeActionClient,
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "bs",
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

// crm/actions → email/resend → @/i18n/navigation (getPathname). Same mock as
// rbac-int-matrix / image-limit-db — Vitest cannot resolve next/navigation via
// next-intl createNavigation under this Next version's ESM loader.
vi.mock("@/i18n/navigation", () => ({
  redirect: () => {
    throw new Error("unexpected redirect in PLAN-INT-011");
  },
  getPathname: () => "/",
  Link: () => null,
  usePathname: () => "/",
  useRouter: () => ({ push: () => undefined }),
}));

import {
  addWaitlistAction,
  createAppointmentAction,
  rescheduleAppointmentAction,
} from "@/lib/appointments/actions";
import { updateBrandingColorsAction } from "@/lib/branding/actions";
import { updateConsentFormAction } from "@/lib/consent/actions";
import { dismissCrmNotificationAction } from "@/lib/crm/actions";
import { createExpenseAction } from "@/lib/expenses/actions";

type ActionResult = { error?: string; message?: string } | null;

type FeatureRow = {
  feature: string;
  label: string;
  role: AppRole;
  /** Starter clinic must return this (assertFeature deny). */
  starterError: "featureDisabled";
  /** Professional: success message, or past-feature error proving gate cleared. */
  proOk: (result: ActionResult) => boolean;
  run: (clinic: "starter" | "pro") => Promise<ActionResult>;
};

const FAKE_UUID = "00000000-0000-4000-8000-000000000099";

describeSecurity(
  "P3.5 PLAN-INT-011 assertFeature on Pro SA paths (starter deny / pro allow)",
  () => {
    let url: string;
    let anonKey: string;
    let serviceKey: string;
    let service: DbClient;

    let starterClinicId: string;
    let proClinicId: string;
    let starterByRole: Partial<Record<AppRole, TestUser>>;
    let proByRole: Partial<Record<AppRole, TestUser>>;
    let starterClients: Partial<Record<AppRole, DbClient>>;
    let proClients: Partial<Record<AppRole, DbClient>>;
    let starterPatientId: string;
    let proPatientId: string;
    let proAppointmentId: string;

    const created: TestUser[] = [];

    const PRO_FEATURES_OFF_ON_STARTER = [
      "expenses_reports_excel",
      "branding_custom",
      "crm_light",
      "consent_draw_sign",
      "waitlist_auto",
      "calendar_advanced",
      "inventory_basic",
    ] as const;

    beforeAll(async () => {
      ({ url, anonKey, serviceKey } = env!);
      service = createSupabaseClient(url, serviceKey);

      const starterPlanId = await resolvePlanId(service, "starter");
      const proPlanId = await resolvePlanId(service, "professional");

      for (const feature of PRO_FEATURES_OFF_ON_STARTER) {
        const { data: starterEnt, error: sErr } = await service
          .from("plan_entitlements")
          .select("enabled")
          .eq("plan_id", starterPlanId)
          .eq("feature_key", feature)
          .single();
        if (sErr || !starterEnt) {
          throw new Error(
            sErr?.message ?? `starter entitlement missing: ${feature}`,
          );
        }
        if (starterEnt.enabled) {
          throw new Error(
            `starter unexpectedly has ${feature} enabled — PLAN-INT-011 premise broken`,
          );
        }

        const { data: proEnt, error: pErr } = await service
          .from("plan_entitlements")
          .select("enabled")
          .eq("plan_id", proPlanId)
          .eq("feature_key", feature)
          .single();
        if (pErr || !proEnt) {
          throw new Error(
            pErr?.message ?? `professional entitlement missing: ${feature}`,
          );
        }
        if (!proEnt.enabled) {
          throw new Error(
            `professional unexpectedly lacks ${feature} — PLAN-INT-011 premise broken`,
          );
        }
      }

      const roles: AppRole[] = ["owner", "doctor", "reception", "accountant"];

      const starterClinic = await createClinicWithRoles(service, {
        roles,
        clinicName: `PLAN-INT-011 Starter ${randomTag()}`,
        planCode: "starter",
        emailPrefix: "plan-int",
      });
      starterClinicId = starterClinic.clinicId;
      starterByRole = starterClinic.byRole;
      created.push(...starterClinic.users);

      const proClinic = await createClinicWithRoles(service, {
        roles,
        clinicName: `PLAN-INT-011 Pro ${randomTag()}`,
        planCode: "professional",
        emailPrefix: "plan-int",
      });
      proClinicId = proClinic.clinicId;
      proByRole = proClinic.byRole;
      created.push(...proClinic.users);

      const starterPatient = await createPatient(service, starterClinicId, {
        firstName: "Feature",
        lastName: `S${randomTag().slice(-6)}`,
      });
      starterPatientId = starterPatient.id;

      const proPatient = await createPatient(service, proClinicId, {
        firstName: "Feature",
        lastName: `P${randomTag().slice(-6)}`,
      });
      proPatientId = proPatient.id;

      starterClients = {};
      proClients = {};
      for (const role of roles) {
        const sUser = starterByRole[role]!;
        const pUser = proByRole[role]!;
        starterClients[role] = await signInAs(
          url,
          anonKey,
          sUser.email,
          sUser.password,
        );
        proClients[role] = await signInAs(
          url,
          anonKey,
          pUser.email,
          pUser.password,
        );
      }

      // Pro appointment for calendar_advanced reschedule positive control.
      // createAppointment only needs calendar_basic (on both plans).
      activeActionClient = proClients.reception!;
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + 14);
      start.setUTCHours(10, 0, 0, 0);
      const end = new Date(start);
      end.setUTCMinutes(30);
      const createFd = new FormData();
      createFd.set("doctorId", proByRole.doctor!.userId);
      createFd.set("patientId", proPatientId);
      createFd.set("locationId", "");
      createFd.set("serviceId", "");
      createFd.set("startsAt", start.toISOString());
      createFd.set("endsAt", end.toISOString());
      createFd.set("status", "confirmed");
      createFd.set("notes", "plan-int-011");
      const createdAppt = await createAppointmentAction(null, createFd);
      if (createdAppt?.error) {
        throw new Error(
          `pro appointment setup failed: ${createdAppt.error}`,
        );
      }
      const { data: apptRow, error: apptErr } = await service
        .from("appointments")
        .select("id")
        .eq("clinic_id", proClinicId)
        .eq("patient_id", proPatientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (apptErr || !apptRow) {
        throw new Error(apptErr?.message ?? "pro appointment id lookup failed");
      }
      proAppointmentId = apptRow.id;
    }, 120_000);

    afterAll(async () => {
      await cleanupClinics(service, created);
    }, 60_000);

    function asClinicRole(clinic: "starter" | "pro", role: AppRole) {
      activeActionClient =
        clinic === "starter" ? starterClients[role]! : proClients[role]!;
    }

    const rows: FeatureRow[] = [
      {
        feature: "expenses_reports_excel",
        label: "createExpenseAction",
        role: "accountant",
        starterError: "featureDisabled",
        proOk: (r) => r?.message === "created",
        run: async (clinic) => {
          asClinicRole(clinic, "accountant");
          const fd = new FormData();
          fd.set("category", "supplies");
          fd.set(
            "description",
            `PLAN-INT-011 ${clinic} ${randomTag().slice(-6)}`,
          );
          fd.set("amount", "12.5");
          fd.set("expenseDate", "2026-07-01");
          fd.set("vendor", "");
          fd.set("notes", "");
          return createExpenseAction(null, fd);
        },
      },
      {
        feature: "branding_custom",
        label: "updateBrandingColorsAction",
        role: "owner",
        starterError: "featureDisabled",
        proOk: (r) => r?.message === "colorsSaved",
        run: async (clinic) => {
          asClinicRole(clinic, "owner");
          const fd = new FormData();
          fd.set("background", "#112233");
          fd.set("text", "#ffffff");
          fd.set("accent", "#445566");
          return updateBrandingColorsAction(null, fd);
        },
      },
      {
        feature: "crm_light",
        label: "dismissCrmNotificationAction",
        role: "reception",
        starterError: "featureDisabled",
        // Past assertFeature: fake id → notFound (same past-RBAC pattern as RBAC-INT-008).
        proOk: (r) => r?.error === "notFound",
        run: async (clinic) => {
          asClinicRole(clinic, "reception");
          return dismissCrmNotificationAction(FAKE_UUID);
        },
      },
      {
        feature: "consent_draw_sign",
        label: "updateConsentFormAction",
        role: "owner",
        starterError: "featureDisabled",
        proOk: (r) => r?.message === "saved",
        run: async (clinic) => {
          asClinicRole(clinic, "owner");
          const fd = new FormData();
          fd.set("templateKey", "general_treatment");
          fd.set("locale", "bs");
          fd.set("title", `PLAN-INT-011 ${clinic} ${randomTag().slice(-6)}`);
          fd.set("bodyText", "Consent body for feature assert probe.");
          return updateConsentFormAction(null, fd);
        },
      },
      {
        feature: "waitlist_auto",
        label: "addWaitlistAction",
        role: "reception",
        starterError: "featureDisabled",
        proOk: (r) => r?.message === "waitlistAdded",
        run: async (clinic) => {
          asClinicRole(clinic, "reception");
          const patientId =
            clinic === "starter" ? starterPatientId : proPatientId;
          const doctorId =
            clinic === "starter"
              ? starterByRole.doctor!.userId
              : proByRole.doctor!.userId;
          const fd = new FormData();
          fd.set("patientId", patientId);
          fd.set("doctorId", doctorId);
          fd.set("serviceId", "");
          fd.set("locationId", "");
          fd.set("preferredFrom", "");
          fd.set("preferredTo", "");
          fd.set("notes", `plan-int-011-${clinic}`);
          return addWaitlistAction(null, fd);
        },
      },
      {
        feature: "calendar_advanced",
        label: "rescheduleAppointmentAction",
        role: "reception",
        starterError: "featureDisabled",
        proOk: (r) => r?.message === "appointmentRescheduled",
        run: async (clinic) => {
          asClinicRole(clinic, "reception");
          // Starter: calendar_basic passes, calendar_advanced fails before lookup.
          const appointmentId =
            clinic === "starter" ? FAKE_UUID : proAppointmentId;
          const start = new Date();
          start.setUTCDate(start.getUTCDate() + (clinic === "pro" ? 15 : 20));
          start.setUTCHours(11, 0, 0, 0);
          const end = new Date(start);
          end.setUTCMinutes(30);
          return rescheduleAppointmentAction(
            appointmentId,
            start.toISOString(),
            end.toISOString(),
          );
        },
      },
    ];

    for (const row of rows) {
      it(`PLAN-INT-011: starter denies ${row.label} (${row.feature}) with featureDisabled`, async () => {
        const result = await row.run("starter");
        expect(result?.error).toBe(row.starterError);
      });

      it(`PLAN-INT-011: professional allows ${row.label} (${row.feature}) past assertFeature`, async () => {
        const result = await row.run("pro");
        expect(row.proOk(result)).toBe(true);
      });
    }

    it("PLAN-INT-011 inventory_basic already COVERED by PLAN-SEC-001 (no duplicate probe)", () => {
      // Anchor so the catalog row stays discoverable from this file's suite.
      expect(PRO_FEATURES_OFF_ON_STARTER).toContain("inventory_basic");
    });
  },
);
