import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, requestIp, RequestBoundaryError } from "@/lib/security/request-boundary";
import { buildLessonCalendar } from "@/lib/calendar/icalendar";

export const dynamic = "force-dynamic";

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) return new Response("Not found", { status: 404 });
  try {
    await enforceRateLimit({ scope: "calendar.subscription.read", subject: `token:${token}|ip:${requestIp(request.headers)}`, limit: 120, windowSeconds: 600, blockSeconds: 600 });
  } catch (caught) {
    if (caught instanceof RequestBoundaryError && caught.code === "rate_limited") return new Response("Too many requests", { status: 429, headers: { "Retry-After": String(caught.retryAfter) } });
    return new Response("Request validation unavailable", { status: 503 });
  }
  if (!TOKEN_PATTERN.test(token)) return new Response("Calendar not found", { status: 404 });

  const { data, error } = await createAdminClient().rpc("get_payer_calendar_subscription", { raw_token: token });
  if (error || !data?.length) return new Response("Calendar not found", { status: 404 });

  const metadata = data[0];
  const calendar = buildLessonCalendar(`${metadata.school_name} lessons`, data.flatMap((lesson) => lesson.lesson_id && lesson.starts_at && lesson.ends_at && lesson.updated_at
    ? [{
        lessonId: lesson.lesson_id,
        studentName: lesson.student_name ?? "Student",
        teacherName: lesson.teacher_name ?? "Teacher",
        productName: lesson.product_name ?? "Lesson",
        placeName: lesson.place_name ?? "",
        startsAt: lesson.starts_at,
        endsAt: lesson.ends_at,
        status: lesson.event_status ?? "scheduled",
        updatedAt: lesson.updated_at,
      }]
    : []));

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${metadata.school_id}-lessons.ics"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
