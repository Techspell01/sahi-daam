// Talking to Supabase: an anonymous account per phone, everyone's prices, and
// your own. Only store.js uses this. Without VITE_SUPABASE_URL and
// VITE_SUPABASE_PUBLISHABLE_KEY the app runs as in phase 1: demo prices plus
// reports kept on this phone.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const enabled = !!(url && key);

// The client library is loaded on first use, so it doesn't hold up the first screen.
let client;
const db = () => (client ??= import('@supabase/supabase-js').then(({ createClient }) =>
  createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })));

const TABLE = { reports: 'reports', autos: 'auto_trips' };
const PAGE = 1000; // PostgREST returns at most 1000 rows per request

const iso = t => new Date(t).toISOString();
const isoDay = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// '2026-10-04' → local midnight, the same day key stats.js uses.
const localDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

// Server rows to the shapes the engine and screens use, and back.
const seen = v => (v ? { seen: Date.parse(v) } : {});
export const fromShared = r => ({
  id: r.id, itemId: r.item_id, areaId: r.area_id, price: +r.price, shop: r.shop, at: Date.parse(r.paid_at), ...seen(r.visible_at),
});
export const fromSharedTrip = t => ({
  id: t.id, kind: 'auto', from: t.from_place, to: t.to_place, km: +t.km, fare: +t.fare, night: t.night, at: Date.parse(t.paid_at),
  ...seen(t.visible_at),
});
const fromMine = r => ({ ...fromShared(r), paid: +r.paid, qty: r.qty_label, mine: true, sync: 'ok' });
const fromMineTrip = t => ({ ...fromSharedTrip(t), mine: true, sync: 'ok' });
export const fromMarket = r => ({
  itemId: r.item_id, region: r.region, day: localDay(r.day), source: r.source, price: +r.price,
  wholesale: r.wholesale == null ? null : +r.wholesale,
});
export const fromFuel = r => ({ fuel: r.fuel, region: r.region, city: r.city, day: localDay(r.day), price: +r.price });
export const fromRate = r => ({ kind: r.kind, region: r.region, day: localDay(r.day), price: +r.price });

export const toRow = {
  reports: r => ({
    id: r.id, item_id: r.itemId, area_id: r.areaId, price: r.price, paid: r.paid, qty_label: r.qty, shop: r.shop, paid_at: iso(r.at),
  }),
  autos: t => ({
    id: t.id, from_place: t.from ?? null, to_place: t.to ?? null, km: t.km, fare: t.fare, night: !!t.night, paid_at: iso(t.at),
  }),
};

// The server turned it down (a check, the daily limit, an unknown item) and will
// again however often it's sent. Anything else, like being offline, is worth retrying.
export const isRejection = e => typeof e?.code === 'string' && /^(P0001|22|23|42)/.test(e.code);

// crypto.randomUUID only exists on https and localhost; `npm run dev:phone` is plain http.
export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function session() {
  const { data } = await (await db()).auth.getSession();
  return data.session;
}

// No account is made until you first add a price.
async function ensureSession() {
  if (await session()) return;
  const { error } = await (await db()).auth.signInAnonymously();
  if (error) throw error;
}

// The account behind this session no longer exists: start a new one next time.
async function forgetDeletedAccount(error) {
  if (error.code === '23503' && /user_id/.test(error.details ?? error.message)) {
    await (await db()).auth.signOut({ scope: 'local' });
  }
  return error;
}

// Send one of your rows. Safe to repeat: the id is fixed, so a second send is a no-op.
export async function send(kind, row) {
  await ensureSession();
  const { error } = await (await db()).from(TABLE[kind]).insert(toRow[kind](row));
  if (error && error.code !== '23505') throw await forgetDeletedAccount(error);
}

export async function remove(kind, id) {
  if (!(await session())) return; // never signed in, so nothing of yours is on the server
  const { error } = await (await db()).from(TABLE[kind]).delete().eq('id', id);
  if (error) throw error;
}

// Everyone's prices come a page at a time, each page continuing from the last
// row of the one before (see the delta_sync migration).
async function keyset(supabase, fn, args) {
  const rows = [];
  for (let last = null; ;) {
    const page = last ? { page_at: last.paid_at, page_id: last.id } : {};
    const { data, error } = await supabase.rpc(fn, { ...args, ...page }).order('paid_at').order('id');
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
    last = data.at(-1);
  }
}

async function all(query) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

// Everyone else's prices paid since `since`; with `after`, only the ones that
// became visible since then (see the delta_sync migration). Works before you
// have an account too.
export async function fetchShared(since, after = null) {
  const supabase = await db();
  const args = { since: iso(since), ...(after ? { after: iso(after) } : {}) };
  const [reports, autos] = await Promise.all([
    keyset(supabase, 'shared_reports', args),
    keyset(supabase, 'shared_trips', args),
  ]);
  return { reports: reports.map(fromShared), autos: autos.map(fromSharedTrip) };
}

// Live prices for one district since `since`: its market prices (with the
// Kerala-wide ones as a fallback), every district's latest market price (for
// "across Kerala"), its fuel and LPG, and Kerala's gold and silver. All small.
export async function fetchLive(since, region) {
  const supabase = await db();
  const day = isoDay(since);
  const [market, latest, fuel, rates, lpg] = await Promise.all([
    all(() => supabase.from('market_daily').select('item_id, region, day, source, price, wholesale')
      .in('region', [region, 'kerala']).gte('day', day).order('item_id').order('region').order('day')),
    all(() => supabase.from('market_latest').select('item_id, region, day, source, price').order('item_id').order('region')),
    all(() => supabase.from('fuel_prices').select('fuel, region, city, day, price').eq('region', region).gte('day', day).order('fuel').order('day')),
    all(() => supabase.from('rates').select('kind, region, day, price').eq('region', 'kerala').gte('day', day).order('kind').order('day')),
    all(() => supabase.from('rates').select('kind, region, day, price').eq('kind', 'lpg').eq('region', region).order('day')),
  ]);
  return {
    region,
    market: market.map(fromMarket),
    latest: latest.map(fromMarket),
    fuel: fuel.map(fromFuel),
    rates: [...rates, ...lpg].map(fromRate),
  };
}

// Everything you have sent, or null if this phone has no account yet.
export async function fetchMine() {
  if (!(await session())) return null;
  const supabase = await db();
  const [reports, autos] = await Promise.all([
    all(() => supabase.from('reports').select('id, item_id, area_id, price, paid, qty_label, shop, paid_at').order('paid_at').order('id')),
    all(() => supabase.from('auto_trips').select('id, from_place, to_place, km, fare, night, paid_at').order('paid_at').order('id')),
  ]);
  return { reports: reports.map(fromMine), autos: autos.map(fromMineTrip) };
}

// Deletes the anonymous account and every price it sent.
export async function deleteAccount() {
  if (!(await session())) return;
  const supabase = await db();
  const { error } = await supabase.rpc('delete_my_data');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}
