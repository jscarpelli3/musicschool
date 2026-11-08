"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthenticatedSupportLink() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void supabase.auth.getClaims().then(({ data }) => {
      if (active) setSignedIn(Boolean(data?.claims?.sub));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session?.user));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!signedIn) return null;
  return <Link href="/support" className="transition hover:text-canvas focus-visible:text-canvas">Support</Link>;
}
