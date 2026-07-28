import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  resolvePlanId,
  signInAs,
  type ClinicWithRoles,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P1.5 (docs/QA/Implementation-Plan.md): "Leads deny-all; subscriptions no
 * INSERT". Closes `MKT-SEC-001` / Threat-Model `T-PII-07` and the
 * `PLAN-RLS-001` spot-check from Discrepancies.md D-13.
 *
 * `PLAN-RLS-001` ID-drift note (documented instead of inventing a catalog
 * row, same as P1.2 did for `FILE-RLS-001`): it appears **only** in
 * Discrepancies.md D-13 ("`clinic_subscriptions` no INSERT policy" spot
 * check) and in this Implementation-Plan.md's own P1.5 row — Test-
 * Strategy.md §4.1/§4.5 has no `PLAN-RLS-001` catalog row at all (grepped
 * the whole file). The closest adjacent catalog entries are the `PLAN-DB-*`
 * hard-limit rows and `LIFE-RLS-001` (readonly-clinic writes), neither of
 * which covers this. Treating it the same way P1.2 treated `FILE-RLS-001`:
 * write the test under the ID as given in the task, and flag the drift here
 * rather than fabricating a new Test-Strategy.md row.
 *
 * One file for both IDs (not two) because both are short RLS/REVOKE
 * deny-probes against a single table each, share the same
 * `createClinicWithRoles` setup shape, and don't need separate `describe`
 * files the way e.g. the MFA aal2 suite (P1.3, stateful TOTP flow) did.
 *
 * --- MKT-SEC-001 -----------------------------------------------------
 *
 * Read `supabase/migrations/20260714200000_marketing_leads.sql`: `public.
 * leads` is a **platform-level** table (no `clinic_id` — leads come from
 * the public marketing site, not from a logged-in clinic). RLS is enabled
 * but **zero policies** exist for it, and on top of that (defense in
 * depth, per the migration's own comment) it does
 * `revoke all on table public.leads from public, anon, authenticated;
 * grant select, insert, update on table public.leads to service_role;`.
 * That REVOKE means `anon`/`authenticated` callers hit a privilege-system
 * denial before RLS is even evaluated (Postgres raises `permission denied
 * for table leads`, not a silently-empty RLS result) — so every non-
 * service-role probe below expects an explicit `error`, not just an empty
 * array. This is deliberately **not** a `clinic A vs B` isolation test
 * (there's no `clinic_id` to isolate on) — it is a straight "can ANY
 * app-level actor (anon or a legitimate authenticated clinic user) reach
 * this table at all" deny-all probe, matching Test-Strategy's own wording:
 * "Leads readable by **users**".
 *
 * --- PLAN-RLS-001 ------------------------------------------------------
 *
 * Read `clinic_subscriptions`' policies in their **final** form (the b4
 * performance migration `20260713000005_code_review_b4_rls_performance.sql`
 * `drop policy if exists ... create policy ...`s replace the phase1
 * bootstrap versions of the same policy names) plus the phase1 migration's
 * own comment (`20260712900001_phase1_foundation.sql` ~line 881): "no
 * INSERT/DELETE policy by design (D-13 spot-check): rows are created only
 * via create_clinic_for_owner() (SECURITY DEFINER) or service_role." There
 * are exactly 3 policies on this table: `clinic_subscriptions_select_owner`
 * (permissive SELECT, owner-only), `clinic_subscriptions_update_owner`
 * (permissive UPDATE, owner-only), and `clinic_subscriptions_owner_mfa_aal2`
 * (RESTRICTIVE `for all`, `owner_mfa_ok()` — narrows the two permissive
 * policies above, grants nothing on its own). No permissive INSERT or
 * DELETE policy exists at all, so both commands hit Postgres' RLS
 * default-deny for that command, independent of `owner_mfa_ok()`.
 *
 * Confirmed "no INSERT policy" really means "an authenticated user cannot
 * create this row directly" (not "something else quietly does it"): grepped
 * every `insert into public.clinic_subscriptions` across migrations — all 4
 * hits (`20260713290000_phase2i_onboarding.sql`,
 * `20260713300000_phase3a_email_templates.sql`,
 * `20260714050100_phase3d_consent_draw_sign.sql`,
 * `20260714010000_create_clinic_for_owner_idempotent.sql`) are successive
 * `create or replace function public.create_clinic_for_owner(...)` bodies —
 * the same function, redefined across migrations, always `security definer`
 * with `grant execute ... to authenticated` (confirmed in the idempotent
 * migration's tail) and `revoke ... from public, anon`. So the only
 * authenticated-reachable path to a new subscription row is this one
 * SECURITY DEFINER RPC (called once, at signup, via `lib/onboarding/*`),
 * which bypasses RLS internally as its definer — there is no server action
 * or other RPC that does a plain client-side insert.
 *
 * `createClinicWithRoles()` (factories.ts) does **not** create a
 * `clinic_subscriptions` row (it only inserts `clinics` + `profiles`,
 * mirroring exactly what P0.9's factory was built for — fast role/clinic
 * setup, not exercising the real signup RPC) — this file inserts one
 * directly via the service client in `beforeAll`, exactly the way the
 * PII/RLS/DB level tests in this suite already treat "the thing a
 * SECURITY DEFINER RPC would have produced" as a setup fixture rather than
 * re-invoking the RPC (see `mfa-aal2-rls.test.ts`'s reasoning for the same
 * pattern applied to enrollment).
 *
 * Two INSERT-denial cases are included on purpose, not just the one the
 * task brief names literally ("second row for an already-subscribed
 * clinic"): that case alone would be ambiguous between "RLS denied it" and
 * "the `clinic_id` unique constraint would have caught it anyway even if
 * RLS were wide open" — a false-negative risk this suite shouldn't accept
 * for a Critical row. A second, brand-new clinic *with no subscription row
 * yet* isolates the assertion to the missing INSERT policy alone (no
 * possible unique-constraint confound), then the literal "second row for
 * an already-subscribed clinic" case is also asserted as the brief
 * describes it. Result of writing this file: no RLS/product bug found on
 * either ID — pure test-authoring task, nothing to stop-and-report under
 * `multi-tenant-security.mdc`.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

const VALID_LEAD = {
  clinicName: "Bypass Attempt Clinic",
  phone: "+38761000000",
  preferredTime: "anytime" as const,
};

describeSecurity(
  "leads deny-all & clinic_subscriptions no-INSERT/DELETE (release blocker)",
  () => {
    let url: string;
    let anonKey: string;
    let serviceKey: string;
    let service: DbClient;
    let clinic: ClinicWithRoles;
    const created: TestUser[] = [];
    const leadIdsToCleanup: string[] = [];

    beforeAll(async () => {
      ({ url, anonKey, serviceKey } = env!);
      service = createSupabaseClient(url, serviceKey);

      clinic = await createClinicWithRoles(service, {
        roles: ["owner", "doctor"],
        clinicName: `Leads & subs ${randomTag()}`,
        emailPrefix: "leads-subs",
      });
      created.push(...clinic.users);
    }, 30_000);

    afterAll(async () => {
      if (leadIdsToCleanup.length > 0) {
        await service.from("leads").delete().in("id", leadIdsToCleanup);
      }
      await cleanupClinics(service, created);
    }, 30_000);

    describe("MKT-SEC-001: leads deny-all for anon and authenticated app users", () => {
      it("anon client cannot SELECT leads", async () => {
        const anon = createSupabaseClient(url, anonKey);

        const { data, error } = await anon.from("leads").select("id");

        expect(data ?? []).toHaveLength(0);
        expect(error).not.toBeNull();
      });

      it("anon client cannot INSERT into leads (direct-table bypass of the contact-form server action)", async () => {
        const anon = createSupabaseClient(url, anonKey);

        const { error } = await anon.from("leads").insert({
          name: `Anon Bypass ${randomTag()}`,
          clinic_name: VALID_LEAD.clinicName,
          phone: VALID_LEAD.phone,
          preferred_time: VALID_LEAD.preferredTime,
        });

        expect(error).not.toBeNull();
      });

      it("authenticated app user (doctor) cannot SELECT leads", async () => {
        const client = await signInAs(
          url,
          anonKey,
          clinic.byRole.doctor!.email,
          clinic.byRole.doctor!.password,
        );

        const { data, error } = await client.from("leads").select("id");

        expect(data ?? []).toHaveLength(0);
        expect(error).not.toBeNull();
      });

      it("authenticated app user (doctor) cannot INSERT into leads", async () => {
        const client = await signInAs(
          url,
          anonKey,
          clinic.byRole.doctor!.email,
          clinic.byRole.doctor!.password,
        );

        const { error } = await client.from("leads").insert({
          name: `Doctor Bypass ${randomTag()}`,
          clinic_name: VALID_LEAD.clinicName,
          phone: VALID_LEAD.phone,
          preferred_time: VALID_LEAD.preferredTime,
        });

        expect(error).not.toBeNull();
      });

      it("bonus: service role CAN SELECT/INSERT leads (positive control — REVOKE/RLS didn't accidentally block the legitimate server-side path)", async () => {
        const { data: inserted, error: insertError } = await service
          .from("leads")
          .insert({
            name: `Service Positive Control ${randomTag()}`,
            clinic_name: VALID_LEAD.clinicName,
            phone: VALID_LEAD.phone,
            preferred_time: VALID_LEAD.preferredTime,
          })
          .select("id")
          .single();

        expect(insertError).toBeNull();
        expect(inserted?.id).toBeTruthy();
        leadIdsToCleanup.push(inserted!.id);

        const { data: selected, error: selectError } = await service
          .from("leads")
          .select("id, clinic_name")
          .eq("id", inserted!.id);

        expect(selectError).toBeNull();
        expect(selected).toHaveLength(1);
        expect(selected?.[0]?.clinic_name).toBe(VALID_LEAD.clinicName);
      });
    });

    describe("PLAN-RLS-001: clinic_subscriptions has no INSERT/DELETE policy", () => {
      let subscriptionId: string;
      let freshClinic: ClinicWithRoles;

      beforeAll(async () => {
        const planId = await resolvePlanId(service, "professional");

        const { data, error } = await service
          .from("clinic_subscriptions")
          .insert({
            clinic_id: clinic.clinicId,
            plan_id: planId,
            status: "trial",
          })
          .select("id")
          .single();
        if (error || !data) {
          throw new Error(
            error?.message ?? "clinic_subscriptions setup insert failed",
          );
        }
        subscriptionId = data.id;

        // A second, unrelated clinic that intentionally has NO subscription
        // row yet — isolates the "no INSERT policy" assertion from the
        // `clinic_id` unique-constraint confound (see file header).
        freshClinic = await createClinicWithRoles(service, {
          roles: ["owner"],
          clinicName: `Fresh sub ${randomTag()}`,
          emailPrefix: "leads-subs-fresh",
        });
        created.push(...freshClinic.users);
      }, 30_000);

      it("owner can SELECT own clinic's clinic_subscriptions row", async () => {
        const ownerClient = await signInAs(
          url,
          anonKey,
          clinic.byRole.owner!.email,
          clinic.byRole.owner!.password,
        );

        const { data, error } = await ownerClient
          .from("clinic_subscriptions")
          .select("id, status")
          .eq("clinic_id", clinic.clinicId);

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data?.[0]?.id).toBe(subscriptionId);
        expect(data?.[0]?.status).toBe("trial");
      });

      it("owner cannot INSERT their clinic's first clinic_subscriptions row directly (no unique-constraint confound: this clinic has none yet)", async () => {
        const planId = await resolvePlanId(service, "professional");
        const freshOwnerClient = await signInAs(
          url,
          anonKey,
          freshClinic.byRole.owner!.email,
          freshClinic.byRole.owner!.password,
        );

        const { error } = await freshOwnerClient
          .from("clinic_subscriptions")
          .insert({
            clinic_id: freshClinic.clinicId,
            plan_id: planId,
            status: "trial",
          });

        expect(error).not.toBeNull();

        const { data: rows } = await service
          .from("clinic_subscriptions")
          .select("id")
          .eq("clinic_id", freshClinic.clinicId);
        expect(rows ?? []).toHaveLength(0);
      });

      it("owner cannot INSERT a second clinic_subscriptions row for a clinic that already has one (simulated Stripe/RPC bypass attempt)", async () => {
        const planId = await resolvePlanId(service, "professional");
        const ownerClient = await signInAs(
          url,
          anonKey,
          clinic.byRole.owner!.email,
          clinic.byRole.owner!.password,
        );

        const { error } = await ownerClient.from("clinic_subscriptions").insert({
          clinic_id: clinic.clinicId,
          plan_id: planId,
          status: "active",
        });

        expect(error).not.toBeNull();

        const { data: rows } = await service
          .from("clinic_subscriptions")
          .select("id")
          .eq("clinic_id", clinic.clinicId);
        expect(rows).toHaveLength(1);
        expect(rows?.[0]?.id).toBe(subscriptionId);
      });

      it("owner cannot DELETE their own clinic_subscriptions row (no DELETE policy -> default deny, zero rows affected)", async () => {
        const ownerClient = await signInAs(
          url,
          anonKey,
          clinic.byRole.owner!.email,
          clinic.byRole.owner!.password,
        );

        // Postgres RLS default-deny for a command with no permissive policy
        // silently affects zero rows for DELETE/UPDATE (unlike INSERT, which
        // always raises) — assert via `.select()` on the delete (0 rows
        // returned) AND via a service-role re-read that the row survives.
        const { data: deleted, error } = await ownerClient
          .from("clinic_subscriptions")
          .delete()
          .eq("id", subscriptionId)
          .select("id");

        expect(error).toBeNull();
        expect(deleted ?? []).toHaveLength(0);

        const { data: stillThere } = await service
          .from("clinic_subscriptions")
          .select("id")
          .eq("id", subscriptionId)
          .maybeSingle();
        expect(stillThere?.id).toBe(subscriptionId);
      });

      it("bonus: doctor (non-owner) cannot UPDATE clinic_subscriptions (RBAC on the existing UPDATE policy is not accidentally loosened)", async () => {
        const doctorClient = await signInAs(
          url,
          anonKey,
          clinic.byRole.doctor!.email,
          clinic.byRole.doctor!.password,
        );

        const { data: updated, error } = await doctorClient
          .from("clinic_subscriptions")
          .update({ stripe_customer_id: `forged-${randomTag()}` })
          .eq("id", subscriptionId)
          .select("id");

        expect(error).toBeNull();
        expect(updated ?? []).toHaveLength(0);

        const { data: unchanged } = await service
          .from("clinic_subscriptions")
          .select("stripe_customer_id")
          .eq("id", subscriptionId)
          .single();
        expect(unchanged?.stripe_customer_id).toBeNull();
      });

      it("bonus: owner CAN UPDATE their own clinic_subscriptions row (positive control — the missing INSERT/DELETE policy isn't masking a broken UPDATE policy too)", async () => {
        const ownerClient = await signInAs(
          url,
          anonKey,
          clinic.byRole.owner!.email,
          clinic.byRole.owner!.password,
        );
        const stripeId = `cus_test_${randomTag()}`;

        const { error } = await ownerClient
          .from("clinic_subscriptions")
          .update({ stripe_customer_id: stripeId })
          .eq("id", subscriptionId);

        expect(error).toBeNull();

        const { data: changed } = await service
          .from("clinic_subscriptions")
          .select("stripe_customer_id")
          .eq("id", subscriptionId)
          .single();
        expect(changed?.stripe_customer_id).toBe(stripeId);
      });
    });
  },
);
