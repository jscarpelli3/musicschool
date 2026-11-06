<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Shared UI parity

- When changing a domain element that appears on more than one page or surface, locate every occurrence and verify the behavior and presentation remain consistent.
- Prefer one shared component for repeated domain UI. Use props only for intentional contextual differences such as density or surrounding navigation—not to silently remove core actions, status, safety rules, or domain information.
- Before completing a shared-UI change, search for every consumer of the component and test each relevant variant, including compact dashboard, full-page, modal, and navigation presentations.
