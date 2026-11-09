import "server-only";

import type { Json } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

export type IncidentProvider = "application" | "stripe" | "resend" | "twilio" | "supabase";
export type IncidentSeverity = "info" | "warning" | "urgent";

export async function recordPlatformIncident(input: {
  fingerprint: string;
  provider: IncidentProvider;
  severity: IncidentSeverity;
  title: string;
  summary: string;
  sourceKind: string;
  sourceId?: string | null;
  schoolId?: string | null;
  metadata?: Record<string, Json | undefined>;
}) {
  const admin = createAdminClient();
  const rpc = admin.rpc.bind(admin) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: string | null; error: { code?: string } | null }>;
  const metadata = Object.fromEntries(Object.entries(input.metadata ?? {}).filter((entry) => entry[1] !== undefined)) as Json;
  const { data, error } = await rpc("record_platform_incident", {
    p_fingerprint: input.fingerprint,
    p_provider: input.provider,
    p_severity: input.severity,
    p_title: input.title,
    p_summary: input.summary,
    p_source_kind: input.sourceKind,
    p_source_id: input.sourceId ?? null,
    p_school_id: input.schoolId ?? null,
    p_metadata: metadata,
  });
  if (error) console.error("Platform incident could not be recorded", { provider: input.provider, sourceKind: input.sourceKind, code: error.code ?? "unknown" });
  return data;
}
