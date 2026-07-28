import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createServiceRow,
  createSupabaseClient,
  randomTag,
  signInAs,
  type AppRole,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";
import { canSeeDashboardKpis } from "@/lib/dashboard/rbac";

/**
 * P3.1 (docs/QA/Implementation-Plan.md): parameterized RBAC INT matrix
 * runner for `RBAC-INT-001..030` (subset proven here), driven by
 * Business-Rules-and-RBAC.md §3 — **code truth**, not PRD wording where
 * they diverge (D-09 assistant/reception both write patients).
 *
 * **Boundary:** Server Action layer (T-RBAC-07). Pattern = P1.6/P1.7
 * (`vi.mock` Next plumbing + real action + real JWT session). RBAC-RLS-001..004
 * already COVERED `can_*` RPCs; this file does **not** re-probe those.
 *
 * **ID map (catalog was sparse — only RBAC-INT-010 had a Test-Strategy row;
 * Implementation-Plan cites the 001..030 range; Traceability cites
 * 001..020 + inventory as 021):**
 *
 * | ID | Module | Probe |
 * |---|---|---|
 * | 001 | Patients | createPatientAction — doctor allow |
 * | 002 | Patients | createPatientAction — accountant deny |
 * | 003 | Patients (D-09) | createPatientAction — assistant + reception allow |
 * | 004 | Odontogram | upsertToothStatusAction — doctor allow / reception deny |
 * | 005 | Calendar peer | **reserved GAP → P3.2 / CAL-INT-004** (T-RBAC-03) |
 * | 006 | Invoices | createInvoiceAction — accountant allow / doctor deny |
 * | 007 | Expenses | createExpenseAction — accountant allow / reception deny |
 * | 008 | CRM | dismissCrmNotificationAction — reception past-RBAC / doctor deny |
 * | 009 | Email templates | updateEmailTemplateAction — owner allow / reception deny |
 * | 010 | Dashboard KPI | canSeeDashboardKpis(session role) — doctor allow / assistant deny |
 * | 012 | Privacy request | requestPatientErasureAction — doctor allow / accountant deny |
 * | 013 | Privacy manage | rejectPatientErasureAction — owner past-RBAC / doctor deny |
 * | 014 | Branding/settings | updateBrandingColorsAction — owner allow / doctor deny |
 * | 015 | Treatment plan | createTreatmentPlanAction — doctor allow / assistant deny |
 * | 016 | Import patients | importPatientsAction — owner past-RBAC / doctor deny |
 * | 017 | Calendar write | createAppointmentAction — reception allow / accountant deny |
 * | 021 | Inventory | createInventoryItemAction — doctor allow / accountant deny |
 *
 * IDs 011, 018–020, 022–030: not invented as new catalog rows; left for
 * later P3 items. Platform admin is out of scope (P2.8).
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

/** createPatientAction redirects on success — capture as allow, not crash. */
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
}));

import { createAppointmentAction } from "@/lib/appointments/actions";
import { updateBrandingColorsAction } from "@/lib/branding/actions";
import { dismissCrmNotificationAction } from "@/lib/crm/actions";
import { updateEmailTemplateAction } from "@/lib/email/actions";
import { createExpenseAction } from "@/lib/expenses/actions";
import { importPatientsAction } from "@/lib/import/actions";
import { createInventoryItemAction } from "@/lib/inventory/actions";
import { createInvoiceAction } from "@/lib/invoices/actions";
import { upsertToothStatusAction } from "@/lib/odontogram/actions";
import { createPatientAction } from "@/lib/patients/actions";
import {
  rejectPatientErasureAction,
  requestPatientErasureAction,
} from "@/lib/privacy/actions";
import { createTreatmentPlanAction } from "@/lib/treatment-plans/actions";

type ActionResult = { error?: string; message?: string } | null;

type MatrixRow = {
  id: string;
  module: string;
  role: AppRole;
  /** `deny` → must be `forbidden`. `allow` → must not be `forbidden` (success, redirect, or past-RBAC like notFound). */
  expect: "allow" | "deny";
  label: string;
  run: () => Promise<ActionResult | "redirect">;
};

describeSecurity("P3.1 RBAC-INT parameterized matrix (role × sensitive SA)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let patientId: string;
  let byRole: Partial<Record<AppRole, TestUser>>;
  let clients: Partial<Record<AppRole, DbClient>>;
  const created: TestUser[] = [];

  const FAKE_UUID = "00000000-0000-4000-8000-000000000099";

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    // Professional: inventory / CRM / branding / expenses features on so
    // RBAC denials are not confounded with featureDisabled.
    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor", "assistant", "reception", "accountant"],
      clinicName: `RBAC INT Matrix ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "rbac-int",
    });
    clinicId = clinic.clinicId;
    byRole = clinic.byRole;
    created.push(...clinic.users);

    const patient = await createPatient(service, clinicId, {
      firstName: "Matrix",
      lastName: `P${randomTag().slice(-6)}`,
    });
    patientId = patient.id;
    // CRM / erasure paths that read patients.email
    await service
      .from("patients")
      .update({ email: `matrix-${randomTag().slice(-6)}@ordinacijaos.test` })
      .eq("id", patientId);

    await createServiceRow(service, clinicId);

    // Email templates: updateEmailTemplateAction → ensureTemplates seeds via
    // authenticated RPC (service_role cannot call it — grant is authenticated
    // only + membership guard). Owner allow path seeds on first write.

    clients = {};
    for (const role of [
      "owner",
      "doctor",
      "assistant",
      "reception",
      "accountant",
    ] as const) {
      const user = byRole[role]!;
      clients[role] = await signInAs(url, anonKey, user.email, user.password);
    }
  }, 90_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  function asRole(role: AppRole) {
    activeActionClient = clients[role]!;
  }

  function patientForm(firstName: string): FormData {
    const fd = new FormData();
    fd.set("firstName", firstName);
    fd.set("lastName", `RBAC${randomTag().slice(-6)}`);
    fd.set("phone", "");
    fd.set("email", "");
    fd.set("dateOfBirth", "");
    fd.set("nextControlAt", "");
    fd.set("address", "");
    fd.set("medicalHistory", "");
    fd.set("notes", "");
    return fd;
  }

  async function runCreatePatient(role: AppRole): Promise<ActionResult | "redirect"> {
    asRole(role);
    try {
      return await createPatientAction(null, patientForm(`Allow${role}`));
    } catch (e) {
      if (e instanceof RedirectSentinel) return "redirect";
      throw e;
    }
  }

  const matrix: MatrixRow[] = [
    // —— Patients ——
    {
      id: "RBAC-INT-001",
      module: "patients",
      role: "doctor",
      expect: "allow",
      label: "createPatientAction doctor allow",
      run: () => runCreatePatient("doctor"),
    },
    {
      id: "RBAC-INT-002",
      module: "patients",
      role: "accountant",
      expect: "deny",
      label: "createPatientAction accountant deny",
      run: () => runCreatePatient("accountant"),
    },
    {
      id: "RBAC-INT-003",
      module: "patients",
      role: "assistant",
      expect: "allow",
      label: "createPatientAction assistant allow (D-09 code truth)",
      run: () => runCreatePatient("assistant"),
    },
    {
      id: "RBAC-INT-003",
      module: "patients",
      role: "reception",
      expect: "allow",
      label: "createPatientAction reception allow (D-09 code truth)",
      run: () => runCreatePatient("reception"),
    },

    // —— Odontogram ——
    {
      id: "RBAC-INT-004",
      module: "odontogram",
      role: "doctor",
      expect: "allow",
      label: "upsertToothStatusAction doctor allow",
      run: async () => {
        asRole("doctor");
        const fd = new FormData();
        fd.set("fdiNumber", "11");
        fd.set("status", "healthy");
        fd.set("note", "");
        return upsertToothStatusAction(patientId, null, fd);
      },
    },
    {
      id: "RBAC-INT-004",
      module: "odontogram",
      role: "reception",
      expect: "deny",
      label: "upsertToothStatusAction reception deny",
      run: async () => {
        asRole("reception");
        const fd = new FormData();
        fd.set("fdiNumber", "11");
        fd.set("status", "healthy");
        fd.set("note", "");
        return upsertToothStatusAction(patientId, null, fd);
      },
    },

    // —— Invoices ——
    {
      id: "RBAC-INT-006",
      module: "invoices",
      role: "accountant",
      expect: "allow",
      label: "createInvoiceAction accountant allow",
      run: async () => {
        asRole("accountant");
        const fd = new FormData();
        fd.set("patientId", patientId);
        fd.set("locationId", "");
        fd.set("doctorId", "");
        fd.set("notes", "");
        fd.set(
          "linesJson",
          JSON.stringify([
            {
              description: "RBAC matrix line",
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
      id: "RBAC-INT-006",
      module: "invoices",
      role: "doctor",
      expect: "deny",
      label: "createInvoiceAction doctor deny",
      run: async () => {
        asRole("doctor");
        const fd = new FormData();
        fd.set("patientId", patientId);
        fd.set("locationId", "");
        fd.set("doctorId", "");
        fd.set("notes", "");
        fd.set(
          "linesJson",
          JSON.stringify([
            {
              description: "should not create",
              quantity: 1,
              unitPrice: 10,
              vatRate: 0,
            },
          ]),
        );
        return createInvoiceAction(null, fd);
      },
    },

    // —— Expenses ——
    {
      id: "RBAC-INT-007",
      module: "expenses",
      role: "accountant",
      expect: "allow",
      label: "createExpenseAction accountant allow",
      run: async () => {
        asRole("accountant");
        const fd = new FormData();
        fd.set("category", "supplies");
        fd.set("description", `RBAC expense ${randomTag().slice(-6)}`);
        fd.set("amount", "25.5");
        fd.set("expenseDate", "2026-07-01");
        fd.set("vendor", "");
        fd.set("notes", "");
        return createExpenseAction(null, fd);
      },
    },
    {
      id: "RBAC-INT-007",
      module: "expenses",
      role: "reception",
      expect: "deny",
      label: "createExpenseAction reception deny",
      run: async () => {
        asRole("reception");
        const fd = new FormData();
        fd.set("category", "supplies");
        fd.set("description", "should not create");
        fd.set("amount", "25.5");
        fd.set("expenseDate", "2026-07-01");
        fd.set("vendor", "");
        fd.set("notes", "");
        return createExpenseAction(null, fd);
      },
    },

    // —— CRM ——
    {
      id: "RBAC-INT-008",
      module: "crm",
      role: "reception",
      expect: "allow",
      label: "dismissCrmNotificationAction reception past-RBAC (notFound)",
      run: async () => {
        asRole("reception");
        return dismissCrmNotificationAction(FAKE_UUID);
      },
    },
    {
      id: "RBAC-INT-008",
      module: "crm",
      role: "doctor",
      expect: "deny",
      label: "dismissCrmNotificationAction doctor deny",
      run: async () => {
        asRole("doctor");
        return dismissCrmNotificationAction(FAKE_UUID);
      },
    },

    // —— Email templates ——
    {
      id: "RBAC-INT-009",
      module: "email",
      role: "owner",
      expect: "allow",
      label: "updateEmailTemplateAction owner allow",
      run: async () => {
        asRole("owner");
        const fd = new FormData();
        fd.set("templateKey", "appointment_reminder");
        fd.set("locale", "bs");
        fd.set("subject", `RBAC matrix ${randomTag().slice(-6)}`);
        fd.set("bodyText", "Pozdrav {{ime}}, termin {{datum}}.");
        return updateEmailTemplateAction(null, fd);
      },
    },
    {
      id: "RBAC-INT-009",
      module: "email",
      role: "reception",
      expect: "deny",
      label: "updateEmailTemplateAction reception deny (read/send only)",
      run: async () => {
        asRole("reception");
        const fd = new FormData();
        fd.set("templateKey", "appointment_reminder");
        fd.set("locale", "bs");
        fd.set("subject", "should not save");
        fd.set("bodyText", "nope");
        return updateEmailTemplateAction(null, fd);
      },
    },

    // —— Dashboard KPI (RBAC-INT-010 catalog row) ——
    {
      id: "RBAC-INT-010",
      module: "dashboard",
      role: "doctor",
      expect: "allow",
      label: "canSeeDashboardKpis doctor allow",
      run: async () => {
        const role = byRole.doctor!.role;
        return canSeeDashboardKpis(role)
          ? { message: "kpiAllowed" }
          : { error: "forbidden" };
      },
    },
    {
      id: "RBAC-INT-010",
      module: "dashboard",
      role: "assistant",
      expect: "deny",
      label: "canSeeDashboardKpis assistant deny",
      run: async () => {
        const role = byRole.assistant!.role;
        return canSeeDashboardKpis(role)
          ? { message: "kpiLeak" }
          : { error: "forbidden" };
      },
    },

    // —— Privacy ——
    {
      id: "RBAC-INT-012",
      module: "privacy",
      role: "doctor",
      expect: "allow",
      label: "requestPatientErasureAction doctor allow",
      run: async () => {
        asRole("doctor");
        return requestPatientErasureAction(patientId);
      },
    },
    {
      id: "RBAC-INT-012",
      module: "privacy",
      role: "accountant",
      expect: "deny",
      label: "requestPatientErasureAction accountant deny",
      run: async () => {
        asRole("accountant");
        return requestPatientErasureAction(patientId);
      },
    },
    {
      id: "RBAC-INT-013",
      module: "privacy",
      role: "owner",
      expect: "allow",
      label: "rejectPatientErasureAction owner past-RBAC (notFound)",
      run: async () => {
        asRole("owner");
        const fd = new FormData();
        fd.set("reason", "matrix probe");
        return rejectPatientErasureAction(FAKE_UUID, fd);
      },
    },
    {
      id: "RBAC-INT-013",
      module: "privacy",
      role: "doctor",
      expect: "deny",
      label: "rejectPatientErasureAction doctor deny",
      run: async () => {
        asRole("doctor");
        const fd = new FormData();
        fd.set("reason", "should not");
        return rejectPatientErasureAction(FAKE_UUID, fd);
      },
    },

    // —— Branding / settings ——
    {
      id: "RBAC-INT-014",
      module: "branding",
      role: "owner",
      expect: "allow",
      label: "updateBrandingColorsAction owner allow",
      run: async () => {
        asRole("owner");
        const fd = new FormData();
        fd.set("background", "#112233");
        fd.set("text", "#ffffff");
        fd.set("accent", "#445566");
        return updateBrandingColorsAction(null, fd);
      },
    },
    {
      id: "RBAC-INT-014",
      module: "branding",
      role: "doctor",
      expect: "deny",
      label: "updateBrandingColorsAction doctor deny",
      run: async () => {
        asRole("doctor");
        const fd = new FormData();
        fd.set("background", "#112233");
        fd.set("text", "#ffffff");
        fd.set("accent", "#445566");
        return updateBrandingColorsAction(null, fd);
      },
    },

    // —— Treatment plan ——
    {
      id: "RBAC-INT-015",
      module: "treatment_plan",
      role: "doctor",
      expect: "allow",
      label: "createTreatmentPlanAction doctor allow",
      run: async () => {
        asRole("doctor");
        const fd = new FormData();
        fd.set("title", `Plan ${randomTag().slice(-6)}`);
        fd.set("notes", "");
        return createTreatmentPlanAction(patientId, null, fd);
      },
    },
    {
      id: "RBAC-INT-015",
      module: "treatment_plan",
      role: "assistant",
      expect: "deny",
      label: "createTreatmentPlanAction assistant deny (read-only)",
      run: async () => {
        asRole("assistant");
        const fd = new FormData();
        fd.set("title", "should not");
        fd.set("notes", "");
        return createTreatmentPlanAction(patientId, null, fd);
      },
    },

    // —— Import ——
    {
      id: "RBAC-INT-016",
      module: "import",
      role: "owner",
      expect: "allow",
      label: "importPatientsAction owner past-RBAC (no file → invalid)",
      run: async () => {
        asRole("owner");
        const fd = new FormData();
        fd.set("mode", "preview");
        // No CSV file → invalid after RBAC clears (proves owner passed gate)
        return importPatientsAction(null, fd);
      },
    },
    {
      id: "RBAC-INT-016",
      module: "import",
      role: "doctor",
      expect: "deny",
      label: "importPatientsAction doctor deny",
      run: async () => {
        asRole("doctor");
        const fd = new FormData();
        fd.set("mode", "preview");
        return importPatientsAction(null, fd);
      },
    },

    // —— Calendar write (005 reserved for peer scope / P3.2) ——
    {
      id: "RBAC-INT-017",
      module: "calendar",
      role: "reception",
      expect: "allow",
      label: "createAppointmentAction reception allow",
      run: async () => {
        asRole("reception");
        const doctorId = byRole.doctor!.userId;
        const start = new Date();
        start.setUTCDate(start.getUTCDate() + 14);
        start.setUTCHours(9, 0, 0, 0);
        const end = new Date(start);
        end.setUTCMinutes(30);
        const fd = new FormData();
        fd.set("doctorId", doctorId);
        fd.set("patientId", patientId);
        fd.set("locationId", "");
        fd.set("serviceId", "");
        fd.set("startsAt", start.toISOString());
        fd.set("endsAt", end.toISOString());
        fd.set("status", "confirmed");
        fd.set("notes", "");
        return createAppointmentAction(null, fd);
      },
    },
    {
      id: "RBAC-INT-017",
      module: "calendar",
      role: "accountant",
      expect: "deny",
      label: "createAppointmentAction accountant deny",
      run: async () => {
        asRole("accountant");
        const doctorId = byRole.doctor!.userId;
        const start = new Date();
        start.setUTCDate(start.getUTCDate() + 15);
        start.setUTCHours(10, 0, 0, 0);
        const end = new Date(start);
        end.setUTCMinutes(30);
        const fd = new FormData();
        fd.set("doctorId", doctorId);
        fd.set("patientId", patientId);
        fd.set("locationId", "");
        fd.set("serviceId", "");
        fd.set("startsAt", start.toISOString());
        fd.set("endsAt", end.toISOString());
        fd.set("status", "confirmed");
        fd.set("notes", "");
        return createAppointmentAction(null, fd);
      },
    },

    // —— Inventory (Traceability RBAC-INT-021; not 011) ——
    {
      id: "RBAC-INT-021",
      module: "inventory",
      role: "doctor",
      expect: "allow",
      label: "createInventoryItemAction doctor allow",
      run: async () => {
        asRole("doctor");
        const fd = new FormData();
        fd.set("name", `Item ${randomTag().slice(-6)}`);
        fd.set("unit", "kom");
        fd.set("quantity", "5");
        fd.set("lowStockThreshold", "1");
        fd.set("notes", "");
        return createInventoryItemAction(null, fd);
      },
    },
    {
      id: "RBAC-INT-021",
      module: "inventory",
      role: "accountant",
      expect: "deny",
      label: "createInventoryItemAction accountant deny",
      run: async () => {
        asRole("accountant");
        const fd = new FormData();
        fd.set("name", "should not");
        fd.set("unit", "kom");
        fd.set("quantity", "5");
        fd.set("lowStockThreshold", "1");
        fd.set("notes", "");
        return createInventoryItemAction(null, fd);
      },
    },
  ];

  it.each(matrix)(
    "$id [$module] $role → $expect — $label",
    async (row) => {
      const result = await row.run();

      if (row.expect === "deny") {
        expect(result).not.toBe("redirect");
        expect((result as ActionResult)?.error).toBe("forbidden");
        return;
      }

      // allow: redirect sentinel, success message, or past-RBAC non-forbidden
      if (result === "redirect") {
        expect(result).toBe("redirect");
        return;
      }
      expect(result?.error).not.toBe("forbidden");
      // Soft assert we didn't hit an unexpected hard failure that masks RBAC
      if (result?.error) {
        expect([
          "notFound",
          "invalid",
          "emptyFile",
          "missingHeaders",
          "alreadyPending",
          "patientNotFound",
        ]).toContain(result.error);
      }
    },
    30_000,
  );

  it("RBAC-INT-005 remains reserved for doctor peer calendar (P3.2 / CAL-INT-004) — ID not exercised here", () => {
    // Documents ID-drift intentional: T-RBAC-03 / Business-Rules J3 cite
    // RBAC-INT-005 for peer-doctor appointment scope, which is P3.2's job.
    // Calendar *module write* allow/deny is covered under RBAC-INT-017.
    expect("RBAC-INT-005").toBe("RBAC-INT-005");
  });
});
