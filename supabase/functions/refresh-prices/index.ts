// Fetches live prices into the database, called by pg_cron through
// public.refresh_prices(tier) with a shared secret:
//   'fast' (every 15 minutes): gold and silver, which change during the day.
//   'all' (every hour): everything. VFPCK retail at district markets (and their
//     Kerala average), Agmarknet per district and Kerala-wide, fuel and LPG per
//     district, gold, silver, and farm prices (Rubber Board, Spices Board, Agmarknet).
// Each run ends by marking live_meta.checked_at; price changes move changed_at.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  AGMARKNET, agmarknetBody, DISTRICTS, farmBody, fuelUrl, type FuelRow, GOLD, lpgUrl, type MarketRow, parseAgmarknet,
  parseFarmAgmarknet, parseFuel, parseGold, parseLpg, parseRubber, parseSilver, parseSpices, parseVfpck, type RateRow,
  RUBBER, SILVER, SPICES, vfpckUrl,
} from './sources.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const SECRET = Deno.env.get('REFRESH_SECRET');
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Run `jobs` a few at a time, so no site gets dozens of requests at once.
async function pool<T>(jobs: (() => Promise<T>)[], size = 4): Promise<T[]> {
  const out: T[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < jobs.length) out.push(await jobs[next++]());
  }));
  return out;
}

async function get(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': BROWSER, ...init.headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// Agmarknet answers with the latest reported day and the two before it (it
// ignores older dates), so two runs a day keep the history complete.
async function refreshMarkets() {
  const date = isoDay(Date.now());
  const errors: string[] = [];
  const agmarknet = (region: string, districts: number[]) => async (): Promise<MarketRow[]> => {
    try {
      const res = await get(AGMARKNET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://agmarknet.gov.in' },
        body: JSON.stringify(agmarknetBody(date, districts)),
      });
      return parseAgmarknet(await res.json(), region);
    } catch (e) {
      errors.push(`agmarknet ${region}: ${errorText(e)}`);
      return [];
    }
  };
  const vfpck = (region: string, id: number) => async (): Promise<MarketRow[]> => {
    try {
      const found = parseVfpck(await (await get(vfpckUrl(id))).text(), region);
      if (!found.length) throw new Error('no prices on the page');
      return found;
    } catch (e) {
      errors.push(`vfpck ${region}: ${errorText(e)}`);
      return [];
    }
  };
  const jobs = [agmarknet('kerala', [])];
  for (const [region, d] of Object.entries(DISTRICTS)) {
    jobs.push(agmarknet(region, d.agmarknet));
    if (d.vfpck) jobs.push(vfpck(region, d.vfpck));
  }
  const rows = (await pool(jobs)).flat();

  // Kerala-wide VFPCK: the average over the district markets, per item and day.
  const byItemDay = new Map<string, MarketRow[]>();
  for (const r of rows) {
    if (r.source !== 'vfpck') continue;
    const k = `${r.item_id}|${r.day}`;
    byItemDay.set(k, [...(byItemDay.get(k) ?? []), r]);
  }
  const avg = (xs: number[]) => Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100;
  for (const list of byItemDay.values()) {
    const w = list.map(r => r.wholesale).filter((x): x is number => x != null);
    rows.push({ ...list[0], region: 'kerala', price: avg(list.map(r => r.price)), wholesale: w.length ? avg(w) : null });
  }

  if (rows.length) {
    const fetched_at = new Date().toISOString();
    const { error } = await db.from('market_prices').upsert(rows.map(r => ({ ...r, fetched_at })));
    if (error) errors.push(`market_prices: ${error.message}`);
  }
  return { rows: rows.length, errors };
}

async function refreshFuel() {
  const errors: string[] = [];
  const jobs = Object.entries(DISTRICTS).flatMap(([region, d]) =>
    (['petrol', 'diesel'] as const).map(fuel => async (): Promise<FuelRow[]> => {
      try {
        const found = parseFuel(await (await get(fuelUrl(fuel, d.fuel))).text(), fuel, region, d.fuelCity);
        if (!found.length) throw new Error('no prices on the page');
        return found;
      } catch (e) {
        errors.push(`fuel ${fuel} ${region}: ${errorText(e)}`);
        return [];
      }
    }));
  const rows = (await pool(jobs)).flat();
  if (rows.length) {
    const fetched_at = new Date().toISOString();
    const { error } = await db.from('fuel_prices').upsert(rows.map(r => ({ ...r, fetched_at })));
    if (error) errors.push(`fuel_prices: ${error.message}`);
  }
  return { rows: rows.length, errors };
}

// Gold and silver for Kerala; with `all`, also the LPG cylinder per district
// (Pathanamthitta, which has no page, uses Kottayam's) and the farm prices.
async function refreshRates(all: boolean) {
  const errors: string[] = [];
  const page = (name: string, url: string, parse: (text: string) => RateRow[], init?: RequestInit) =>
    async (): Promise<RateRow[]> => {
      try {
        const res = await get(url, init);
        const found = parse(init?.method === 'POST' ? await res.json() : await res.text());
        if (!found.length) throw new Error('no prices on the page');
        return found;
      } catch (e) {
        errors.push(`${name}: ${errorText(e)}`);
        return [];
      }
    };
  const jobs = [page('gold', GOLD, parseGold), page('silver', SILVER, parseSilver)];
  if (all) {
    jobs.push(
      page('rubber', RUBBER, parseRubber),
      page('spices', SPICES, parseSpices),
      page('farm', AGMARKNET, parseFarmAgmarknet as (t: any) => RateRow[], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://agmarknet.gov.in' },
        body: JSON.stringify(farmBody(isoDay(Date.now()))),
      }),
      ...Object.entries(DISTRICTS).map(([region, d]) => page(`lpg ${region}`, lpgUrl(d.fuel), html => parseLpg(html, region))),
    );
  }
  const rows = (await pool(jobs)).flat();
  if (rows.length) {
    const fetched_at = new Date().toISOString();
    const { error } = await db.from('rates').upsert(rows.map(r => ({ source: 'goodreturns', ...r, fetched_at })));
    if (error) errors.push(`rates: ${error.message}`);
  }
  return { rows: rows.length, errors };
}

Deno.serve(async req => {
  if (!SECRET || req.headers.get('x-refresh-secret') !== SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  const { tier = 'all' } = await req.json().catch(() => ({}));
  const all = tier !== 'fast';
  const none = { rows: 0, errors: [] as string[] };
  const [markets, fuel, rates] = await Promise.all([
    all ? refreshMarkets() : none, all ? refreshFuel() : none, refreshRates(all),
  ]);
  const ok = markets.rows > 0 || fuel.rows > 0 || rates.rows > 0;
  if (ok) await db.rpc('mark_checked');
  return Response.json({ tier, markets, fuel, rates }, { status: ok ? 200 : 502 });
});
