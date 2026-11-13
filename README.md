# Artist Studio Workflow

A mobile-first, installable PWA for an independent ceramic artist (with painter
support) — capture work in progress, improve photos in a Photo Lab, track series
and pieces, manage gallery consignments, and draft listings with an AI assistant
grounded in the artist's own records.

Built from the PRD in `../user/files/artist-studio-workflow-prd.md` (decisions
folded in Nov 13, 2026). MVP 1 leads with the Photo Lab and AI assistant on a
minimal record foundation.

## What it does (MVP 1)

- **Onboarding** prefilled with the pilot artist (Doni Langlois / ARTful LiFe CLAY,
  Montgomery, TX, USD, America/Chicago) — fully editable.
- **Series & pieces** with slab-built ceramic stages (idea → slab prep → forming →
  joining → drying → bisque → glazing → glaze firing → finished → packed) and
  painter stages. Auto inventory numbers (e.g. `DL-2026-001`) with manual override.
  A new piece snapshots the series' shared fields at creation; later series edits
  never rewrite existing pieces.
- **Editions**: one record per edition, with edition size and sold count.
- **Milestones/sessions**: dated, with time estimate, structured key-material costs
  (clay weight, glaze cost) and free-text other costs.
- **Status**: flexible free-form status, artist-only changes, with a dated
  status/location history.
- **Photo capture**: native camera (`<input capture>`) plus file picker. HEIC is
  decoded on-device with `heic2any` to a JPEG working copy; the original file is
  always preserved as the master in IndexedDB. Where the browser cannot decode
  HEIC, the photo shows a stored-master notice instead of a preview.
- **Photo Lab**: named one-tap presets the artist picks from (True Color, Bright
  Daylight, Warm Gallery, Soft Matte, High Contrast), manual sliders, before/after
  compare, undo/reset, non-destructive edits, final-photo approval, and export
  presets (jury/web/social) with preview and batch download.
- **AI Studio**: titles, descriptions, artist statements, social captions, and
  brainstorming drafted **only** from the piece/series record fields. All output
  is labeled a suggestion and is never saved to records or published
  automatically. Concept-image generation is a clearly-labeled placeholder hook —
  no AI provider is wired yet (the PRD leaves the provider open).
- **Partners & placements**: commission terms; placements move pieces to the
  partner and hold them out of online sale prep unless explicitly overridden;
  expected payout = retail × (1 − commission%) shown everywhere; printable PDF
  manifest via print stylesheet (record only, no signature); sales with expected
  vs. confirmed vs. received payouts kept distinct; overdue-return and
  unpaid-payout alerts; CSV export of inventory and sales; search/filter by
  title, series, status, location.
- **Offline**: captures queue in an IndexedDB outbox while offline and sync to
  local storage on reconnect, with a visible queued/synced state. (A "simulate
  offline" toggle in Settings helps test the queue.)
- **The workspace ships empty** — no sample artwork mixed in. Settings offers a
  clearly-labeled, removable sample data set.

## Tech

- Vite + React 19 + TypeScript, mobile-first PWA (`vite-plugin-pwa`: web manifest,
  service worker, offline app shell).
- Persistence: IndexedDB via `idb`. No backend, no server, no accounts — data
  lives on the device.
- Photos: `heic2any` (WASM HEIC decode, bundled inline), canvas-based adjustments.
- Routing: hash routing, so the app works on any static host.
- Source is UTF-8 text only. PWA icons are generated at build time by
  `scripts/generate-icons.mjs` (pure JS PNG encoder) into `public/icons/`.

## Install & run

```sh
npm install
npm run dev        # local development server
npm run build      # type-check + production build (also regenerates PWA icons)
npm run preview    # serve the production build locally
```

## Deploy to GitHub Pages

```sh
npm run build
```

Publish the `dist/` folder as a GitHub Pages site (e.g. via the
`actions/upload-pages-artifact` + `actions/deploy-pages` workflow, or
`gh-pages -d dist`). The app uses a relative `base: './'`, so it works from a
project sub-path like `https://<user>.github.io/<repo>/`.

After deploying, open the site on a phone and use "Add to Home Screen" to
install it as a PWA.

## Known limits

- HEIC decoding depends on the browser's ability to run the bundled WASM
  decoder; where it cannot decode, masters are preserved and a notice is shown
  (Safari decodes HEIC natively; the app's working copy covers other browsers
  when the decoder runs).
- Concept-image generation is a placeholder until an AI provider is chosen.
- No multi-device sync: data lives in the browser's IndexedDB on one device.
  Use the JSON backup in Settings (records) and Photo Lab exports (images) to
  move data.
- PWA icons are generated from code; replace them with brand artwork when the
  app name/branding is decided (PRD §17, still open).
