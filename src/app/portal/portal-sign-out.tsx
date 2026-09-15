import { AppSignOut } from "@/components/auth/app-sign-out";

export function PortalSignOut({ label = "Sign out" }: { label?: string }) {
  return <AppSignOut label={label} destination="/portal" className="rounded-control border border-line bg-surface px-4 py-2 text-sm text-muted transition hover:-translate-y-px hover:border-brand hover:text-ink" />;
}
