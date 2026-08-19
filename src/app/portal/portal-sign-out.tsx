"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PortalSignOut({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();
  return <button type="button" onClick={async () => { await createClient().auth.signOut({ scope: "local" }); router.refresh(); }} className="text-sm text-muted hover:text-ink">{label}</button>;
}
