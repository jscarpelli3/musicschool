import { createClient } from "@/lib/supabase/server";
import { PortalAuth } from "./portal-auth";
import { PortalSignOut } from "./portal-sign-out";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return <main className="flex min-h-screen items-center px-5 py-16 sm:px-8"><PortalAuth /></main>;

  const { data: lessons, error } = await supabase.rpc("get_client_portal_lessons");
  if (error) throw new Error(`Portal schedule could not load: ${error.message}`);

  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
    <header className="flex items-end justify-between border-b border-line pb-7"><div><p className="text-sm text-brand">Family scheduling</p><h1 className="mt-3 font-display text-5xl">Upcoming lessons</h1></div><PortalSignOut /></header>
    <p className="mt-6 max-w-2xl text-sm leading-6 text-muted">Scheduled lessons for the next three months. Cancellation and reschedule controls will appear here after the access boundary is verified.</p>
    <div className="mt-10 space-y-5">{lessons?.length ? lessons.map((lesson) => {
      const start = new Date(lesson.starts_at);
      const end = new Date(lesson.ends_at);
      const date = new Intl.DateTimeFormat("en-US", { timeZone: lesson.school_timezone, weekday: "long", month: "long", day: "numeric" }).format(start);
      const time = new Intl.DateTimeFormat("en-US", { timeZone: lesson.school_timezone, hour: "numeric", minute: "2-digit" }).format(start);
      const endTime = new Intl.DateTimeFormat("en-US", { timeZone: lesson.school_timezone, hour: "numeric", minute: "2-digit" }).format(end);
      return <article key={lesson.lesson_id} className="border border-line p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-brand">{lesson.school_name}</p><h2 className="mt-2 font-display text-3xl">{lesson.student_name}</h2><p className="mt-2 text-sm text-muted">{lesson.product_name} with {lesson.teacher_name}</p></div><div className="sm:text-right"><p>{date}</p><p className="mt-1 text-sm text-muted">{time}–{endTime}</p><p className="mt-1 text-xs text-muted">{lesson.place_name}</p></div></div></article>;
    }) : <section className="border border-line p-8"><h2 className="font-display text-3xl">No upcoming lessons</h2><p className="mt-3 text-sm leading-6 text-muted">No scheduled lessons were found for contacts associated with this verified email.</p></section>}</div>
  </main>;
}
