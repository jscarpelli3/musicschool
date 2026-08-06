import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let adminClient: ReturnType<typeof createClient<Database>> | undefined;

function requiredServerEnvironment(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function createAdminClient() {
  if (adminClient) return adminClient;

  const url = requiredServerEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requiredServerEnvironment("SUPABASE_SECRET_KEY");

  if (secretKey.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SECRET_KEY cannot use a publishable key.");
  }

  adminClient = createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
