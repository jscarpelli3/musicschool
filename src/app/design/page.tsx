import { Bricolage_Grotesque, IBM_Plex_Sans, Newsreader } from "next/font/google";
import Link from "next/link";

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
});

const lessons = [
  ["3:00", "Maya Chen", "Piano", "Lena Ortiz"],
  ["3:30", "Noah Williams", "Guitar", "Evan Brooks"],
  ["4:15", "Amelia Davis", "Voice", "Lena Ortiz"],
];

function ScheduleSample({ displayClass }: { displayClass: string }) {
  return (
    <div className="mt-12 border-t border-current/25">
      <div className="grid grid-cols-[5rem_1fr_auto] gap-4 border-b border-current/25 py-3 text-xs">
        <span>Tuesday</span>
        <span>August 11</span>
        <span>3 lessons</span>
      </div>
      {lessons.map(([time, student, instrument, teacher]) => (
        <div
          key={`${time}-${student}`}
          className="grid grid-cols-[5rem_1fr_auto] items-baseline gap-4 border-b border-current/15 py-4"
        >
          <span className="text-sm tabular-nums opacity-60">{time}</span>
          <div>
            <p className={`${displayClass} text-xl`}>{student}</p>
            <p className="mt-1 text-xs opacity-60">{instrument}</p>
          </div>
          <span className="text-xs opacity-60">{teacher}</span>
        </div>
      ))}
    </div>
  );
}

export default function DesignStudy() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className={`${plex.className} grid gap-8 border-b border-line px-6 py-8 md:grid-cols-[1fr_2fr] md:px-12`}>
        <p className="text-sm text-brand">MusicSchool / dark study 01</p>
        <div>
          <h1 className="max-w-3xl text-3xl font-medium tracking-[-0.03em] md:text-5xl">
            Three voices for a school that happens to use software.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-muted">
            Compare hierarchy, names, schedules, and controls—not just letterforms. Nothing here is
            the final visual system yet.
          </p>
          <Link href="/design/interactions" className="mt-6 inline-block border-b border-brand pb-1 text-sm text-brand-hover">
            Explore interaction study →
          </Link>
        </div>
      </header>

      <section className={`${plex.className} grid min-h-[42rem] border-b border-line bg-canvas md:grid-cols-[1fr_2fr]`}>
        <aside className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-12">
          <p className="text-sm tabular-nums text-brand">01</p>
          <p className="mt-3 text-sm">Newsreader + IBM Plex Sans</p>
          <p className="mt-8 max-w-xs text-sm leading-6 text-muted">
            Warm and editorial. The serif belongs to names and moments; Plex handles operations.
          </p>
        </aside>
        <div className="px-6 py-10 md:px-16 md:py-14">
          <h2 className={`${newsreader.className} max-w-3xl text-5xl leading-[0.94] tracking-[-0.035em] md:text-7xl`}>
            Lessons worth making room for.
          </h2>
          <p className="mt-7 max-w-xl text-sm leading-6 text-muted">
            A clear week for teachers, families, and the people keeping the whole school in tune.
          </p>
          <ScheduleSample displayClass={newsreader.className} />
          <button className="mt-8 border-b border-brand pb-1 text-sm text-brand-hover">Review Tuesday’s schedule →</button>
        </div>
      </section>

      <section className={`${bricolage.className} grid min-h-[42rem] border-b border-line bg-surface text-ink md:grid-cols-[1fr_2fr]`}>
        <aside className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-12">
          <p className="text-sm tabular-nums text-brand">02</p>
          <p className="mt-3 text-sm">Bricolage Grotesque</p>
          <p className="mt-8 max-w-xs text-sm leading-6 text-muted">
            More immediate and social. One family, with enough character to avoid generic SaaS.
          </p>
        </aside>
        <div className="px-6 py-10 md:px-16 md:py-14">
          <h2 className="max-w-3xl text-5xl font-semibold leading-[0.91] tracking-[-0.055em] md:text-7xl">
            Tuesday sounds good already.
          </h2>
          <p className="mt-7 max-w-xl text-sm leading-6 text-muted">
            Three students, two teachers, one open room—and no schedule detective work.
          </p>
          <ScheduleSample displayClass="font-medium tracking-[-0.025em]" />
          <button className="mt-8 bg-ink px-5 py-3 text-sm text-canvas">Open the day</button>
        </div>
      </section>

      <section className={`${plex.className} grid min-h-[42rem] bg-surface-raised text-ink md:grid-cols-[1fr_2fr]`}>
        <aside className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-12">
          <p className="text-sm tabular-nums text-brand">03</p>
          <p className="mt-3 text-sm">IBM Plex Sans</p>
          <p className="mt-8 max-w-xs text-sm leading-6 text-muted">
            Precise and operational. A strong option if the product should recede behind the work.
          </p>
        </aside>
        <div className="px-6 py-10 md:px-16 md:py-14">
          <h2 className="max-w-3xl text-5xl font-light leading-[0.94] tracking-[-0.045em] md:text-7xl">
            Everyone knows what happens next.
          </h2>
          <p className="mt-7 max-w-xl text-sm leading-6 text-muted">
            Scheduling, attendance, and billing in one legible sequence.
          </p>
          <ScheduleSample displayClass="font-normal tracking-[-0.02em]" />
          <button className="mt-8 border border-current px-5 py-3 text-sm">View schedule</button>
        </div>
      </section>
    </main>
  );
}
