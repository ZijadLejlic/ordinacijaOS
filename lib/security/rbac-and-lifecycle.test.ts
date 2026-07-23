import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  signInAs,
  type AppRole,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

/** P0.9: thin wrapper over the shared factory — keeps call sites below unchanged. */
async function createClinicUser(
  service: DbClient,
  options: {
    clinicName: string;
    role: AppRole;
    planCode?: string;
    clinicId?: string;
  },
): Promise<TestUser> {
  const { users } = await createClinicWithRoles(service, {
    roles: [options.role],
    clinicName: options.clinicName,
    planCode: options.planCode,
    clinicId: options.clinicId,
    emailPrefix: "rbac",
  });
  return users[0];
}

describeSecurity(
  "RBAC matrix, PIN operators, GDPR & clinic lifecycle (release blocker)",
  () => {
    // `env` is only non-null when describeSecurity === describe (not describe.skip).
    // Destructuring lazily inside beforeAll (rather than here in the describe body,
    // which vitest always executes to discover the suite) keeps the "no DB configured"
    // path a clean skip instead of a TypeError on `env!`.
    let url: string;
    let anonKey: string;
    let serviceKey: string;
    let service: DbClient;
    let owner: TestUser;
    let doctor: TestUser;
    let reception: TestUser;
    let accountant: TestUser;
    const created: TestUser[] = [];

    beforeAll(async () => {
      ({ url, anonKey, serviceKey } = env!);
      service = createSupabaseClient(url, serviceKey);

      owner = await createClinicUser(service, {
        clinicName: `RBAC Clinic ${randomTag()}`,
        role: "owner",
      });
      doctor = await createClinicUser(service, {
        clinicName: "n/a",
        role: "doctor",
        clinicId: owner.clinicId,
      });
      reception = await createClinicUser(service, {
        clinicName: "n/a",
        role: "reception",
        clinicId: owner.clinicId,
      });
      accountant = await createClinicUser(service, {
        clinicName: "n/a",
        role: "accountant",
        clinicId: owner.clinicId,
      });
      created.push(owner, doctor, reception, accountant);
    }, 60_000);

    afterAll(async () => {
      await cleanupClinics(service, created);
    }, 60_000);

    describe("RBAC matrix (PRD §3.2)", () => {
      it("finances: owner + accountant can write invoices/expenses; doctor + reception cannot", async () => {
        const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
        const doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
        const receptionClient = await signInAs(url, anonKey, reception.email, reception.password);
        const accountantClient = await signInAs(url, anonKey, accountant.email, accountant.password);

        const invoiceChecks = await Promise.all([
          ownerClient.rpc("can_write_invoices"),
          accountantClient.rpc("can_write_invoices"),
          doctorClient.rpc("can_write_invoices"),
          receptionClient.rpc("can_write_invoices"),
        ]);
        expect(invoiceChecks[0].data).toBe(true);
        expect(invoiceChecks[1].data).toBe(true);
        expect(invoiceChecks[2].data).toBe(false);
        expect(invoiceChecks[3].data).toBe(false);

        const expenseChecks = await Promise.all([
          ownerClient.rpc("can_write_expenses"),
          accountantClient.rpc("can_write_expenses"),
          doctorClient.rpc("can_write_expenses"),
          receptionClient.rpc("can_write_expenses"),
        ]);
        expect(expenseChecks[0].data).toBe(true);
        expect(expenseChecks[1].data).toBe(true);
        expect(expenseChecks[2].data).toBe(false);
        expect(expenseChecks[3].data).toBe(false);
      });

      it("clinical: owner + doctor can write patient chart / odontogram / treatment plan; accountant cannot", async () => {
        const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
        const doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
        const accountantClient = await signInAs(url, anonKey, accountant.email, accountant.password);

        for (const fn of [
          "can_write_patients",
          "can_write_odontogram",
          "can_write_treatment_plan",
        ] as const) {
          const [ownerRes, doctorRes, accountantRes] = await Promise.all([
            ownerClient.rpc(fn),
            doctorClient.rpc(fn),
            accountantClient.rpc(fn),
          ]);
          expect(ownerRes.data, fn).toBe(true);
          expect(doctorRes.data, fn).toBe(true);
          expect(accountantRes.data, fn).toBe(false);
        }
      });

      it("front desk: reception can write appointments/waitlist; accountant cannot", async () => {
        const receptionClient = await signInAs(url, anonKey, reception.email, reception.password);
        const accountantClient = await signInAs(url, anonKey, accountant.email, accountant.password);

        const [recAppt, accAppt] = await Promise.all([
          receptionClient.rpc("can_write_appointments"),
          accountantClient.rpc("can_write_appointments"),
        ]);
        expect(recAppt.data).toBe(true);
        expect(accAppt.data).toBe(false);

        const [recWaitlist, accWaitlist, docWaitlist] = await Promise.all([
          receptionClient.rpc("can_write_waitlist"),
          accountantClient.rpc("can_write_waitlist"),
          signInAs(url, anonKey, doctor.email, doctor.password).then((c) =>
            c.rpc("can_write_waitlist"),
          ),
        ]);
        expect(recWaitlist.data).toBe(true);
        expect(accWaitlist.data).toBe(false);
        expect(docWaitlist.data).toBe(false);
      });

      it("owner-only: email template writes, CSV import stay locked to owner (+ accountant for services)", async () => {
        const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
        const doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
        const receptionClient = await signInAs(url, anonKey, reception.email, reception.password);
        const accountantClient = await signInAs(url, anonKey, accountant.email, accountant.password);

        const emailTemplateChecks = await Promise.all([
          ownerClient.rpc("can_write_email_templates"),
          doctorClient.rpc("can_write_email_templates"),
          receptionClient.rpc("can_write_email_templates"),
          accountantClient.rpc("can_write_email_templates"),
        ]);
        expect(emailTemplateChecks[0].data).toBe(true);
        expect(emailTemplateChecks[1].data).toBe(false);
        expect(emailTemplateChecks[2].data).toBe(false);
        expect(emailTemplateChecks[3].data).toBe(false);

        const importChecks = await Promise.all([
          ownerClient.rpc("can_import_services"),
          accountantClient.rpc("can_import_services"),
          doctorClient.rpc("can_import_services"),
          receptionClient.rpc("can_import_services"),
        ]);
        expect(importChecks[0].data).toBe(true);
        expect(importChecks[1].data).toBe(true);
        expect(importChecks[2].data).toBe(false);
        expect(importChecks[3].data).toBe(false);
      });
    });

    describe("Audit log (owner-only, PRD §6.15)", () => {
      it("doctor in the SAME clinic cannot read any audit_events, not just cross-clinic", async () => {
        await service.from("audit_events").insert({
          clinic_id: owner.clinicId,
          actor_user_id: owner.userId,
          event_name: "test.audit_visibility",
          payload_json: {},
        });

        const doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
        const { data, error } = await doctorClient
          .from("audit_events")
          .select("id")
          .eq("clinic_id", owner.clinicId);

        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);

        const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
        const { data: ownerData, error: ownerError } = await ownerClient
          .from("audit_events")
          .select("id")
          .eq("clinic_id", owner.clinicId)
          .eq("event_name", "test.audit_visibility");

        expect(ownerError).toBeNull();
        expect(ownerData?.length ?? 0).toBeGreaterThan(0);
      });
    });

    describe("PIN operators (D10)", () => {
      it("owner creates operator for shared desk profile; non-owner cannot; wrong PIN is rejected, correct PIN works", async () => {
        const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
        const doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
        const receptionClient = await signInAs(url, anonKey, reception.email, reception.password);

        const { error: nonOwnerError } = await doctorClient.rpc("create_clinic_operator", {
          p_profile_id: reception.userId,
          p_display_name: "Should not be created",
          p_pin: "9999",
        });
        expect(nonOwnerError).not.toBeNull();
        expect(nonOwnerError?.message.toLowerCase()).toContain("forbidden");

        const { data: operatorId, error: createError } = await ownerClient.rpc(
          "create_clinic_operator",
          {
            p_profile_id: reception.userId,
            p_display_name: `Ana ${randomTag()}`,
            p_pin: "1234",
          },
        );
        expect(createError).toBeNull();
        expect(operatorId).toBeTruthy();

        const { data: wrongPinData, error: wrongPinError } = await receptionClient.rpc(
          "verify_operator_pin",
          {
            p_operator_id: operatorId as string,
            p_pin: "0000",
          },
        );
        // Wrong PIN returns empty rows (no RAISE) so the failed-count UPDATE can commit.
        expect(wrongPinError).toBeNull();
        const wrongRow = Array.isArray(wrongPinData) ? wrongPinData[0] : wrongPinData;
        expect(wrongRow?.operator_id).toBeFalsy();

        const { data: verified, error: verifyError } = await receptionClient.rpc(
          "verify_operator_pin",
          { p_operator_id: operatorId as string, p_pin: "1234" },
        );
        expect(verifyError).toBeNull();
        const row = Array.isArray(verified) ? verified[0] : verified;
        expect(row?.operator_id).toBe(operatorId);
      }, 30_000);

      it("locks shared desk profile after 5 wrong PIN attempts (D10)", async () => {
        const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
        const receptionClient = await signInAs(url, anonKey, reception.email, reception.password);

        const { data: operatorId, error: createError } = await ownerClient.rpc(
          "create_clinic_operator",
          {
            p_profile_id: reception.userId,
            p_display_name: `Lock probe ${randomTag()}`,
            p_pin: "1357",
          },
        );
        expect(createError).toBeNull();

        await service
          .from("profiles")
          .update({ pin_failed_count: 0, pin_locked_until: null })
          .eq("id", reception.userId);

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const { data, error } = await receptionClient.rpc("verify_operator_pin", {
            p_operator_id: operatorId as string,
            p_pin: "0000",
          });
          expect(error).toBeNull();
          const row = Array.isArray(data) ? data[0] : data;
          expect(row?.operator_id).toBeFalsy();
        }

        const { data: profileState } = await service
          .from("profiles")
          .select("pin_failed_count, pin_locked_until")
          .eq("id", reception.userId)
          .single();
        expect(profileState?.pin_failed_count).toBe(5);
        expect(profileState?.pin_locked_until).not.toBeNull();

        const { error: lockedWrong } = await receptionClient.rpc("verify_operator_pin", {
          p_operator_id: operatorId as string,
          p_pin: "0000",
        });
        expect(lockedWrong?.message.toLowerCase()).toContain("locked");

        const { error: lockedCorrect } = await receptionClient.rpc("verify_operator_pin", {
          p_operator_id: operatorId as string,
          p_pin: "1357",
        });
        expect(lockedCorrect?.message.toLowerCase()).toContain("locked");

        await service
          .from("profiles")
          .update({ pin_failed_count: 0, pin_locked_until: null })
          .eq("id", reception.userId);
      }, 30_000);

      it("operator from another clinic cannot be verified by a different clinic's user", async () => {
        const otherOwner = await createClinicUser(service, {
          clinicName: `RBAC Other Clinic ${randomTag()}`,
          role: "owner",
        });
        const otherReception = await createClinicUser(service, {
          clinicName: "n/a",
          role: "reception",
          clinicId: otherOwner.clinicId,
        });
        created.push(otherOwner, otherReception);

        const otherOwnerClient = await signInAs(url, anonKey, otherOwner.email, otherOwner.password);
        const { data: otherOperatorId, error: createError } = await otherOwnerClient.rpc(
          "create_clinic_operator",
          {
            p_profile_id: otherReception.userId,
            p_display_name: `Other ${randomTag()}`,
            p_pin: "4321",
          },
        );
        expect(createError).toBeNull();

        const receptionClient = await signInAs(url, anonKey, reception.email, reception.password);
        const { data, error } = await receptionClient.rpc("verify_operator_pin", {
          p_operator_id: otherOperatorId as string,
          p_pin: "4321",
        });

        const row = Array.isArray(data) ? data[0] : data;
        const verifiedForeignOperator = !error && Boolean(row?.operator_id);
        expect(verifiedForeignOperator).toBe(false);
      }, 30_000);
    });

    describe("Location plan limit (D8)", () => {
      it("professional plan (limit 2) blocks the 3rd location insert at DB layer", async () => {
        const locClinic = await createClinicUser(service, {
          clinicName: `RBAC Locations ${randomTag()}`,
          role: "owner",
          planCode: "professional",
        });
        created.push(locClinic);

        const ownerClient = await signInAs(url, anonKey, locClinic.email, locClinic.password);

        for (let i = 0; i < 2; i += 1) {
          const { error } = await ownerClient.from("clinic_locations").insert({
            clinic_id: locClinic.clinicId,
            name: `Location ${i} ${randomTag()}`,
          });
          expect(error).toBeNull();
        }

        const { error: overLimitError } = await ownerClient.from("clinic_locations").insert({
          clinic_id: locClinic.clinicId,
          name: `Over limit ${randomTag()}`,
        });
        expect(overLimitError).not.toBeNull();
        expect(overLimitError?.message.toLowerCase()).toContain("plan_limit_locations");
      }, 30_000);
    });

    describe("GDPR erasure (D35)", () => {
      it("doctor can request erasure (accountant cannot); only owner can approve, and approval hard-deletes the patient", async () => {
        const { data: patient, error: patientError } = await service
          .from("patients")
          .insert({
            clinic_id: owner.clinicId,
            first_name: "Gdpr",
            last_name: `Test${randomTag().slice(-6)}`,
            is_active: true,
          })
          .select("id")
          .single();
        expect(patientError).toBeNull();

        const accountantClient = await signInAs(url, anonKey, accountant.email, accountant.password);
        const { error: forbiddenInsert } = await accountantClient
          .from("gdpr_erasure_requests")
          .insert({
            clinic_id: owner.clinicId,
            patient_id: patient!.id,
            requested_by: accountant.userId,
          });
        expect(forbiddenInsert).not.toBeNull();

        const doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
        const { data: request, error: requestError } = await doctorClient
          .from("gdpr_erasure_requests")
          .insert({
            clinic_id: owner.clinicId,
            patient_id: patient!.id,
            requested_by: doctor.userId,
          })
          .select("id")
          .single();
        expect(requestError).toBeNull();
        expect(request?.id).toBeTruthy();

        const { error: notOwnerError } = await doctorClient.rpc(
          "approve_gdpr_patient_erasure",
          { p_request_id: request!.id },
        );
        expect(notOwnerError).not.toBeNull();
        expect(notOwnerError?.message.toLowerCase()).toContain("forbidden");

        const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
        const { data: approveResult, error: approveError } = await ownerClient.rpc(
          "approve_gdpr_patient_erasure",
          { p_request_id: request!.id },
        );
        expect(approveError).toBeNull();
        expect((approveResult as { ok?: boolean } | null)?.ok).toBe(true);

        const { data: patientAfter } = await service
          .from("patients")
          .select("id")
          .eq("id", patient!.id)
          .maybeSingle();
        expect(patientAfter).toBeNull();

        const { data: auditRows } = await service
          .from("audit_events")
          .select("payload_json")
          .eq("clinic_id", owner.clinicId)
          .eq("event_name", "gdpr.patient_erased");
        const matched = (auditRows ?? []).some(
          (row) => (row.payload_json as { patient_id?: string })?.patient_id === patient!.id,
        );
        expect(matched).toBe(true);
      }, 30_000);
    });

    describe("Clinic lifecycle (D6/D45)", () => {
      it("clinic_is_writable blocks patient writes once the clinic is marked readonly", async () => {
        const lifecycleClinic = await createClinicUser(service, {
          clinicName: `RBAC Lifecycle ${randomTag()}`,
          role: "owner",
        });
        const lifecycleDoctor = await createClinicUser(service, {
          clinicName: "n/a",
          role: "doctor",
          clinicId: lifecycleClinic.clinicId,
        });
        created.push(lifecycleClinic, lifecycleDoctor);

        const doctorClient = await signInAs(
          url,
          anonKey,
          lifecycleDoctor.email,
          lifecycleDoctor.password,
        );

        const { error: writableInsertError } = await doctorClient.from("patients").insert({
          clinic_id: lifecycleClinic.clinicId,
          first_name: "Before",
          last_name: "Readonly",
          is_active: true,
        });
        expect(writableInsertError).toBeNull();

        await service
          .from("clinics")
          .update({ status: "readonly" })
          .eq("id", lifecycleClinic.clinicId);

        const { error: readonlyInsertError } = await doctorClient.from("patients").insert({
          clinic_id: lifecycleClinic.clinicId,
          first_name: "After",
          last_name: "Readonly",
          is_active: true,
        });
        expect(readonlyInsertError).not.toBeNull();
      }, 30_000);

      it("owner can request clinic closure (→ readonly + 7d grace); non-owner cannot", async () => {
        const closureClinic = await createClinicUser(service, {
          clinicName: `RBAC Closure ${randomTag()}`,
          role: "owner",
        });
        const closureDoctor = await createClinicUser(service, {
          clinicName: "n/a",
          role: "doctor",
          clinicId: closureClinic.clinicId,
        });
        created.push(closureClinic, closureDoctor);

        const doctorClient = await signInAs(
          url,
          anonKey,
          closureDoctor.email,
          closureDoctor.password,
        );
        const { error: forbiddenError } = await doctorClient.rpc("request_clinic_closure");
        expect(forbiddenError).not.toBeNull();
        expect(forbiddenError?.message.toLowerCase()).toContain("forbidden");

        const ownerClient = await signInAs(url, anonKey, closureClinic.email, closureClinic.password);
        const { data, error } = await ownerClient.rpc("request_clinic_closure");
        expect(error).toBeNull();
        expect((data as { status?: string } | null)?.status).toBe("readonly");

        const { data: clinicRow } = await service
          .from("clinics")
          .select("status, grace_ends_at")
          .eq("id", closureClinic.clinicId)
          .single();
        expect(clinicRow?.status).toBe("readonly");
        expect(clinicRow?.grace_ends_at).not.toBeNull();
      }, 30_000);
    });
  },
);
