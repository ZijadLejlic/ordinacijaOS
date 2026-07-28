import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  signInAs,
  type AppRole,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P3.6 (docs/QA/Implementation-Plan.md): readonly clinic write-block across
 * modules — extends LIFE-RLS-001 (SA half). RLS spot-check remains in
 * rbac-and-lifecycle.test.ts (patient INSERT via clinic_is_writable).
 *
 * Already COVERED elsewhere — not duplicated:
 *   - LIFE-RLS-001 RLS patient INSERT (rbac-and-lifecycle)
 *   - LIFE-INT-002 / LIFE-SEC-002 (lifecycle-transitions)
 *   - LIFE-API-001 (cron-secret-guard)
 *
 * Scope (derived from code, not invented): grepped getClinicWriteBlock in
 * lib server-action modules. One representative SA per module that calls it:
 *   patients, odontogram, treatment-plans, appointments, invoices, expenses,
 *   crm (send-mode dismiss), email, branding, consent, inventory, import,
 *   services, locations, invites.
 *
 * Out of scope (no getClinicWriteBlock call):
 *   - privacy / operators / onboarding / platform / clinic closure SA
 *   - FIN-INT-015 legal settings → P3.7 (requireInvoiceWriter already
 *     includes write-block; assertFeature added there for consistency)
 *
 * Mechanism: getClinicWriteBlock → clinicWriteBlockError(status):
 *   active → null; readonly → clinicReadonly; pending_delete → clinicPendingDelete.
 * RLS clinic_is_writable() is defense-in-depth (active only).
 *
 * Pattern: P1.6 / P3.1 / P3.5 SA harness (vi.mock Next + createClinicWithRoles
 * + real action). Writable clinic (active) allow + readonly clinic deny;
 * one pending_delete positive for clinicPendingDelete code path.
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

class RedirectSentinel extends Error {
  constructor(readonly href: unknown) {
    super("NEXT_REDIRECT");
    this.name = "RedirectSentinel";
  }
}

vi.mock("@/i18n/navigation", () => ({
  redirect: (href: unknown) => {
    throw new RedirectSentinel(href);
  },
  getPathname: () => "/",
  Link: () => null,
  usePathname: () => "/",
  useRouter: () => ({ push: () => undefined }),
}));

import { createAppointmentAction } from "@/lib/appointments/actions";
import { updateBrandingColorsAction } from "@/lib/branding/actions";
import { updateConsentFormAction } from "@/lib/consent/actions";
import { dismissCrmNotificationAction } from "@/lib/crm/actions";
import { updateEmailTemplateAction } from "@/lib/email/actions";
import { createExpenseAction } from "@/lib/expenses/actions";
import { importPatientsAction } from "@/lib/import/actions";
import { createInventoryItemAction } from "@/lib/inventory/actions";
import { createInvoiceAction } from "@/lib/invoices/actions";
import { revokeInviteAction } from "@/lib/invites/actions";
import { updateSharedPricelistAction } from "@/lib/locations/actions";
import { upsertToothStatusAction } from "@/lib/odontogram/actions";
import { createPatientAction } from "@/lib/patients/actions";
import { createServiceAction } from "@/lib/services/actions";
import { createTreatmentPlanAction } from "@/lib/treatment-plans/actions";

type ActionResult = { error?: string; message?: string } | null;

type ModuleRow = {
  module: string;
  label: string;
  role: AppRole;
  /** Writable clinic: success message, redirect, or past-gate error. */
  writableOk: (result: ActionResult | "redirect") => boolean;
  run: (clinic: "writable" | "readonly") => Promise<ActionResult | "redirect">;
};

const FAKE_UUID = "00000000-0000-4000-8000-000000000099";

describeSecurity(
  "P3.6 LIFE-RLS-001 SA write-block across modules (readonly deny / active allow)",
  () => {
    let url: string;
    let anonKey: string;
    let serviceKey: string;
    let service: DbClient;

    let writableClinicId: string;
    let readonlyClinicId: string;
    let writableByRole: Partial<Record<AppRole, TestUser>>;
    let readonlyByRole: Partial<Record<AppRole, TestUser>>;
    let writableClients: Partial<Record<AppRole, DbClient>>;
    let readonlyClients: Partial<Record<AppRole, DbClient>>;
    let writablePatientId: string;
    let readonlyPatientId: string;

    const created: TestUser[] = [];

    const roles: AppRole[] = [
      "owner",
      "doctor",
      "assistant",
      "reception",
      "accountant",
    ];

    beforeAll(async () => {
      ({ url, anonKey, serviceKey } = env!);
      service = createSupabaseClient(url, serviceKey);

      const writableClinic = await createClinicWithRoles(service, {
        roles,
        clinicName: `LIFE-WriteBlock Writable ${randomTag()}`,
        planCode: "professional",
        emailPrefix: "life-wb-w",
      });
      writableClinicId = writableClinic.clinicId;
      writableByRole = writableClinic.byRole;
      created.push(...writableClinic.users);

      const readonlyClinic = await createClinicWithRoles(service, {
        roles,
        clinicName: `LIFE-WriteBlock Readonly ${randomTag()}`,
        planCode: "professional",
        emailPrefix: "life-wb-r",
      });
      readonlyClinicId = readonlyClinic.clinicId;
      readonlyByRole = readonlyClinic.byRole;
      created.push(...readonlyClinic.users);

      const { error: statusErr } = await service
        .from("clinics")
        .update({ status: "readonly" })
        .eq("id", readonlyClinicId);
      if (statusErr) {
        throw new Error(`readonly status set failed: ${statusErr.message}`);
      }

      const wPatient = await createPatient(service, writableClinicId, {
        firstName: "WriteBlock",
        lastName: `W${randomTag().slice(-6)}`,
      });
      writablePatientId = wPatient.id;

      // Patient seed uses service role (bypasses clinic_is_writable).
      const rPatient = await createPatient(service, readonlyClinicId, {
        firstName: "WriteBlock",
        lastName: `R${randomTag().slice(-6)}`,
      });
      readonlyPatientId = rPatient.id;

      writableClients = {};
      readonlyClients = {};
      for (const role of roles) {
        const wUser = writableByRole[role]!;
        const rUser = readonlyByRole[role]!;
        writableClients[role] = await signInAs(
          url,
          anonKey,
          wUser.email,
          wUser.password,
        );
        readonlyClients[role] = await signInAs(
          url,
          anonKey,
          rUser.email,
          rUser.password,
        );
      }
    }, 120_000);

    afterAll(async () => {
      await cleanupClinics(service, created);
    }, 60_000);

    function asClinicRole(clinic: "writable" | "readonly", role: AppRole) {
      activeActionClient =
        clinic === "writable" ? writableClients[role]! : readonlyClients[role]!;
    }

    function patientIdFor(clinic: "writable" | "readonly") {
      return clinic === "writable" ? writablePatientId : readonlyPatientId;
    }

    function doctorIdFor(clinic: "writable" | "readonly") {
      return clinic === "writable"
        ? writableByRole.doctor!.userId
        : readonlyByRole.doctor!.userId;
    }

    const rows: ModuleRow[] = [
      {
        module: "patients",
        label: "createPatientAction",
        role: "doctor",
        writableOk: (r) => r === "redirect" || r?.message === "created",
        run: async (clinic) => {
          asClinicRole(clinic, "doctor");
          const fd = new FormData();
          fd.set("firstName", `WB${clinic}`);
          fd.set("lastName", `P${randomTag().slice(-6)}`);
          fd.set("phone", "");
          fd.set("email", "");
          fd.set("dateOfBirth", "");
          fd.set("nextControlAt", "");
          fd.set("address", "");
          fd.set("medicalHistory", "");
          fd.set("notes", "");
          try {
            return await createPatientAction(null, fd);
          } catch (e) {
            if (e instanceof RedirectSentinel) return "redirect";
            throw e;
          }
        },
      },
      {
        module: "odontogram",
        label: "upsertToothStatusAction",
        role: "doctor",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "toothUpdated",
        run: async (clinic) => {
          asClinicRole(clinic, "doctor");
          const fd = new FormData();
          fd.set("fdiNumber", "11");
          fd.set("status", "healthy");
          fd.set("note", "");
          return upsertToothStatusAction(patientIdFor(clinic), null, fd);
        },
      },
      {
        module: "treatment-plans",
        label: "createTreatmentPlanAction",
        role: "doctor",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "planCreated",
        run: async (clinic) => {
          asClinicRole(clinic, "doctor");
          const fd = new FormData();
          fd.set("title", `WB plan ${randomTag().slice(-6)}`);
          fd.set("notes", "");
          return createTreatmentPlanAction(patientIdFor(clinic), null, fd);
        },
      },
      {
        module: "appointments",
        label: "createAppointmentAction",
        role: "reception",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "appointmentCreated",
        run: async (clinic) => {
          asClinicRole(clinic, "reception");
          const start = new Date();
          start.setUTCDate(start.getUTCDate() + (clinic === "writable" ? 21 : 22));
          start.setUTCHours(9, 0, 0, 0);
          const end = new Date(start);
          end.setUTCMinutes(30);
          const fd = new FormData();
          fd.set("doctorId", doctorIdFor(clinic));
          fd.set("patientId", patientIdFor(clinic));
          fd.set("locationId", "");
          fd.set("serviceId", "");
          fd.set("startsAt", start.toISOString());
          fd.set("endsAt", end.toISOString());
          fd.set("status", "confirmed");
          fd.set("notes", `life-wb-${clinic}`);
          return createAppointmentAction(null, fd);
        },
      },
      {
        module: "invoices",
        label: "createInvoiceAction",
        role: "accountant",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "created",
        run: async (clinic) => {
          asClinicRole(clinic, "accountant");
          const fd = new FormData();
          fd.set("patientId", patientIdFor(clinic));
          fd.set("locationId", "");
          fd.set("doctorId", "");
          fd.set("notes", "");
          fd.set(
            "linesJson",
            JSON.stringify([
              {
                description: `LIFE-WB ${clinic}`,
                quantity: 1,
                unitPrice: 10,
                vatRate: 0,
              },
            ]),
          );
          return createInvoiceAction(null, fd);
        },
      },
      {
        module: "expenses",
        label: "createExpenseAction",
        role: "accountant",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "created",
        run: async (clinic) => {
          asClinicRole(clinic, "accountant");
          const fd = new FormData();
          fd.set("category", "supplies");
          fd.set("description", `LIFE-WB ${clinic} ${randomTag().slice(-6)}`);
          fd.set("amount", "12.5");
          fd.set("expenseDate", "2026-07-01");
          fd.set("vendor", "");
          fd.set("notes", "");
          return createExpenseAction(null, fd);
        },
      },
      {
        module: "crm",
        label: "dismissCrmNotificationAction",
        role: "reception",
        // Past write-block + feature: fake id → notFound
        writableOk: (r) => r !== "redirect" && r?.error === "notFound",
        run: async (clinic) => {
          asClinicRole(clinic, "reception");
          return dismissCrmNotificationAction(FAKE_UUID);
        },
      },
      {
        module: "email",
        label: "updateEmailTemplateAction",
        role: "owner",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "saved",
        run: async (clinic) => {
          asClinicRole(clinic, "owner");
          const fd = new FormData();
          fd.set("templateKey", "appointment_reminder");
          fd.set("locale", "bs");
          fd.set("subject", `LIFE-WB ${clinic} ${randomTag().slice(-6)}`);
          fd.set("bodyText", "Pozdrav {{ime}}, termin {{datum}}.");
          return updateEmailTemplateAction(null, fd);
        },
      },
      {
        module: "branding",
        label: "updateBrandingColorsAction",
        role: "owner",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "colorsSaved",
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
        module: "consent",
        label: "updateConsentFormAction",
        role: "owner",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "saved",
        run: async (clinic) => {
          asClinicRole(clinic, "owner");
          const fd = new FormData();
          fd.set("templateKey", "general_treatment");
          fd.set("locale", "bs");
          fd.set("title", `LIFE-WB ${clinic} ${randomTag().slice(-6)}`);
          fd.set("bodyText", "Consent body for write-block probe.");
          return updateConsentFormAction(null, fd);
        },
      },
      {
        module: "inventory",
        label: "createInventoryItemAction",
        role: "doctor",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "created",
        run: async (clinic) => {
          asClinicRole(clinic, "doctor");
          const fd = new FormData();
          fd.set("name", `WB Item ${clinic} ${randomTag().slice(-6)}`);
          fd.set("unit", "kom");
          fd.set("quantity", "5");
          fd.set("lowStockThreshold", "1");
          fd.set("notes", "");
          return createInventoryItemAction(null, fd);
        },
      },
      {
        module: "import",
        label: "importPatientsAction",
        role: "owner",
        // Past write-block: no CSV → invalid
        writableOk: (r) => r !== "redirect" && r?.error === "invalid",
        run: async (clinic) => {
          asClinicRole(clinic, "owner");
          const fd = new FormData();
          fd.set("mode", "preview");
          return importPatientsAction(null, fd);
        },
      },
      {
        module: "services",
        label: "createServiceAction",
        role: "owner",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "serviceCreated",
        run: async (clinic) => {
          asClinicRole(clinic, "owner");
          const fd = new FormData();
          fd.set("name", `WB svc ${clinic} ${randomTag().slice(-6)}`);
          fd.set("code", "");
          fd.set("durationMinutes", "30");
          fd.set("priceEur", "25");
          fd.set("vatRate", "0");
          fd.set("locationId", "");
          return createServiceAction(null, fd);
        },
      },
      {
        module: "locations",
        label: "updateSharedPricelistAction",
        role: "owner",
        writableOk: (r) =>
          r !== "redirect" && r?.message === "settingsSaved",
        run: async (clinic) => {
          asClinicRole(clinic, "owner");
          const fd = new FormData();
          fd.set("sharedPricelistAcrossLocations", "on");
          return updateSharedPricelistAction(null, fd);
        },
      },
      {
        module: "invites",
        label: "revokeInviteAction",
        role: "owner",
        // Past write-block: fake id → inviteNotFound
        writableOk: (r) =>
          r !== "redirect" && r?.error === "inviteNotFound",
        run: async (clinic) => {
          asClinicRole(clinic, "owner");
          return revokeInviteAction(FAKE_UUID);
        },
      },
    ];

    for (const row of rows) {
      it(`LIFE-RLS-001: writable allows ${row.label} (${row.module})`, async () => {
        const result = await row.run("writable");
        expect(
          row.writableOk(result),
          `expected writable allow for ${row.label}, got ${JSON.stringify(result)}`,
        ).toBe(true);
      });

      it(`LIFE-RLS-001: readonly denies ${row.label} (${row.module}) with clinicReadonly`, async () => {
        const result = await row.run("readonly");
        expect(result).not.toBe("redirect");
        expect((result as ActionResult)?.error).toBe("clinicReadonly");
      });
    }

    it("LIFE-RLS-001: pending_delete denies createPatientAction with clinicPendingDelete", async () => {
      const { error: pdErr } = await service
        .from("clinics")
        .update({ status: "pending_delete" })
        .eq("id", readonlyClinicId);
      expect(pdErr).toBeNull();

      asClinicRole("readonly", "doctor");
      const fd = new FormData();
      fd.set("firstName", "Pending");
      fd.set("lastName", `Del${randomTag().slice(-6)}`);
      fd.set("phone", "");
      fd.set("email", "");
      fd.set("dateOfBirth", "");
      fd.set("nextControlAt", "");
      fd.set("address", "");
      fd.set("medicalHistory", "");
      fd.set("notes", "");
      let result: ActionResult | "redirect";
      try {
        result = await createPatientAction(null, fd);
      } catch (e) {
        if (e instanceof RedirectSentinel) result = "redirect";
        else throw e;
      }
      expect(result).not.toBe("redirect");
      expect((result as ActionResult)?.error).toBe("clinicPendingDelete");
    });
  },
);
