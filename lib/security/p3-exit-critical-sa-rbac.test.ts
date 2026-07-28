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
 * P3 exit (docs/QA/Implementation-Plan.md): fill remaining Critical SA
 * wrong-role denies + thin module polarity gaps so exit criteria can close.
 *
 * Already COVERED — not duplicated:
 *   RBAC-INT-001..010, 012..017, 021 (rbac-int-matrix)
 *   CAL-INT-004 / RBAC-INT-005 (doctor-calendar-scope)
 *   AUTH-INT-010 seat gate / AUTH-INT-020 force logout (invite-force-logout)
 *   FIN-INT-015 legal settings (invoice-legal-settings-sa)
 *   PLAN-INT-011 feature asserts (incl. consent owner allow / waitlist reception)
 *   LIFE-RLS-001 SA write-block; LIFE-INT-001 RPC closure
 *   Audit UI = RBAC-RLS-005 (RLS SELECT only — no SA)
 *
 * This file adds:
 *   RBAC-INT-011 assistant calendar allow
 *   RBAC-INT-018 consent form doctor deny
 *   RBAC-INT-019 services doctor deny
 *   RBAC-INT-020 locations doctor deny
 *   RBAC-INT-022 createInvite doctor deny
 *   RBAC-INT-023 approvePatientErasure doctor deny
 *   RBAC-INT-024 requestClinicClosure SA doctor deny
 *   RBAC-INT-025 voidInvoice doctor role allow (D53) → invoiceNotFound on missing id
 *   RBAC-INT-026 waitlist doctor deny
 *   RBAC-INT-027 onboarding doctor deny
 *
 * Pattern: P1.6 / P3.1 SA harness.
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

import {
  addWaitlistAction,
  createAppointmentAction,
} from "@/lib/appointments/actions";
import { requestClinicClosureAction } from "@/lib/clinic/actions";
import { updateConsentFormAction } from "@/lib/consent/actions";
import { createInviteAction } from "@/lib/invites/actions";
import { voidInvoiceAction } from "@/lib/invoices/actions";
import { createLocationAction } from "@/lib/locations/actions";
import { saveOnboardingClinicAction } from "@/lib/onboarding/actions";
import { approvePatientErasureAction } from "@/lib/privacy/actions";
import { createServiceAction } from "@/lib/services/actions";

const FAKE_UUID = "00000000-0000-4000-8000-000000000099";

describeSecurity("P3 exit Critical SA wrong-role + module polarity gaps", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  const created: TestUser[] = [];
  let byRole: Partial<Record<AppRole, TestUser>>;
  let clients: Partial<Record<AppRole, DbClient>>;
  let patientId: string;

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor", "assistant", "reception", "accountant"],
      clinicName: `P3 Exit SA ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "p3-exit",
    });
    byRole = clinic.byRole;
    created.push(...clinic.users);

    const patient = await createPatient(service, clinic.clinicId, {
      firstName: "P3Exit",
      lastName: randomTag().slice(-6),
    });
    patientId = patient.id;

    clients = {};
    for (const role of [
      "owner",
      "doctor",
      "assistant",
      "reception",
      "accountant",
    ] as AppRole[]) {
      const user = byRole[role]!;
      clients[role] = await signInAs(url, anonKey, user.email, user.password);
    }
  }, 120_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  function asRole(role: AppRole) {
    activeActionClient = clients[role]!;
  }

  it("RBAC-INT-011: assistant createAppointmentAction allow", async () => {
    asRole("assistant");
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 21);
    start.setUTCHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMinutes(30);
    const fd = new FormData();
    fd.set("doctorId", byRole.doctor!.userId);
    fd.set("patientId", patientId);
    fd.set("locationId", "");
    fd.set("serviceId", "");
    fd.set("startsAt", start.toISOString());
    fd.set("endsAt", end.toISOString());
    fd.set("status", "confirmed");
    fd.set("notes", "");
    const result = await createAppointmentAction(null, fd);
    expect(result).toEqual({ message: "appointmentCreated" });
  });

  it("RBAC-INT-018: doctor updateConsentFormAction → forbidden", async () => {
    asRole("doctor");
    const fd = new FormData();
    fd.set("templateKey", "general_treatment");
    fd.set("locale", "bs");
    fd.set("title", "Should not save");
    fd.set("bodyText", "Denied body");
    const result = await updateConsentFormAction(null, fd);
    expect(result).toEqual({ error: "forbidden" });
  });

  it("RBAC-INT-019: doctor createServiceAction → forbidden", async () => {
    asRole("doctor");
    const fd = new FormData();
    fd.set("name", `Denied svc ${randomTag().slice(-6)}`);
    fd.set("code", "");
    fd.set("durationMinutes", "30");
    fd.set("priceEur", "25");
    fd.set("vatRate", "0");
    fd.set("locationId", "");
    const result = await createServiceAction(null, fd);
    expect(result).toEqual({ error: "forbidden" });
  });

  it("RBAC-INT-020: doctor createLocationAction → forbidden", async () => {
    asRole("doctor");
    const fd = new FormData();
    fd.set("name", `Denied loc ${randomTag().slice(-6)}`);
    fd.set("address", "");
    const result = await createLocationAction(null, fd);
    expect(result).toEqual({ error: "forbidden" });
  });

  it("RBAC-INT-022: doctor createInviteAction → forbidden", async () => {
    asRole("doctor");
    const fd = new FormData();
    fd.set("email", `denied-${randomTag()}@ordinacijaos.test`);
    fd.set("fullName", "Denied Invitee");
    fd.set("role", "reception");
    const result = await createInviteAction(null, fd);
    expect(result).toEqual({ error: "forbidden" });
  });

  it("RBAC-INT-023: doctor approvePatientErasureAction → forbidden", async () => {
    asRole("doctor");
    const result = await approvePatientErasureAction(FAKE_UUID);
    expect(result).toEqual({ error: "forbidden" });
  });

  it("RBAC-INT-024: doctor requestClinicClosureAction → forbidden", async () => {
    asRole("doctor");
    const result = await requestClinicClosureAction();
    expect(result).toEqual({ error: "forbidden" });
  });

  it("RBAC-INT-025: doctor voidInvoiceAction passes role gate (D53); missing id → invoiceNotFound", async () => {
    asRole("doctor");
    const fd = new FormData();
    fd.set("invoiceId", FAKE_UUID);
    fd.set("reason", "RBAC allow probe");
    const result = await voidInvoiceAction(null, fd);
    expect(result).toEqual({ error: "invoiceNotFound" });
  });

  it("RBAC-INT-026: doctor addWaitlistAction → forbidden", async () => {
    asRole("doctor");
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("doctorId", byRole.doctor!.userId);
    fd.set("serviceId", "");
    fd.set("locationId", "");
    fd.set("preferredFrom", "");
    fd.set("preferredTo", "");
    fd.set("notes", "rbac-deny");
    const result = await addWaitlistAction(null, fd);
    expect(result).toEqual({ error: "forbidden" });
  });

  it("RBAC-INT-027: doctor saveOnboardingClinicAction → forbidden", async () => {
    asRole("doctor");
    const fd = new FormData();
    fd.set("clinicName", "Should Not Save");
    fd.set("timezone", "Europe/Sarajevo");
    fd.set("phoneCountryDefault", "+387");
    // Working hours fall back to parseWorkingHours defaults when keys absent.
    const result = await saveOnboardingClinicAction(null, fd);
    expect(result).toEqual({ error: "forbidden" });
  });
});
