import {
  createSupabaseClient,
  randomTag as sharedRandomTag,
  type AppRole,
  type DbClient,
} from "../../lib/security/factories";
import { requireE2EEnv } from "./env";

// Re-exported for existing e2e imports; the actual client/type live in the
// shared P0.9 factory module (lib/security/factories.ts).
export type { AppRole, DbClient };

export function createServiceClient(): DbClient {
  const { url, serviceKey } = requireE2EEnv();
  return createSupabaseClient(url, serviceKey);
}

export function createAnonClient(): DbClient {
  const { url, anonKey } = requireE2EEnv();
  return createSupabaseClient(url, anonKey);
}

export async function signInAs(
  email: string,
  password: string,
): Promise<DbClient> {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`signIn failed for ${email}: ${error.message}`);
  }
  return client;
}

export function randomTag(): string {
  return sharedRandomTag();
}
