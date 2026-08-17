import { PRODUCT_DOMAIN } from "@/lib/brand/constants";
import type { SubmitLeadInput } from "@/lib/validations/lead";

const URL_RE = /https?:\/\/|www\./i;

/** Indexing / SEO outreach that hammers public contact forms. */
const SPAM_HOST_RE =
  /helpindex|searchregister|searchindex|search-dentord|indexkings|seosubmit/i;

const SEO_PITCH_RE =
  /google'?s?\s+search\s+index|feature .{0,40} in google|list .{0,40} in google|seo (errors|improvements|audit)|digital marketing consultant|website promotion|backlink|guest\s*post/i;

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).toLowerCase();
}

function isDentordLookalike(domain: string): boolean {
  if (!domain) return false;
  if (domain === PRODUCT_DOMAIN || domain.endsWith(`.${PRODUCT_DOMAIN}`)) {
    return false;
  }
  return domain.includes("dentord");
}

/** Instant posts are bots. Missing timestamp is allowed (tests / no JS). */
export const LEAD_MIN_SUBMIT_MS = 1500;

export function isLeadSubmittedTooFast(formTsRaw: string): boolean {
  if (!formTsRaw) return false;
  const ts = Number(formTsRaw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < LEAD_MIN_SUBMIT_MS;
}

/**
 * Content spam (W13 / T-AVL-01). Honeypot-dumb bots already drop in the
 * action; this catches form-fillers that leave `website` empty.
 */
export function detectLeadSpam(
  data: Pick<SubmitLeadInput, "name" | "clinicName" | "email" | "message">,
): { reason: string } | null {
  const email = data.email?.trim() ?? "";
  const message = data.message?.trim() ?? "";
  const blob = `${data.name} ${data.clinicName} ${email} ${message}`;

  if (URL_RE.test(blob)) {
    return { reason: "url" };
  }
  if (SPAM_HOST_RE.test(blob)) {
    return { reason: "spam_host" };
  }
  if (message && SEO_PITCH_RE.test(message)) {
    return { reason: "seo_pitch" };
  }

  const domain = emailDomain(email);
  if (isDentordLookalike(domain)) {
    return { reason: "lookalike_email" };
  }

  return null;
}
