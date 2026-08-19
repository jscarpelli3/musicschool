"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PortalSignOut() {
  const router = useRouter();
  return <button type="button" onClick={async () => { await createClient().auth.signOut(); router.refresh(); }} className="text-sm text-muted hover:text-ink">Sign out</button>;
}
