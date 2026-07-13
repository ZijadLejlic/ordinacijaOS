import type { User } from "@supabase/supabase-js";

/**
 * D41: platform admin is flagged in JWT `app_metadata` only.
 * Never trust `user_metadata` for authorization.
 *
 * Grant via Auth Admin (service role):
 * `updateUserById(id, { app_metadata: { is_platform_admin: true } })`
 */
export function isPlatformAdmin(
  user: Pick<User, "app_metadata"> | null | undefined,
): boolean {
  return user?.app_metadata?.is_platform_admin === true;
}
