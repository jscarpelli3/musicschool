import { AppSignOut } from "@/components/auth/app-sign-out";

export function PortalSignOut({ label = "Sign out" }: { label?: string }) {
  return <AppSignOut label={label} destination="/portal" className="text-sm text-muted transition hover:text-ink" />;
}
