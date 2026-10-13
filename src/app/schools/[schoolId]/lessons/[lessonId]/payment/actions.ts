"use server";

import { redirect } from "next/navigation";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { protectServerAction } from "@/lib/security/request-boundary";
import { createLessonQuickPayment } from "@/lib/stripe/lesson-quick-pay";
import { createClient } from "@/lib/supabase/server";

export async function beginLessonQuickPayment(schoolId: string, lessonId: string) {
  const path = `/schools/${schoolId}/lessons/${lessonId}/payment`;
  if (![schoolId, lessonId].every((value) => /^[0-9a-f-]{36}$/i.test(value))) redirect(`/schools/${schoolId}`);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.billing.manage")) redirect(`/schools/${schoolId}`);
  let requestId: string;
  try {
    await protectServerAction({ scope: "lesson.quick_payment", subject: `actor:${profileId}|school:${schoolId}|lesson:${lessonId}`, limit: 10, windowSeconds: 3600, blockSeconds: 900 });
    const request = await createLessonQuickPayment(schoolId, lessonId, profileId);
    requestId = request.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment request could not be opened.";
    const reason = message.includes("already been paid") ? "already_paid"
      : message.includes("billing account") ? "billing_account"
      : message.includes("synchronized") || message.includes("recorded price") ? "price"
      : message.includes("connecting Stripe") ? "stripe" : "failed";
    redirect(`${path}?error=${reason}`);
  }
  redirect(`${path}?request=${requestId}`);
}
