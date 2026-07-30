import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Request-scoped auth user (React.cache).
 * Layout + page both call this — one Auth round-trip per navigation.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
