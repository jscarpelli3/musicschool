import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { createClient } from "@/lib/supabase/server";
import { archiveProduct } from "./actions";
import { ProductForm } from "./product-form";

export const dynamic = "force-dynamic";

function cadence(product: {
  sessions_per_interval: number;
  interval_count: number;
  interval_unit: string;
}) {
  const sessions = product.sessions_per_interval === 1 ? "session" : "sessions";
  const interval = product.interval_count === 1 ? product.interval_unit : `${product.interval_count} ${product.interval_unit}s`;
  return `${product.sessions_per_interval} ${sessions} every ${interval}`;
}

function fourWeekEstimate(product: { sessions_per_interval: number; interval_count: number; interval_unit: string; price_cents: number }) {
  const sessions = product.interval_unit === "week"
    ? product.sessions_per_interval * (4 / product.interval_count)
    : product.sessions_per_interval / product.interval_count;
  return Math.round(product.price_cents * sessions);
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ created?: string; archived?: string; error?: string }>;
}) {
  const { schoolId } = await params;
  const { created, archived, error } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const profileId = authData?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/products`);

  const [{ data: school }, { data: membership }, { data: products }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("service_products").select("id, name, format, duration_minutes, sessions_per_interval, interval_count, interval_unit, pricing_model, price_cents, currency, capacity, status").eq("school_id", schoolId).order("status").order("name"),
  ]);

  if (!school || !membership) notFound();
  const canManage = membership.role === "owner" || membership.role === "admin";
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="offerings" />
      <p className="border-b border-line py-6 text-sm leading-6 text-muted">Define the lessons and classes your school offers. Enrollment terms will snapshot these defaults later.</p>

      {created ? <p className="border-b border-line py-4 text-sm text-brand">Offering created.</p> : null}
      {archived ? <p className="border-b border-line py-4 text-sm text-brand">Offering archived.</p> : null}
      {error ? <p className="border-b border-line py-4 text-sm text-danger">The offering could not be archived. Nothing changed.</p> : null}

      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl font-normal">Current offerings</h2>
          <p className="mt-3 text-sm text-muted">{products?.filter((product) => product.status === "active").length ?? 0} active</p>
        </div>
        <div className="py-10 md:pl-10">
          {products?.length ? products.map((product) => (
            <article key={product.id} className="grid gap-4 border-t border-line py-5 first:border-t-0 md:grid-cols-[1fr_auto]">
              <div>
                <h3 className="text-lg">{product.name}</h3>
                <p className="mt-2 text-sm text-muted">
                  {product.format === "private_lesson" ? "Private" : `Group · ${product.capacity} seats`} · {product.duration_minutes} min · {cadence(product)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {money.format(product.price_cents / 100)} per lesson
                </p>
                <p className="mt-1 text-xs text-muted">About {money.format(fourWeekEstimate(product) / 100)} across a four-week schedule; the calendar month total follows its actual lesson count.</p>
              </div>
              {canManage && product.status === "active" ? (
                <form action={archiveProduct.bind(null, schoolId, product.id)}>
                  <button className="text-xs text-muted hover:text-ink">Archive</button>
                </form>
              ) : <span className="text-xs capitalize text-muted">{product.status}</span>}
            </article>
          )) : <p className="text-sm text-muted">No lessons or classes yet. Define the first offering below.</p>}
        </div>
      </section>

      {canManage ? (
        <section className="grid md:grid-cols-[1fr_2fr]">
          <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
            <h2 className="font-display text-3xl font-normal">New lesson or class</h2>
          </div>
          <div className="py-10 md:pl-10"><ProductForm schoolId={schoolId} /></div>
        </section>
      ) : null}
    </main>
  );
}
