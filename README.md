# Music School

A lean, multi-tenant music-school operations app built with Next.js, Supabase, and TypeScript.

## Development

Requirements: Node.js 22 LTS and the Supabase CLI.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and supply the Supabase project values before starting the app. Never commit `.env.local`.

Project context lives in [`docs/context/project-brief.md`](docs/context/project-brief.md).

Operational tracking lives in:

- [`docs/context/current-status.md`](docs/context/current-status.md)
- [`docs/context/decision-log.md`](docs/context/decision-log.md)
- [`docs/context/work-log.md`](docs/context/work-log.md)
- [`docs/context/open-questions.md`](docs/context/open-questions.md)
- [`docs/context/architecture-notes.md`](docs/context/architecture-notes.md)
- [`docs/context/cost-estimate.md`](docs/context/cost-estimate.md)
- [`docs/context/account-setup.md`](docs/context/account-setup.md)
- [`docs/operations/domain-cutover.md`](docs/operations/domain-cutover.md)

When new work starts, update `current-status.md` first. When a significant choice is made, record it in `decision-log.md`.
