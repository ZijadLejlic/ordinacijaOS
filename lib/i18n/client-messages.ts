import type { AbstractIntlMessages } from "next-intl";

/** Namespaces needed outside the app shell (cookie banner on every page). */
export const MARKETING_MESSAGE_KEYS = ["Marketing"] as const;

/** Auth / MFA / PIN / invite client forms. */
export const AUTH_MESSAGE_KEYS = [
  "Marketing",
  "Auth",
  "Mfa",
  "Pin",
  "Invite",
] as const;

function pickMessages(
  messages: AbstractIntlMessages,
  keys: readonly string[],
): AbstractIntlMessages {
  const out: AbstractIntlMessages = {};
  for (const key of keys) {
    if (key in messages) {
      out[key] = messages[key] as AbstractIntlMessages[string];
    }
  }
  return out;
}

export function marketingMessages(messages: AbstractIntlMessages) {
  return pickMessages(messages, MARKETING_MESSAGE_KEYS);
}

export function authMessages(messages: AbstractIntlMessages) {
  return pickMessages(messages, AUTH_MESSAGE_KEYS);
}
