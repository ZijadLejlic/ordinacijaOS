export const CONSENT_TEMPLATE_KEYS = [
  "general_treatment",
  "data_processing",
  "radiography",
] as const;
export type ConsentTemplateKey = (typeof CONSENT_TEMPLATE_KEYS)[number];

export const CONSENT_TEMPLATE_LOCALES = ["bs", "en"] as const;
export type ConsentTemplateLocale = (typeof CONSENT_TEMPLATE_LOCALES)[number];

/** PRD §6.11 — mustache-style placeholders on consent templates. */
export const CONSENT_TEMPLATE_VARS = ["ime", "datum", "ordinacija"] as const;
export type ConsentTemplateVar = (typeof CONSENT_TEMPLATE_VARS)[number];

export type ConsentTemplateVars = Record<ConsentTemplateVar, string>;

const VAR_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function renderConsentTemplate(
  template: string,
  vars: ConsentTemplateVars,
): string {
  return template.replace(VAR_PATTERN, (_match, key: string) => {
    const normalized = key.toLowerCase() as ConsentTemplateVar;
    return vars[normalized] ?? "";
  });
}
