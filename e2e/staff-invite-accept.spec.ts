import { test, expect, type Page } from "@playwright/test";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "../lib/invites/token";
import type { AppRole } from "../lib/security/factories";
import { cleanupClinics, createClinicWithRoles } from "../lib/security/factories";
import { getE2EEnv } from "./helpers/env";
import { createServiceClient, randomTag } from "./helpers/supabase";

const hasEnv = Boolean(getE2EEnv());

/**
 * AUTH-E2E-002 / D9 / Journey J2 (accept half) / §12.1.
 *
 * Mechanism (read, not invented): `acceptInviteAction` → service_role
 * `peek_clinic_invite` → `auth.admin.createUser` → `accept_clinic_invite`
 * → cookie session → redirect `/dashboard`. Public UI: `/[locale]/invite/[token]`.
 *
 * Does **not** call `createInviteAction` / Resend — inserts `clinic_invites`
 * with raw token + sha256 hash (same as AUTH-SEC-001 / createInviteAction
 * token path) and opens the invite URL directly (dev-link equivalent).
 * Token reuse / seat limit / doctor createInvite deny stay in their own tests.
 */

async function insertPendingInvite(opts: {
  clinicId: string;
  invitedBy: string;
  email: string;
  fullName: string;
  role: Exclude<AppRole, "owner">;
}) {
  const service = createServiceClient();
  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);

  const { data, error } = await service
    .from("clinic_invites")
    .insert({
      clinic_id: opts.clinicId,
      email: opts.email.toLowerCase(),
      full_name: opts.fullName,
      role: opts.role,
      token_hash: tokenHash,
      expires_at: inviteExpiresAt(),
      invited_by: opts.invitedBy,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "clinic_invites insert failed");
  }

  return { inviteId: data.id as string, token };
}

async function acceptInviteInUi(
  page: Page,
  input: {
    token: string;
    email: string;
    password: string;
    roleLabel: string;
    clinicName: string;
  },
) {
  // Logged-in users are redirected away from /invite/* (middleware).
  await page.context().clearCookies();

  await page.goto(`/bs/invite/${input.token}`);
  // CardTitle is a div (not heading role) — match visible copy.
  await expect(page.getByText("Pridruži se ordinaciji")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(
      new RegExp(
        `Pozvani ste u ${escapeRegExp(input.clinicName)} kao ${escapeRegExp(input.roleLabel)}`,
      ),
    ),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(
    input.email,
  );

  await page.getByRole("textbox", { name: "Lozinka" }).fill(input.password);
  await page.getByRole("button", { name: "Postavi lozinku i uđi" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  await expect(
    page.getByRole("heading", { name: "Kontrolna tabla" }),
  ).toBeVisible({ timeout: 30_000 });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("Staff invite accept (D9)", { tag: "@blocker" }, () => {
  test.skip(!hasEnv, "Supabase E2E env not configured");

  test("doctor + reception accept invite → correct role on dashboard", async ({
    page,
  }) => {
    const tag = randomTag();
    const clinicName = `E2E Invite ${tag}`;
    const service = createServiceClient();
    const invitedUserIds: string[] = [];

    const { clinicId, users: ownerUsers, byRole } = await createClinicWithRoles(
      service,
      {
        roles: ["owner"],
        clinicName,
        emailPrefix: "e2e-invite",
      },
    );
    const owner = byRole.owner!;

    const doctorEmail = `e2e-invite-doctor-${tag}@ordinacijaos.test`;
    const receptionEmail = `e2e-invite-reception-${tag}@ordinacijaos.test`;
    const doctorPassword = `E2E-Doc-${tag}!Aa1`;
    const receptionPassword = `E2E-Rec-${tag}!Aa1`;
    const doctorName = `E2E Doctor ${tag}`;
    const receptionName = `E2E Reception ${tag}`;

    try {
      const doctorInvite = await insertPendingInvite({
        clinicId,
        invitedBy: owner.userId,
        email: doctorEmail,
        fullName: doctorName,
        role: "doctor",
      });
      const receptionInvite = await insertPendingInvite({
        clinicId,
        invitedBy: owner.userId,
        email: receptionEmail,
        fullName: receptionName,
        role: "reception",
      });

      await acceptInviteInUi(page, {
        token: doctorInvite.token,
        email: doctorEmail,
        password: doctorPassword,
        roleLabel: "Doktor",
        clinicName,
      });

      const { data: doctorProfile } = await service
        .from("profiles")
        .select("id, role, clinic_id, full_name, is_active")
        .eq("clinic_id", clinicId)
        .eq("full_name", doctorName)
        .maybeSingle();
      expect(doctorProfile?.role).toBe("doctor");
      expect(doctorProfile?.clinic_id).toBe(clinicId);
      expect(doctorProfile?.is_active).toBe(true);
      if (doctorProfile?.id) invitedUserIds.push(doctorProfile.id);

      const { data: doctorInviteRow } = await service
        .from("clinic_invites")
        .select("status, accepted_at")
        .eq("id", doctorInvite.inviteId)
        .single();
      expect(doctorInviteRow?.status).toBe("accepted");
      expect(doctorInviteRow?.accepted_at).toBeTruthy();

      await acceptInviteInUi(page, {
        token: receptionInvite.token,
        email: receptionEmail,
        password: receptionPassword,
        roleLabel: "Recepcija",
        clinicName,
      });

      const { data: receptionProfile } = await service
        .from("profiles")
        .select("id, role, clinic_id, full_name, is_active")
        .eq("clinic_id", clinicId)
        .eq("full_name", receptionName)
        .maybeSingle();
      expect(receptionProfile?.role).toBe("reception");
      expect(receptionProfile?.clinic_id).toBe(clinicId);
      expect(receptionProfile?.is_active).toBe(true);
      if (receptionProfile?.id) invitedUserIds.push(receptionProfile.id);

      const { data: receptionInviteRow } = await service
        .from("clinic_invites")
        .select("status, accepted_at")
        .eq("id", receptionInvite.inviteId)
        .single();
      expect(receptionInviteRow?.status).toBe("accepted");
      expect(receptionInviteRow?.accepted_at).toBeTruthy();

      const { count: acceptedAudit } = await service
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("event_name", "invite.accepted");
      expect(acceptedAudit).toBeGreaterThanOrEqual(2);
    } finally {
      await cleanupClinics(service, [
        ...ownerUsers,
        ...invitedUserIds.map((userId) => ({
          clinicId,
          userId,
          email: "",
          password: "",
          role: "doctor" as AppRole,
          fullName: "",
        })),
      ]);
    }
  });
});
