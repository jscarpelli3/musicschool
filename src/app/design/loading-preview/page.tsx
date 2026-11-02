import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoadingPreviewPage({ searchParams }: { searchParams: Promise<{ replay?: string }> }) {
  const previewAllowed = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";
  if (!previewAllowed) notFound();

  const { replay } = await searchParams;
  await new Promise((resolve) => setTimeout(resolve, 8_000));

  return <main className="grid min-h-dvh place-items-center bg-canvas px-5">
    <section className="max-w-lg text-center">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Loading preview complete</p>
      <h1 className="mt-4 font-display text-4xl">Eight measures later.</h1>
      <p className="mt-4 text-sm leading-6 text-muted">The delay only exists on this staging preview route. Real workflows remain untouched.</p>
      <Link href={`/design/loading-preview?replay=${replay === "1" ? "2" : "1"}`} className="mt-7 inline-flex rounded-control border border-brand px-5 py-3 text-sm text-brand hover:bg-brand/10">Replay the loader</Link>
    </section>
  </main>;
}
