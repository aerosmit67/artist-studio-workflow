<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- The imported studio app lives in src/studio (hash-routed, IndexedDB via idb) and is mounted client-only from src/routes/index.tsx; it touches window at render, so never SSR it.
- AI calls go through src/lib/ai.functions.ts server functions using @lovable.dev/ai-gateway; prompts stay server-side and drafts are grounded only in record fields.
- Service worker registration happens only in src/lib/pwa.ts (guarded against dev/preview/iframes); vite-plugin-pwa keeps devOptions disabled and injectRegister null.
- Cloud sync is offline-first: IndexedDB stays the UI's source; src/studio/lib/sync.ts queues every db.ts write and pushes to the generic studio_records table (one jsonb row per local record) and blobs to the private studio-files bucket under the user's id folder, so new local stores sync without schema changes.
- Pricing math lives in src/studio/lib/pricing.ts and listing text/hashtags in src/studio/lib/listing.ts as pure functions — keeps rules testable apart from UI.
- New optional fields on existing record types (Partner terms, ExportPreset fit/maxBytes) are read with `??` defaults — old IndexedDB/cloud rows have no migration.
