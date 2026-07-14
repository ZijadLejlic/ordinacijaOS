import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import type { Database } from "../../lib/supabase/database.types";
import { requireE2EEnv } from "./env";

export type DbClient = SupabaseClient<Database, "public">;
export type AppRole = Database["public"]["Enums"]["app_role"];

export function createServiceClient(): DbClient {
  const { url, serviceKey } = requireE2EEnv();
  return createClient<Database, "public">(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });
}

export function createAnonClient(): DbClient {
  const { url, anonKey } = requireE2EEnv();
  return createClient<Database, "public">(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });
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

export function randomTag() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
