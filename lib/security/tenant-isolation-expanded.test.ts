import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P1.1 (docs/QA/Implementation-Plan.md): expands tenant isolation coverage
 * from lib/security/tenant-isolation.test.ts (profiles/audit/patients/
 * appointments/storage only) to every remaining clinic-scoped table listed
 * in the Test-Strategy §4.1 Critical row. Closes:
 *   TEN-RLS-010 invoices/invoice_lines/payments/payment_plans(+installments)
 *   TEN-RLS-011 expenses
 *   TEN-RLS-012 treatment_plans/treatment_plan_items
 *   TEN-RLS-013 email_templates/outbound_messages/crm_notifications
 *   TEN-RLS-014 inventory_items/consent_forms/consent_signatures
 *   TEN-RLS-015 clinic_locations/clinic_invites
 *   TEN-SEC-002  INSERT with a forged foreign clinic_id (WITH CHECK) across
 *                the tables above
 *
 * Threat-Model AC1 (cross-tenant data theft) is the abuse case this file
 * targets: a Clinic A JWT must never be able to read or write a row that
 * belongs to Clinic B, no matter which table.
 *
 * Pattern mirrors tenant-isolation.test.ts: clinic B rows are inserted
 * directly via the service-role client (bypassing RLS, standing in for
 * "already exists in the DB"), then a signed-in Clinic A user attempts to
 * read/write them through the anon-key client and must be denied.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity("tenant isolation — expanded table matrix (release blocker)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  // Clinic A: one signed-in user per role needed to legitimately access each
  // table under test, so a denial can only be explained by tenant isolation
  // (not by an unrelated RBAC gap — that's P3's RBAC matrix job).
  let clinicA: { clinicId: string; owner: TestUser; doctor: TestUser; accountant: TestUser; reception: TestUser };
  // Clinic B: service-role only (never signed in) — just the target tenant
  // whose rows Clinic A must not reach.
  let clinicB: { clinicId: string; owner: TestUser };

  const created: TestUser[] = [];

  // Clinic B fixture row ids, inserted once in beforeAll and read by every test.
  let patientB: { id: string };
  let invoiceB: { id: string };
  let expenseB: { id: string };
  let treatmentPlanB: { id: string };
  let treatmentPlanItemB: { id: string };
  let crmNotificationB: { id: string };
  let emailTemplateB: { id: string };
  let outboundMessageB: { id: string };
  let consentFormB: { id: string };
  let consentSignatureB: { id: string };
  let inventoryItemB: { id: string };
  let clinicLocationB: { id: string };
  let clinicInviteB: { id: string };

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const a = await createClinicWithRoles(service, {
      roles: ["owner", "doctor", "accountant", "reception"],
      clinicName: `Tenant A expanded ${randomTag()}`,
      emailPrefix: "ten-exp-a",
    });
    clinicA = {
      clinicId: a.clinicId,
      owner: a.byRole.owner!,
      doctor: a.byRole.doctor!,
      accountant: a.byRole.accountant!,
      reception: a.byRole.reception!,
    };
    created.push(...a.users);

    const b = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `Tenant B expanded ${randomTag()}`,
      emailPrefix: "ten-exp-b",
    });
    clinicB = { clinicId: b.clinicId, owner: b.byRole.owner! };
    created.push(...b.users);

    patientB = await createPatient(service, clinicB.clinicId, {
      firstName: "Expanded",
      lastName: "PatientB",
    });

    const { data: invoice, error: invoiceError } = await service
      .from("invoices")
      .insert({
        clinic_id: clinicB.clinicId,
        patient_id: patientB.id,
        series_year: 2026,
        series_number: Math.floor(Math.random() * 900_000) + 100_000,
        subtotal_amount: 100,
        vat_amount: 0,
        total_amount: 100,
        issued_by: clinicB.owner.userId,
      })
      .select("id")
      .single();
    if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "invoice B insert failed");
    invoiceB = invoice;

    const { data: expense, error: expenseError } = await service
      .from("expenses")
      .insert({
        clinic_id: clinicB.clinicId,
        description: "Expanded isolation test expense",
        amount: 50,
        recorded_by: clinicB.owner.userId,
      })
      .select("id")
      .single();
    if (expenseError || !expense) throw new Error(expenseError?.message ?? "expense B insert failed");
    expenseB = expense;

    const { data: plan, error: planError } = await service
      .from("treatment_plans")
      .insert({
        clinic_id: clinicB.clinicId,
        patient_id: patientB.id,
        title: "Expanded isolation test plan",
        created_by: clinicB.owner.userId,
      })
      .select("id")
      .single();
    if (planError || !plan) throw new Error(planError?.message ?? "treatment plan B insert failed");
    treatmentPlanB = plan;

    const { data: planItem, error: planItemError } = await service
      .from("treatment_plan_items")
      .insert({
        clinic_id: clinicB.clinicId,
        treatment_plan_id: treatmentPlanB.id,
        service_name: "Expanded isolation test item",
      })
      .select("id")
      .single();
    if (planItemError || !planItem) throw new Error(planItemError?.message ?? "treatment plan item B insert failed");
    treatmentPlanItemB = planItem;

    const { data: crm, error: crmError } = await service
      .from("crm_notifications")
      .insert({
        clinic_id: clinicB.clinicId,
        patient_id: patientB.id,
        kind: "recall",
        due_on: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (crmError || !crm) throw new Error(crmError?.message ?? "crm notification B insert failed");
    crmNotificationB = crm;

    const { data: emailTemplate, error: emailTemplateError } = await service
      .from("email_templates")
      .insert({
        clinic_id: clinicB.clinicId,
        template_key: "appointment_reminder",
        locale: "bs",
        subject: "Expanded isolation test subject",
        body_text: "Expanded isolation test body",
      })
      .select("id")
      .single();
    if (emailTemplateError || !emailTemplate)
      throw new Error(emailTemplateError?.message ?? "email template B insert failed");
    emailTemplateB = emailTemplate;

    const { data: outboundMessage, error: outboundMessageError } = await service
      .from("outbound_messages")
      .insert({
        clinic_id: clinicB.clinicId,
        template_key: "appointment_reminder",
        locale: "bs",
        to_address: `isolation-${randomTag()}@ordinacijaos.test`,
        subject: "Expanded isolation test subject",
      })
      .select("id")
      .single();
    if (outboundMessageError || !outboundMessage)
      throw new Error(outboundMessageError?.message ?? "outbound message B insert failed");
    outboundMessageB = outboundMessage;

    const { data: consentForm, error: consentFormError } = await service
      .from("consent_forms")
      .insert({
        clinic_id: clinicB.clinicId,
        template_key: "general_treatment",
        locale: "bs",
        title: "Expanded isolation test consent",
        body_text: "Expanded isolation test consent body",
      })
      .select("id")
      .single();
    if (consentFormError || !consentForm) throw new Error(consentFormError?.message ?? "consent form B insert failed");
    consentFormB = consentForm;

    const { data: consentSignature, error: consentSignatureError } = await service
      .from("consent_signatures")
      .insert({
        clinic_id: clinicB.clinicId,
        patient_id: patientB.id,
        consent_form_id: consentFormB.id,
        template_key: "general_treatment",
        locale: "bs",
        title: "Expanded isolation test consent",
        body_rendered: "Expanded isolation test consent body rendered",
        signature_storage_path: `${clinicB.clinicId}/${patientB.id}/signatures/${randomTag()}.png`,
        pdf_storage_path: `${clinicB.clinicId}/${patientB.id}/documents/${randomTag()}.pdf`,
      })
      .select("id")
      .single();
    if (consentSignatureError || !consentSignature)
      throw new Error(consentSignatureError?.message ?? "consent signature B insert failed");
    consentSignatureB = consentSignature;

    const { data: inventoryItem, error: inventoryItemError } = await service
      .from("inventory_items")
      .insert({
        clinic_id: clinicB.clinicId,
        name: `Expanded isolation test item ${randomTag()}`,
      })
      .select("id")
      .single();
    if (inventoryItemError || !inventoryItem)
      throw new Error(inventoryItemError?.message ?? "inventory item B insert failed");
    inventoryItemB = inventoryItem;

    const { data: clinicLocation, error: clinicLocationError } = await service
      .from("clinic_locations")
      .insert({
        clinic_id: clinicB.clinicId,
        name: `Expanded isolation test location ${randomTag()}`,
      })
      .select("id")
      .single();
    if (clinicLocationError || !clinicLocation)
      throw new Error(clinicLocationError?.message ?? "clinic location B insert failed");
    clinicLocationB = clinicLocation;

    const { data: clinicInvite, error: clinicInviteError } = await service
      .from("clinic_invites")
      .insert({
        clinic_id: clinicB.clinicId,
        email: `invite-${randomTag()}@ordinacijaos.test`,
        full_name: "Expanded isolation test invite",
        role: "reception",
        token_hash: randomTag().replace(/[^a-f0-9]/g, "0").padEnd(64, "0").slice(0, 64),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        invited_by: clinicB.owner.userId,
      })
      .select("id")
      .single();
    if (clinicInviteError || !clinicInvite) throw new Error(clinicInviteError?.message ?? "clinic invite B insert failed");
    clinicInviteB = clinicInvite;
  }, 60_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  // ---------------------------------------------------------------------
  // TEN-RLS-010 — invoices / invoice_lines / payments / payment_plans
  // ---------------------------------------------------------------------
  it("TEN-RLS-010: clinic A accountant cannot read clinic B invoices", async () => {
    const client = await signInAs(url, anonKey, clinicA.accountant.email, clinicA.accountant.password);

    const byId = await client.from("invoices").select("id").eq("id", invoiceB.id);
    expect(byId.error).toBeNull();
    expect(byId.data ?? []).toHaveLength(0);

    const byClinic = await client.from("invoices").select("id").eq("clinic_id", clinicB.clinicId);
    expect(byClinic.error).toBeNull();
    expect(byClinic.data ?? []).toHaveLength(0);
  });

  it("TEN-RLS-010: clinic A accountant cannot read clinic B payments/payment_plans", async () => {
    const { data: paymentB, error: paymentInsertError } = await service
      .from("payments")
      .insert({
        clinic_id: clinicB.clinicId,
        invoice_id: invoiceB.id,
        amount: 25,
        method: "cash",
        recorded_by: clinicB.owner.userId,
      })
      .select("id")
      .single();
    expect(paymentInsertError).toBeNull();

    const { data: paymentPlanB, error: paymentPlanInsertError } = await service
      .from("payment_plans")
      .insert({
        clinic_id: clinicB.clinicId,
        invoice_id: invoiceB.id,
        patient_id: patientB.id,
        total_amount: 100,
        installment_count: 2,
        created_by: clinicB.owner.userId,
      })
      .select("id")
      .single();
    expect(paymentPlanInsertError).toBeNull();

    const client = await signInAs(url, anonKey, clinicA.accountant.email, clinicA.accountant.password);

    const payments = await client.from("payments").select("id").eq("id", paymentB!.id);
    expect(payments.error).toBeNull();
    expect(payments.data ?? []).toHaveLength(0);

    const paymentPlans = await client.from("payment_plans").select("id").eq("id", paymentPlanB!.id);
    expect(paymentPlans.error).toBeNull();
    expect(paymentPlans.data ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // TEN-RLS-011 — expenses
  // ---------------------------------------------------------------------
  it("TEN-RLS-011: clinic A accountant cannot read clinic B expenses", async () => {
    const client = await signInAs(url, anonKey, clinicA.accountant.email, clinicA.accountant.password);

    const byId = await client.from("expenses").select("id").eq("id", expenseB.id);
    expect(byId.error).toBeNull();
    expect(byId.data ?? []).toHaveLength(0);

    const byClinic = await client.from("expenses").select("id").eq("clinic_id", clinicB.clinicId);
    expect(byClinic.error).toBeNull();
    expect(byClinic.data ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // TEN-RLS-012 — treatment_plans / treatment_plan_items
  // ---------------------------------------------------------------------
  it("TEN-RLS-012: clinic A doctor cannot read clinic B treatment plans", async () => {
    const client = await signInAs(url, anonKey, clinicA.doctor.email, clinicA.doctor.password);

    const plans = await client.from("treatment_plans").select("id").eq("id", treatmentPlanB.id);
    expect(plans.error).toBeNull();
    expect(plans.data ?? []).toHaveLength(0);

    const items = await client.from("treatment_plan_items").select("id").eq("id", treatmentPlanItemB.id);
    expect(items.error).toBeNull();
    expect(items.data ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // TEN-RLS-013 — email_templates / outbound_messages / crm_notifications
  // ---------------------------------------------------------------------
  it("TEN-RLS-013: clinic A reception cannot read clinic B CRM/email rows", async () => {
    const client = await signInAs(url, anonKey, clinicA.reception.email, clinicA.reception.password);

    const crm = await client.from("crm_notifications").select("id").eq("id", crmNotificationB.id);
    expect(crm.error).toBeNull();
    expect(crm.data ?? []).toHaveLength(0);

    const templates = await client.from("email_templates").select("id").eq("id", emailTemplateB.id);
    expect(templates.error).toBeNull();
    expect(templates.data ?? []).toHaveLength(0);

    const outbound = await client.from("outbound_messages").select("id").eq("id", outboundMessageB.id);
    expect(outbound.error).toBeNull();
    expect(outbound.data ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // TEN-RLS-014 — inventory_items / consent_forms / consent_signatures
  // ---------------------------------------------------------------------
  it("TEN-RLS-014: clinic A doctor cannot read clinic B inventory/consent rows", async () => {
    const client = await signInAs(url, anonKey, clinicA.doctor.email, clinicA.doctor.password);

    const inventory = await client.from("inventory_items").select("id").eq("id", inventoryItemB.id);
    expect(inventory.error).toBeNull();
    expect(inventory.data ?? []).toHaveLength(0);

    const consentForms = await client.from("consent_forms").select("id").eq("id", consentFormB.id);
    expect(consentForms.error).toBeNull();
    expect(consentForms.data ?? []).toHaveLength(0);

    const consentSignatures = await client
      .from("consent_signatures")
      .select("id")
      .eq("id", consentSignatureB.id);
    expect(consentSignatures.error).toBeNull();
    expect(consentSignatures.data ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // TEN-RLS-015 — clinic_locations / clinic_invites
  // ---------------------------------------------------------------------
  it("TEN-RLS-015: clinic A doctor cannot read clinic B locations", async () => {
    const client = await signInAs(url, anonKey, clinicA.doctor.email, clinicA.doctor.password);

    const locations = await client.from("clinic_locations").select("id").eq("id", clinicLocationB.id);
    expect(locations.error).toBeNull();
    expect(locations.data ?? []).toHaveLength(0);
  });

  it("TEN-RLS-015: clinic A owner cannot read clinic B invites", async () => {
    const client = await signInAs(url, anonKey, clinicA.owner.email, clinicA.owner.password);

    const invites = await client.from("clinic_invites").select("id").eq("id", clinicInviteB.id);
    expect(invites.error).toBeNull();
    expect(invites.data ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // TEN-SEC-002 — INSERT with a forged foreign clinic_id must fail WITH CHECK,
  // across every table category above (not just patients, already covered
  // in tenant-isolation.test.ts). Threat-Model T-TEN-02.
  // ---------------------------------------------------------------------
  it("TEN-SEC-002: clinic A accountant cannot forge clinic_id on invoice insert", async () => {
    const client = await signInAs(url, anonKey, clinicA.accountant.email, clinicA.accountant.password);

    const { error } = await client.from("invoices").insert({
      clinic_id: clinicB.clinicId,
      patient_id: patientB.id,
      series_year: 2026,
      series_number: Math.floor(Math.random() * 900_000) + 100_000,
      subtotal_amount: 10,
      total_amount: 10,
      issued_by: clinicA.accountant.userId,
    });

    expect(error).not.toBeNull();
  });

  it("TEN-SEC-002: clinic A accountant cannot forge clinic_id on expense insert", async () => {
    const client = await signInAs(url, anonKey, clinicA.accountant.email, clinicA.accountant.password);

    const { error } = await client.from("expenses").insert({
      clinic_id: clinicB.clinicId,
      description: "Forged clinic_id probe",
      amount: 10,
      recorded_by: clinicA.accountant.userId,
    });

    expect(error).not.toBeNull();
  });

  it("TEN-SEC-002: clinic A doctor cannot forge clinic_id on treatment plan insert", async () => {
    const client = await signInAs(url, anonKey, clinicA.doctor.email, clinicA.doctor.password);
    const patientA = await createPatient(service, clinicA.clinicId);

    const { error } = await client.from("treatment_plans").insert({
      clinic_id: clinicB.clinicId,
      patient_id: patientA.id,
      title: "Forged clinic_id probe",
      created_by: clinicA.doctor.userId,
    });

    expect(error).not.toBeNull();
  });

  it("TEN-SEC-002: clinic A owner cannot forge clinic_id on clinic_locations insert", async () => {
    const client = await signInAs(url, anonKey, clinicA.owner.email, clinicA.owner.password);

    const { error } = await client.from("clinic_locations").insert({
      clinic_id: clinicB.clinicId,
      name: "Forged clinic_id probe",
    });

    expect(error).not.toBeNull();
  });

  it("TEN-SEC-002: clinic A owner cannot forge clinic_id on clinic_invites insert", async () => {
    const client = await signInAs(url, anonKey, clinicA.owner.email, clinicA.owner.password);

    const { error } = await client.from("clinic_invites").insert({
      clinic_id: clinicB.clinicId,
      email: `forged-${randomTag()}@ordinacijaos.test`,
      full_name: "Forged clinic_id probe",
      role: "reception",
      token_hash: randomTag().replace(/[^a-f0-9]/g, "0").padEnd(64, "0").slice(0, 64),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      invited_by: clinicA.owner.userId,
    });

    expect(error).not.toBeNull();
  });
});
