export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-20">
      <section className="max-w-2xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          Music School
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          The foundation is connected.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-400">
          Next.js and Supabase are ready. Authentication, tenancy, and scheduling come next.
        </p>
      </section>
    </main>
  );
}
