import type { Config } from "tailwindcss";

const config = {
  theme: {
    extend: {
      colors: {
        canvas: "var(--ui-canvas)",
        surface: "var(--ui-surface)",
        "surface-raised": "var(--ui-surface-raised)",
        ink: "var(--ui-ink)",
        muted: "var(--ui-muted)",
        line: "var(--ui-line)",
        brand: "var(--ui-brand)",
        "brand-hover": "var(--ui-brand-hover)",
        danger: "var(--ui-danger)",
        "outcome-rescheduled": "var(--ui-outcome-rescheduled)",
        "outcome-cancelled": "var(--ui-outcome-cancelled)",
        "outcome-no-show": "var(--ui-outcome-no-show)",
      },
      borderRadius: {
        control: "var(--ui-radius-control)",
        card: "var(--ui-radius-card)",
        panel: "var(--ui-radius-panel)",
      },
      spacing: {
        control: "var(--ui-space-control)",
        card: "var(--ui-space-card)",
        section: "var(--ui-space-section)",
      },
      boxShadow: {
        panel: "var(--ui-shadow-panel)",
      },
      fontFamily: {
        sans: "var(--ui-font-sans)",
        display: "var(--ui-font-display)",
      },
    },
  },
} satisfies Config;

export default config;
