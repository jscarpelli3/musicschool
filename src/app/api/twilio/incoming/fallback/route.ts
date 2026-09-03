import "server-only";

import { getTwilioIncomingFallbackUrl } from "@/lib/twilio/server";
import { handleIncomingTwilioMessage } from "../handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleIncomingTwilioMessage(request, getTwilioIncomingFallbackUrl());
}
