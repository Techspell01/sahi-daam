# Sahi Daam

Fair-price checker PWA for all of Kerala (14 districts): fair prices for vegetables, fish, auto fares and everyday services, a verdict on any quoted price, and today's gold, fuel and gas rates. Read PLAN.md for the roadmap (phases 1–3b are live at https://sahi-daam-lime.vercel.app; India is next) and README.md for the layout.

## Stack and commands
- React 19 + Vite 8, plain CSS (`src/styles.css`), JSX, vitest. Supabase backend in `supabase/` (migrations, pgTAP tests). The CLI is pinned to 2.119.0 as a dev dependency, because 2.120.0 has no Windows binary.
- `npm run dev` (port 3100), `npm test`, `npm run build`, `npm run icons`.
- Cloud: Supabase project `sahi-daam` (ref `aifjeqlpmetchsmmzopc`, linked; DB password in `.env.local`), Vercel `npm run deploy`. Schema changes: new migration → `npx supabase db push`, then `npx supabase test db --linked`.
- Backend checks: `npx supabase start` (local, Docker), `npm run db:test`, `npm run check:sql`, `npm run check:backend`, `npm run db:catalog` after changing catalog.js.
- Areas are Kerala's 14 districts. Live prices are per `region` (a district id, or 'kerala' for the fallback); `DISTRICTS` in sources.ts must match `AREAS` (there's a test).
- Online, every price shown is real: no sample data (demo data is only for the offline version without Supabase settings). Farm prices (`src/lib/farm.js`, kinds must match `FARM_KINDS` in sources.ts) live in `rates`. Freshness: pg_cron 'fast' (gold/silver) every 15 min and 'all' hourly; the app polls `live_meta` every minute and refetches only when `changed_at` moves.
- Supabase's API connections load pg-safeupdate: every UPDATE, even in a trigger or function called over the API, needs a WHERE clause.
- Prices: real reports first, then live market prices (`src/lib/market.js`: the district's VFPCK retail, else its Agmarknet mandi ×markup, else the Kerala figure, fetched by the `refresh-prices` Edge Function), then labelled **sample** demo data (`withDemo` drops an item's demo reports once it has a live price or 20 real reports in a week). Never present sample data as real. Your own reports live in localStorage with a `sync` status (pending/ok/local) and are sent by `store.js`. Checks and settings never leave the phone.
- District comparisons (`itemAcross`, `districtIndex`, the Pulse table, the Home "you're in X" card) use VFPCK shop prices only. Mandi-only districts show their mandi price as text and aren't ranked: mandi levels differ by district for reasons unrelated to shop prices, and calibrating them against VFPCK gave Wayanad −45% and Pathanamthitta +40%.
- Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (in `.env.local`) the app runs as in phase 1.

## Rules
- **UI is strictly black and white.** No accent colours. Hierarchy comes from size, weight and inverted ink cards (the `.inverse`-style token swap in styles.css). Light and dark mode both stay monochrome.
- Keep it uncluttered: secondary forms go in bottom sheets (`Sheet` in `src/components/ui.jsx`), not more cards on the page.
- The fair-price engine is pure functions in `src/lib/stats.js` and `src/lib/fare.js`, covered by `src/lib/engine.test.js`. Keep it pure, and run `npm test` after changing it.
- Screens don't talk to Supabase. They use `useData()`, `addReport()`, `addAuto()` etc. from `src/lib/store.js`, and only `src/lib/remote.js` calls Supabase.
- Location never leaves the phone except to Photon/OSRM (OpenStreetMap). Only landmark ids are stored with fares.
- Big data paths: `shared_reports`/`shared_trips` take `after` (incremental) and keyset `page_at`/`page_id`; the cache is IndexedDB (`cache.js`). Don't go back to offset pagination or localStorage for shared data.
- Never read another user's rows directly: the tables' RLS only shows your own. Shared data goes through `shared_reports()` / `shared_trips()`, which hide `user_id`. If you change the engine maths, change `fair_range()` in SQL too and run `npm run check:sql`.
- Prices added before phase 2 (no `sync` field) were promised to stay on the phone. Never upload them.
- `npx supabase config push --yes` pushes every setting in config.toml. Settings left at `supabase init` defaults overwrite the cloud ones: on 2026-10-07 this turned email confirmations and MFA off until they were restored. Read the diff before saying yes.
- Supabase and Vercel must be the user's own accounts via the CLI. Never use the claude.ai Supabase connector: that account belongs to someone else.
- The Kerala auto rate in `src/lib/fare.js` (`AUTO_RATE`), confirmed by the user on 2026-10-07: ₹30 minimum for the first 1.5 km, then ₹1.50 per full 100 m (₹15/km), and 10 pm–5 am 50% on top of the meter fare. Meter fares aren't rounded (they can end in 50 paise); show them with `fare()` from format.js.
