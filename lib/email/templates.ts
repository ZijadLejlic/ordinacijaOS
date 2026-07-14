export const EMAIL_TEMPLATE_KEYS = [
  "appointment_reminder",
  "birthday",
  "recall",
  "control",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export const EMAIL_TEMPLATE_LOCALES = ["bs", "en"] as const;
export type EmailTemplateLocale = (typeof EMAIL_TEMPLATE_LOCALES)[number];

/** PRD §6.9 — mustache-style placeholders. */
export const EMAIL_TEMPLATE_VARS = [
  "ime",
  "datum",
  "vrijeme",
  "ordinacija",
  "doktor",
  "usluga",
] as const;

export type EmailTemplateVar = (typeof EMAIL_TEMPLATE_VARS)[number];

export type TemplateVars = Record<EmailTemplateVar, string>;

export const SAMPLE_TEMPLATE_VARS: TemplateVars = {
  ime: "Ana Hodžić",
  datum: "15.07.2026.",
  vrijeme: "10:30",
  ordinacija: "Demo Ordinacija",
  doktor: "Dr. Marković",
  usluga: "Kontrolni pregled",
};

const VAR_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderTemplateString(
  template: string,
  vars: TemplateVars,
  opts?: { html?: boolean },
): string {
  const html = opts?.html ?? false;
  return template.replace(VAR_PATTERN, (_match, key: string) => {
    const normalized = key.toLowerCase() as EmailTemplateVar;
    const raw = vars[normalized] ?? "";
    return html ? escapeHtml(raw) : raw;
  });
}

/** Plain-text body → simple HTML paragraphs for Resend. */
export function bodyTextToHtml(bodyText: string, vars: TemplateVars): string {
  const rendered = renderTemplateString(bodyText, vars, { html: true });
  const paragraphs = rendered
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replaceAll("\n", "<br />")}</p>`);
  return paragraphs.join("\n") || "<p></p>";
}

export function renderEmailSubject(subject: string, vars: TemplateVars): string {
  return renderTemplateString(subject, vars, { html: false }).trim();
}
