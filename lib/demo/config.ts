/** Shared credentials for the marketing live demo (W8). Server-only. */
export function getDemoCredentials() {
  const email = process.env.DEMO_CLINIC_EMAIL?.trim();
  const password = process.env.DEMO_CLINIC_PASSWORD?.trim();
  if (!email || !password) return null;
  return { email, password };
}

export function isDemoLoginConfigured() {
  return getDemoCredentials() !== null;
}
