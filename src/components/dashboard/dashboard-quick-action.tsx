import type { IconType } from "react-icons";

export const dashboardQuickActionClass = "flex aspect-square h-full min-h-0 w-full flex-col items-center justify-center rounded-card border border-transparent bg-surface-raised/55 px-3 py-4 text-center shadow-[var(--ui-shadow-soft)] transition duration-200 hover:-translate-y-1 hover:border-brand/50 hover:bg-surface-raised hover:text-brand hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 sm:aspect-auto sm:min-h-40 sm:px-6 sm:py-7 sm:hover:scale-[1.025]";

export function DashboardQuickActionContent({ icon: Icon, title, description }: { icon: IconType; title: string; description: string }) {
  return <>
    <Icon aria-hidden="true" className="mb-2 text-2xl text-brand sm:text-3xl" />
    <span className="font-display text-lg font-normal leading-tight tracking-[-0.03em] sm:text-3xl">{title}</span>
    <span className="mt-2 hidden max-w-xs text-xs leading-5 text-muted sm:block">{description}</span>
  </>;
}
