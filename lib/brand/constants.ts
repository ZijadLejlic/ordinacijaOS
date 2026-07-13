/** Public product brand (D1 — DentOrd / dentord.com). */
export const PRODUCT_NAME = "DentOrd";
export const PRODUCT_DOMAIN = "dentord.com";
export const PRODUCT_URL = `https://${PRODUCT_DOMAIN}`;
export const PRODUCT_TAGLINE = "Smarter clinic. Better care.";

/** Transactional From (Resend verified domain). */
export const EMAIL_FROM_DEFAULT = `${PRODUCT_NAME} <noreply@${PRODUCT_DOMAIN}>`;

/** Support inbox (D44). Receiving mail is outside Resend (DNS MX / mailbox provider). */
export const EMAIL_SUPPORT = `support@${PRODUCT_DOMAIN}`;

/** Optional marketing / hello alias. */
export const EMAIL_HELLO = `hello@${PRODUCT_DOMAIN}`;

/** Static assets under `public/brand/` (derived from `brand/logo-source.png`). */
export const BRAND_LOGO = {
  full: "/brand/logo.webp",
  fullPng: "/brand/logo.png",
  mark: "/brand/logo-mark.png",
} as const;

/** Palette extracted from the DentOrd logo. */
export const BRAND_COLORS = {
  blue: "#0B6EF5",
  blueDeep: "#0047C7",
  cyan: "#2EC8F0",
  navy: "#0F1B3D",
  mist: "#E8F4FF",
  wash: "#F5FAFF",
} as const;
