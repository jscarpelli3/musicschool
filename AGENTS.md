<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Supabase CLI authentication

- Never run `npx supabase` or `supabase login` for this repository. They may invoke a temporary CLI/profile and macOS Keychain credential storage.
- Use the installed `supabase` executable with `SUPABASE_ACCESS_TOKEN` supplied through the active process environment. Never persist or print the token in repository files, shell profiles, logs, or command output.
- Before any linked database push, run `supabase migration list --linked` and verify the exact pending migration set. Do not use `--include-all` unless every additional migration is explicitly reviewed and approved.
