# Supabase CLI authentication without macOS Keychain

Common Time does not authorize the Supabase CLI to store or retrieve credentials from macOS Keychain. The application itself never needs Keychain access.

The CLI must receive a short-lived or deliberately managed personal access token through the process environment:

```sh
SUPABASE_ACCESS_TOKEN="<token>" supabase migration list --linked
SUPABASE_ACCESS_TOKEN="<token>" supabase db push --linked
```

Do not run `supabase login`, do not use `npx supabase` as an authentication workaround, and do not commit the token to `.env.local`, `.env.example`, shell profiles, logs, or command transcripts. Prefer a password manager's temporary environment injection or export the value only for the active terminal session, then `unset SUPABASE_ACCESS_TOKEN`.

Before a database push, always run `supabase migration list --linked` and verify the exact pending set. Never use `--include-all` unless each extra migration has been deliberately reviewed and approved.
