# Sahi Daam: build plan

**Sahi Daam** ("the right price") tells you whether a price is fair before you pay. It shows what people near you actually paid for vegetables, fish, auto rides and everyday services, and gives a clear answer about any price you're quoted: *Good deal*, *Fair price*, *A bit high* or *Overpriced*.

Launch city: **Kochi**. Target users: students, newcomers, tourists, elderly people, and anyone who has wondered "am I being cheated?"

---

## Phase 1: working app on demo data (done)

| Area | What's built |
|---|---|
| **Check a price** | Search in English, Malayalam, Hindi or transliteration (`thakkali`, `mathi`, `oonu`). The item page shows the fair range for your area. Type a quote to get a verdict, how far it is from typical (%), and what to offer. |
| **Charts** | A dot chart of every report around the fair band, with the quoted price marked. A 30-day trend line. An area comparison. All have hover/keyboard readouts, and the trend also has a table view. |
| **Auto fare** | Kerala meter fare (₹30 for 1.5 km, then ₹15/km, plus 50% at night) and what people actually pay, checked against the driver's quote. A **Show the driver** screen shows the fare in huge type in English and Malayalam. |
| **Add a price** | A bottom sheet that takes about five seconds: amount, quantity (250 g, 500 g, 1 kg…), shop type and area. It converts to a per-kg/per-piece price and warns if the value looks like a typo. |
| **Kochi pulse** | Weekly kitchen basket index, area-by-area index (cheaper or pricier than the city), rising and falling items, and data health (reports, outliers set aside). |
| **You** | "Overcharges spotted" total, your reports (deletable), area, theme and local-name language. |
| **Design** | Pure black and white, light and dark mode, phone-first, installable PWA, works offline. |
| **Tests** | 19 unit tests for the price engine, fare maths, demo data and search (`npm test`). |

Prices are **demo data** (seeded and deterministic, 30 days, about 13,000 reports) and the app labels them that way. Reports you add are real and stored on the phone.

---

## How "fair" is calculated (`src/lib/stats.js`)

1. **Pool:** reports for the item from the last 7 days in your area. If there are fewer than 6, use all of Kochi. If there are still too few, use 30 days.
2. **Clean:** drop outliers using the **modified z-score** `0.6745 · (x − median) / MAD`, with `|z| > 3.5` treated as an outlier. Median and MAD aren't dragged around by the outliers themselves, so one ₹120/kg tourist price or a typo can't move the range.
3. **Range:** fair = P25 to P75 (the middle half), typical = median.
4. **Verdict:** ≤ P25 good · ≤ P75 fair · ≤ P75 × 1.15 a bit high · above that overpriced. Below 60% of P25 triggers "check the weight and quality".
5. **Auto fares:** each trip becomes a ratio, *fare ÷ meter fare*. The cleaned ratio distribution scales to any distance, so every trip in the city informs every other.

These are pure functions, so they can move into a Postgres function or Edge Function unchanged.

---

## Phase 2: real backend (done, live at https://sahi-daam-lime.vercel.app)

**Goal:** reports are shared between users.

| Area | What's built |
|---|---|
| **Accounts** | Anonymous Supabase sign-in, made the first time you add a price, so there's no sign-up. Opening the app and checking prices doesn't create an account. |
| **Tables** (`supabase/migrations/`) | `reports` and `auto_trips`, plus `items`, `areas` and `places` generated from `catalog.js` (`npm run db:catalog`), so unknown ids are refused. |
| **Privacy** | Row-level security: you can read and delete only your own rows. Everyone's prices come from `shared_reports()` / `shared_trips()`, which never return who reported what. "Delete my data" deletes the anonymous account, and with it every price it sent. |
| **Abuse limits** | 30 prices a day per account (trigger). Prices from accounts under 10 minutes old don't count for anyone else yet. The server sets its own time, and a price can be backdated by at most two days. The phone can send only the price columns, so it can't fake `user_id`, `created_at` or `counts_from`. |
| **Fair price in SQL** | `fair_range(prices)` is the same maths as `fairRange()` in `stats.js`. `fair_price(item, area)` adds the same area → city → 30-day fallback. The JS version stays for offline use and the charts. |
| **App** (`src/lib/store.js`, `src/lib/remote.js`) | Your prices show at once and are sent in the background. Ones added offline queue up and are sent when you're back online. Retries can't make duplicates, because the id is made on the phone. Everyone's prices are cached for offline use. Without `.env.local` the app runs exactly as in phase 1. |
| **Demo data** | Real prices replace the demo ones item by item: once an item has 20 real reports in a week, its demo reports are dropped (`withDemo` in `demo.js`). Auto fares switch after 20 real trips in 30 days. |
| **Tests** | 29 unit tests (`npm test`). 10 pgTAP tests for `fair_price` (`npm run db:test`). `npm run check:sql`: SQL and JS ranges agree on 427 demo pools (16,584 prices). `npm run check:backend`: 31 security checks with two throwaway anonymous accounts. Also checked in headless Chrome: add, offline queue, delete and "Delete my data". |

Prices you added in phase 1 were promised to stay on the phone, so they stay there, marked *phone only* on the You screen, and are never uploaded.

### Live (2026-10-07)

- Supabase project `sahi-daam` (ref `aifjeqlpmetchsmmzopc`, Mumbai), migrations applied with `npx supabase db push`, auth config with `npx supabase config push`. Only anonymous sign-in is on; email sign-up is off.
- Vercel: https://sahi-daam-lime.vercel.app (`npm run deploy`).
- All checks re-run against the cloud project: `check:backend` 31/31, `check:sql` 427/427, `supabase test db --linked` 10/10, `db lint` clean. In headless Chrome on the live site, a price reached the database and "Delete my data" removed the account and its prices.

### Later

- Delete anonymous accounts that never sent a price (a weekly `pg_cron` job).
- If abuse shows up, add Turnstile CAPTCHA to anonymous sign-in.
- The app fetches 40 days of raw reports. That's fine for thousands of reports. Past that, fetch daily item × area summaries from a SQL view instead.

## Phase 3: live prices, location and readiness for more users (live 2026-10-07)

**Live prices** (`supabase/functions/refresh-prices`, run at 6:30 am and 6:30 pm IST by pg_cron through `public.refresh_prices()`):

| Source | What | Items |
|---|---|---|
| **VFPCK** (vfpck.org, Ernakulam daily price list) | Retail and wholesale price per kg, Kerala-grown and out-of-state | 18 vegetables plus nendran: the main source |
| **Agmarknet 2.0** (api.agmarknet.gov.in, public, no key) | Mandi price for Ernakulam district, else Kerala | Garlic and fruit (apple, orange, grapes, papaya, pineapple), and any day VFPCK misses |
| **Goodreturns** (Ernakulam pages) | Petrol and diesel per litre, today plus 10 days of history | Fuel cards on Home and Pulse |

- **Fair band per source** (`BANDS` in `src/lib/market.js`): VFPCK retail ×0.9–1.15. Agmarknet ×1.1–1.45, labelled *estimate*.
- **Why VFPCK leads:** on 6 Oct 2026, VFPCK's retail prices were 0.7–1.4× Agmarknet's Ernakulam figures (potato ₹38 retail vs ₹48 "mandi"). A wholesale-plus-50% markup (the ASSOCHAM average) would have overpriced most vegetables.
- **Real reports take over:** with 6 or more in the last 7 days (area or city), reports decide the range, and the live price is used otherwise. Items with no live source (fish, meat, eggs, milk, rice, coconut, services) keep **sample** data, labelled on every screen, until real reports replace it.
- Agmarknet ignores the requested date and always returns the latest three reported days, so history builds up from the first run rather than being backfilled. Trends say "fills in day by day" until there are enough days.
- The data.gov.in API is still unreachable (connection refused), but Agmarknet 2.0's own API replaces it.

**Location** (`src/lib/geo.js`):
- "Use my location" in the area picker chooses the nearest of the 10 areas (within 12 km).
- Auto fares: "From" can be your current location, and both ends can be any place in Kochi found with Photon (OpenStreetMap). The distance is the real road route from OSRM, with the straight-line estimate as the fallback.
- Your coordinates never reach Sahi Daam's server. Only landmark ids are saved with a fare.

**Ready for more users** (load-tested locally with 60,000 reports and 6,000 trips):

| Change | Why |
|---|---|
| Incremental sync: `shared_reports(after)` returns only rows visible since the last fetch, with a full refresh daily | A return visit downloads only what's new: 34 ms, and 1,000 users over 20 s gave p95 26 ms with no errors |
| Keyset pages (`page_at`, `page_id`) instead of offsets | The functions can't be inlined, so with offsets every page re-ran the whole query |
| The cache of everyone's prices lives in IndexedDB (`src/lib/cache.js`), not localStorage | localStorage tops out around 5 MB (about 30,000 reports) |
| The cache is written, and screens recomputed, only when something changed | Avoids a freeze on every two-minute refresh |
| Anonymous sign-ins raised to 150 per hour per IP | So a whole college on one Wi-Fi can add prices |
| supabase-js loads lazily (55 kB gzipped, separate chunk) | First screen loads faster |

Phone-speed numbers for the production build (4× CPU throttle):

| Reports | First open: list / data / longest freeze | Return visit: list / longest freeze |
|---|---|---|
| 10,000 | 1.0 s / 2.0 s / 0.25 s | 0.5 s / 0.11 s |
| 60,000 | 1.0 s / 4.7 s / 0.7 s | 1.0 s / 0.6 s |

**Next, past about 50,000 reports:** serve a CDN-cached snapshot (written every 10 minutes) for first opens and keep only the deltas live, or send daily item × area summaries for days older than a week. Supabase free tier limits to watch: 500 MB database (60k reports use 32 MB), 5 GB egress a month, 50k monthly active users. Anonymous accounts that never add a price still count, so add a weekly clean-up job.

**Released** on 2026-10-07: migrations pushed, `refresh-prices` deployed (`--no-verify-jwt`, guarded by the `REFRESH_SECRET` function secret, with the same value in Vault as `refresh_prices_secret`, next to `refresh_prices_url`), and the pg_cron job `sahidaam-refresh-prices` runs at 01:00 and 13:00 UTC.

## Phase 3b: all of Kerala and Today's rates (live 2026-10-07)

**Areas are the 14 districts** (`AREAS` in `src/lib/catalog.js`). "Use my location" picks the district whose middle is nearest, within 45 km, so Coimbatore and Mangaluru count as outside Kerala. Old Kochi neighbourhood ids in phones' saved data map to Ernakulam.

**Live prices per district** (`DISTRICTS` in `supabase/functions/refresh-prices/sources.ts`; a test checks it matches `AREAS`):

| District | Vegetables | Fuel and LPG page |
|---|---|---|
| Alappuzha, Kottayam, Ernakulam, Thrissur, Palakkad, Malappuram (Manjeri), Kannur (Thalassery) | VFPCK retail at that market | own |
| Thiruvananthapuram, Kollam, Idukki, Kozhikode, Wayanad, Kasaragod | Agmarknet for the district, else the Kerala VFPCK average | own (Thiruvananthapuram uses the "trivandrum" page) |
| Pathanamthitta | as above | Kottayam's (no page of its own) |

- `region = 'kerala'` rows hold the VFPCK average across the 7 markets and Agmarknet for all of Kerala. The app falls back to them when a district has no recent price of its own.
- "Across Kerala" (item page) and "Vegetables by district" (Pulse) compare districts **within one source only**: VFPCK when at least 3 districts have it, else Agmarknet. Mixing them showed Wayanad 42% cheaper, which wasn't real.

**Today's rates tab** (replaces the Auto tab; Auto is a card on Check, with a back button):
- 22K and 24K gold per gram and per pavan (8 g), and silver, Kerala-wide (Goodreturns `gold-rates/kerala`, `silver-rates/kerala`).
- Petrol, diesel and the 14.2 kg LPG cylinder for your district. LPG changes on the 1st, and the monthly history is stored dated the 1st.
- Table `rates (kind, region, day, price)`. Fuel stays in `fuel_prices` (now per region, with `city` = the page used).

**Checks on 2026-10-07 (cloud):** `check:backend` 31/31, `check:sql` 579/579, `supabase test db --linked` all pass. The refresh run gave 647 market rows, 308 fuel rows and 184 rate rows, with no errors. The live site was walked through as a Thrissur user (by GPS) and a Kozhikode user. The upgrade from the Kochi schema was tested by rolling a local database back to it, adding old rows and migrating.

## Phase 3d: all 14 districts compared, and "you're in X" (live 2026-10-07)

- Item pages list **all 14 districts**. Districts with a VFPCK shop price are ranked on a dot scale. Mandi-only districts show their mandi price as plain text and aren't ranked, and districts with neither show "–".
- Pulse ranks districts against the Kerala middle and has a **price table** (tomato, onion, shallots, potato) for every district. The district picker shows each district's percentage.
- Home compares your district with Kerala. When location is already allowed and your phone is in another district, it says "You're in Ernakulam right now: vegetables 7% pricier than Thrissur" and offers to switch. It never prompts for location (`silentPosition`).
- **Why mandi prices aren't ranked:** calibrating Agmarknet against VFPCK per item still gave Wayanad −45% and Pathanamthitta +40%. Their mandis run at about 0.5× and 1.5× the Kerala middle on *every* vegetable (farm-gate versus near-retail markets), a district-wide bias that outlier filters can't catch. The fix is a real retail source for those districts; see the ideas below.
- Code: public at https://github.com/Techspell01/sahi-daam. Also on the GitHub profile (Projects card, Data & ML) and featured on the portfolio.

## Phase 3e: farm prices, real data only, and freshness (live 2026-10-07)

- **Farm prices** on the Rates tab, all in ₹/kg:
  - Rubber Board (Kottayam): RSS-4, RSS-5, ISNR-20, latex. Fetched over http, because the https certificate chains to "ISRG Root YR", which Deno doesn't trust yet.
  - Spices Board (Kochi): pepper ungarbled and garbled, nutmeg, mace, clove, and small cardamom (the day's e-auctions, averaged by kilos sold).
  - Agmarknet (Kerala): coconut by weight, copra, arecanut, coffee, cocoa, cashew, paddy, tapioca.
- **Real data only:** online, the app no longer shows sample prices. Items with no public source and no reports show "–", and "people usually pay" for autos appears only with real trips. Demo data remains only for the offline version (no Supabase settings).
- **Freshness:**
  - pg_cron runs `refresh_prices('fast')` (gold, silver) every 15 minutes and `refresh_prices('all')` hourly at :05.
  - Each run calls `mark_checked()`. Row triggers move `live_meta.changed_at` only on a new or changed price; an upsert of the same value doesn't count.
  - The app reads `live_meta` every minute while visible, and refetches prices only when `changed_at` moves. The Rates tab says "Checked N min ago".
  - On the live site, 2 checks were seen in 150 s and nothing was refetched while nothing had changed.
- **Gotcha:** Supabase's API connections load pg-safeupdate, so every `UPDATE` (even in a trigger) needs a `WHERE`. A trigger without one rolled back a whole rates upsert. The local stack doesn't load it, so local tests won't catch this.

## Ideas (not started)

**What people will use every day or week**
- **Gold jewellery quote check:** weight, purity, making charge % and GST → the fair final price, checked against the jeweller's quote. Builds on the gold rate already fetched.
- **Market list:** a shopping list with the fair price of each item and the expected total. Ticking an item off at the shop records what you paid, so every list becomes price reports.
- **Price alerts:** "tomato under ₹40 in Thrissur" or "gold down ₹500 a pavan", by Web Push (the same setup as Weee).
- **KSRTC bus and taxi fares,** next to the auto fare.

**Data**
- **DCA retail prices** (fcainfoweb, about 550 centres, 22 essentials). These are real shop prices for the district headquarters VFPCK doesn't cover, so all 14 districts could be ranked. It's an ASP.NET postback form, so expect a few steps of scraping.
- **Fish prices:** the biggest gap. Matsyafed fish-mart price lists, or a campaign to collect reports at fish markets.
- Learn the Agmarknet → retail margin per district from VFPCK overlap and real reports, then check it against held-out weeks.

**Growth**
- **Share a verdict** as an image card to WhatsApp ("Tomato ₹70 at Thrissur: Overpriced, fair ₹41–52").
- A full **Malayalam UI**.
- A weekly district digest: "This week in Thrissur: tomato −8%, onion +5%".

## Phase 3c: India (next)

- Agmarknet covers every district in India. The client already handles a region with a state-wide fallback, so regions become state → district.
- Fuel and LPG: Goodreturns has city pages for most of India. Gold rates are per state or city.
- **Auto fares differ by city.** Add a verified `AUTO_RATE` per city, with source and date, and show no meter fare where the rate isn't verified.
- Item names in more languages (Tamil, Kannada, Telugu, Hindi variants), and regional items.
- Outside Kerala there's no VFPCK equivalent, so most prices are Agmarknet estimates. Check the markup per state against real reports before launching a state. The DCA retail price list (fcainfoweb, 550 centres) could give real retail prices for 22 essentials.

## Phase 4: trust and data quality (week 3–4)

- **Reporter trust score:** reports close to the eventual median raise it, while outliers and many-reports-in-a-minute lower it. Weight ranges by trust.
- ~~**Coarse location check:** suggest the area from GPS~~ (done in phase 3: "Use my location").
- **Receipt photo to price (optional):** read the bill text on-device or with a vision model, then match item names to the catalogue.
- **Unit sanity:** catch "₹40 for 250 g entered as 1 kg" by comparing with the unit the price most resembles.

## Phase 5: people actually using it (week 4–5)

- **Launch kit** is ready in `marketing/` (logo, post images, screenshots, post text in `POSTS.md`).
- **Share a verdict:** a black-and-white card image ("Tomato ₹70: Overpriced. Fair is ₹42–47 in Kakkanad") to WhatsApp. This is the main way the app spreads.
- Full **Malayalam UI**, not just item names. Then Hindi.
- **Alerts:** "Tomatoes up 20% in your area this week."
- More items (on request) and a second city.
- Android app via Capacitor, as planned for Weee.

## Phase 6: analytics and ML for your portfolio (alongside)

- **SQL views:** daily item × area medians, basket index, area index, reporter funnel (open → check → report).
- **Forecast:** a 7-day price forecast per item (seasonal naive baseline vs a gradient-boosted or Prophet model), scored with MAPE on held-out weeks.
- **Outlier detector evaluation:** inject known bad prices into the demo data and report precision and recall of the MAD filter against IQR and z-score filters.
- Write it up as a case study: problem, data, method, results, what you'd do next.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| No users means no data | Demo data now, government mandi data in phase 3, launch on one campus or neighbourhood first |
| Shop owners posting fake prices | MAD outlier filter, trust scores, per-account rate limits |
| Quality and unit differences (premium tomatoes, short weight) | Shop type in every report, verdict tip "check the weight and quality", per-unit normalisation |
| Auto fare rates change | One config object (`AUTO_RATE` in `src/lib/fare.js`), with the source shown in the app |
| Privacy | Anonymous accounts, area-level location only, users can delete their reports |

## Demo script (2 minutes)

1. Home → "Moving this week" shows tomato rising.
2. Tomato → type **70** → *Overpriced*, with how far above typical it is and what to offer. The dot chart shows ₹70 far outside the band.
3. Add price → ₹120 for 500 g sardine → it's saved as ₹240/kg and appears as a black dot.
4. Auto → Kakkanad to Vyttila → meter fare **₹126** → driver asks ₹150 → *A bit high* → **Show the driver**.
5. Pulse → basket index, the cheapest areas, and how many outliers were set aside.
