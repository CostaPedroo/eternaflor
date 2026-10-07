// The app's only backend: the owner's own Supabase project (Lovable Cloud is no longer used).
// Publishable key only — it is public by design; RLS enforces all permissions. Never put a secret key here.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Single configuration source: VITE_EXT_SUPABASE_URL / VITE_EXT_SUPABASE_PUBLISHABLE_KEY (see .env.development / .env.production).
export const EXT_SUPABASE_URL = import.meta.env["VITE_EXT_SUPABASE_URL"] as string;
export const EXT_SUPABASE_PUBLISHABLE_KEY = import.meta.env["VITE_EXT_SUPABASE_PUBLISHABLE_KEY"] as string;
if (!EXT_SUPABASE_URL || !EXT_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_EXT_SUPABASE_URL or VITE_EXT_SUPABASE_PUBLISHABLE_KEY");
}

const isBrowser = typeof window !== "undefined";

export const supabase = createClient<Database>(EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isBrowser ? window.localStorage : undefined,
    storageKey: "eternaflor-ext-auth",
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
  },
});
