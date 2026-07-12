import { Resend } from "resend";

function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL");
  }
  return url;
}

function fromAddress() {
  return process.env.EMAIL_FROM ?? "OrdinacijaOS <onboarding@resend.dev>";
}

export type StaffInviteEmailInput = {
  to: string;
  fullName: string;
  clinicName: string;
  role: string;
  token: string;
  locale: string;
};

export async function sendStaffInviteEmail(input: StaffInviteEmailInput) {
  const inviteUrl = `${appUrl()}/${input.locale}/invite/${input.token}`;
  const subject = `Pozivnica za ${input.clinicName} — OrdinacijaOS`;
  const html = `
    <p>Pozdrav ${escapeHtml(input.fullName)},</p>
    <p>Pozvani ste u ordinaciju <strong>${escapeHtml(input.clinicName)}</strong>
    kao <strong>${escapeHtml(input.role)}</strong>.</p>
    <p><a href="${inviteUrl}">Postavi lozinku i pridruži se</a></p>
    <p>Link ističe za 7 dana.</p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing RESEND_API_KEY");
    }
    console.info("[email:dev] staff invite", { to: input.to, inviteUrl });
    return { id: "dev-skip", inviteUrl };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to: input.to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { id: data?.id ?? null, inviteUrl };
}

export type PasswordResetEmailInput = {
  to: string;
  fullName: string;
  clinicName: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const subject = `Reset lozinke — ${input.clinicName}`;
  const html = `
    <p>Pozdrav ${escapeHtml(input.fullName)},</p>
    <p>Vlasnik ordinacije <strong>${escapeHtml(input.clinicName)}</strong>
    je zatražio reset lozinke.</p>
    <p><a href="${escapeHtml(input.resetUrl)}">Postavi novu lozinku</a></p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing RESEND_API_KEY");
    }
    console.info("[email:dev] password reset", {
      to: input.to,
      resetUrl: input.resetUrl,
    });
    return { id: "dev-skip" };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to: input.to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { id: data?.id ?? null };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
