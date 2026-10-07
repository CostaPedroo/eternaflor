// Prepared for the move to the owner's own backend. NOT used yet.
// Activated only after VITE_EXT_SUPABASE_URL / VITE_EXT_SUPABASE_PUBLISHABLE_KEY are set
// and imports are switched from "@/integrations/supabase/client". Publishable key only — never a secret key.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const url = import.meta.env["VITE_EXT_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_EXT_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

export const externalConfigured = Boolean(url && key);

export const externalSupabase = externalConfigured
  ? createClient<Database>(url!, key!, {
      auth: {
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
