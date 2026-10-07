// The app's only backend: the owner's own Supabase project (Lovable Cloud is no longer used).
// Publishable key only — it is public by design; RLS enforces all permissions. Never put a secret key here.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const EXT_SUPABASE_URL =
  (import.meta.env["VITE_EXT_SUPABASE_URL"] as string | undefined) || "https://bstkoszixigsxlkvesei.supabase.co";
export const EXT_SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env["VITE_EXT_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
  "sb_publishable_uYIOWxme6ttp70TtvJv0bg_owLeCFAJ";

const isBrowser = typeof window !== "undefined";

export const supabase = createClient<Database>(EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isBrowser ? window.localStorage : undefined,
    storageKey: "eternaflor-ext-auth",
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
  },
});
