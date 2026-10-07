// Live market prices, fetched twice a day on the server, turned into a fair
// range for items people haven't reported enough yet. Pure functions, like stats.js.
import { DAY, fairPrice, median, startOfDay } from './stats.js';

// How one day's price becomes a fair band, by source:
//   vfpck: VFPCK's published retail price at Ernakulam. Shops vary a little
//     either way, so the band is 10% below to 15% above it.
//   agmarknet: a mandi price. At Ernakulam these sit close to retail for
//     vegetables (VFPCK's retail prices were 0.7–1.4× them in Oct 2026), so a
//     modest shop margin is added and the result is called an estimate.
// Phase 3 learns these from real reports.
export const BANDS = {
  vfpck: { low: 0.9, typical: 1, high: 1.15 },
  agmarknet: { low: 1.1, typical: 1.25, high: 1.45 },
};
const band = p => BANDS[p.source] ?? BANDS.agmarknet;
export const FRESH_DAYS = 7; // market prices older than this aren't used
const CARRY_DAYS = 3; // markets skip days; a price carries over this long

// Rows from market_daily → Map(itemId → [{ day, region, source, price, wholesale }]),
// oldest first: your district's prices when it has a recent one, else Kerala's.
export function marketByItem(rows, region, now = Date.now()) {
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.itemId}|${r.region === region ? 'here' : 'kerala'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const m = new Map();
  for (const where of ['kerala', 'here']) {
    for (const [k, list] of groups) {
      const [itemId, w] = k.split('|');
      if (w !== where) continue;
      list.sort((a, b) => a.day - b.day);
      // Kerala's prices first; your district's replace them when it has a recent one.
      if (where === 'kerala' || latestWholesale(list, now) || !m.has(itemId)) m.set(itemId, list);
    }
  }
  return m;
}

export function latestWholesale(series, now = Date.now()) {
  const last = series?.findLast(p => p.day <= now);
  return last && last.day >= startOfDay(now) - FRESH_DAYS * DAY ? last : null;
}

// Items with a recent market price.
export function liveItems(market, now = Date.now()) {
  return new Set([...market].filter(([, s]) => latestWholesale(s, now)).map(([id]) => id));
}

export function estimateFair(series, now = Date.now()) {
  const w = latestWholesale(series, now);
  if (!w) return null;
  const b = band(w);
  return {
    low: w.price * b.low,
    typical: w.price * b.typical,
    high: w.price * b.high,
    n: 0,
    removed: 0,
    scope: 'estimate',
    days: FRESH_DAYS,
    source: w.source,
    region: w.region,
    price: w.price,
    wholesale: w.source === 'agmarknet' ? w.price : w.wholesale ?? null,
    day: w.day,
    market: w.scope,
    reports: [],
  };
}

// The fair range to show for an item: real reports when there are enough from
// the last week, else the market price, else whatever reports there are
// (which may be sample data, flagged with `sample`).
export function itemFair(reps, series, { itemId, areaId, now = Date.now() }) {
  const fair = fairPrice(reps, { itemId, areaId, now });
  if (!(fair && fair.days === 7)) {
    const est = estimateFair(series, now);
    if (est) return { ...est, reports: fair?.reports ?? [] };
  }
  return fair && { ...fair, sample: fair.reports.some(r => r.demo) };
}

// Only the days from the same source as the newest one: VFPCK and Agmarknet
// sit at different levels, so mixing them would look like price moves.
const sameSource = (series = []) => {
  const src = series.at(-1)?.source;
  return series.filter(p => p.source === src);
};

// Typical shop price per day for the last `days` days, oldest first, in the
// same shape as dailySeries().
export function estimateSeries(series = [], { now = Date.now(), days = 30 } = {}) {
  const today = startOfDay(now);
  const byDay = new Map(sameSource(series.filter(p => p.day <= now)).map(p => [p.day, p.price * band(p).typical]));
  const out = [];
  let carry = null;
  let age = 0;
  for (let d = days - 1 + CARRY_DAYS; d >= 0; d--) {
    const day = today - d * DAY;
    if (byDay.has(day)) { carry = byDay.get(day); age = 0; } else if (carry != null && ++age > CARRY_DAYS) carry = null;
    if (d < days) out.push({ day, value: carry, n: 0 });
  }
  return out;
}

// Latest three reported days vs the week before them. Market data arrives a day
// or two late, so this counts back from the newest day, not from today.
export function marketChange(series = [], now = Date.now()) {
  const known = sameSource(series.filter(p => p.day <= now));
  if (!known.length) return null;
  const last = known.at(-1).day;
  const shop = p => p.price * band(p).typical; // comparable across sources
  const recent = known.filter(p => p.day > last - 3 * DAY).map(shop);
  const base = known.filter(p => p.day <= last - 3 * DAY && p.day > last - 10 * DAY).map(shop);
  if (recent.length < 2 || base.length < 3) return null;
  return median(recent) / median(base) - 1;
}

// Every district's prices for each item, from market_latest (newest price per
// item, district and source): `retail` is VFPCK's shop price, `mandi` the
// Agmarknet wholesale price. Only retail prices are compared between
// districts. Mandi prices can't stand in for them: some districts' mandis are
// farm-gate markets (Wayanad's ran about half the Kerala middle on every
// vegetable in Oct 2026) and others sit near retail, so a district's mandi
// level says little about its shops.
// Returns Map(itemId → Map(region → { retail, mandi })).
export function districtPrices(latest, areas) {
  const districts = new Set(areas.map(a => a.id));
  const out = new Map();
  for (const r of latest) {
    if (!districts.has(r.region)) continue;
    if (!out.has(r.itemId)) out.set(r.itemId, new Map());
    const cell = out.get(r.itemId).get(r.region) ?? { retail: null, mandi: null };
    cell[r.source === 'vfpck' ? 'retail' : 'mandi'] = r.price;
    out.get(r.itemId).set(r.region, cell);
  }
  return out;
}

// One item in all 14 districts: shop prices cheapest first, then districts with
// only a mandi price, then those with neither.
export function itemAcross(latest, itemId, areas) {
  const cells = districtPrices(latest, areas).get(itemId) ?? new Map();
  const rank = r => (r.value != null ? r.value : r.mandi != null ? 1e9 + r.mandi : Infinity);
  return areas
    .map(a => ({ id: a.id, name: a.name, value: cells.get(a.id)?.retail ?? null, mandi: cells.get(a.id)?.mandi ?? null }))
    .sort((x, y) => rank(x) - rank(y));
}

// How much pricier or cheaper each district's shops are than Kerala's middle,
// across the items it has a shop price for: the geometric mean of (district ÷
// median of all districts). Districts without shop prices aren't ranked.
export function districtIndex(latest, itemIds, areas, minItems = 3) {
  const names = new Map(areas.map(a => [a.id, a.name]));
  const logs = new Map();
  for (const [itemId, cells] of districtPrices(latest, areas)) {
    if (!itemIds.has(itemId)) continue;
    const retail = [...cells].filter(([, c]) => c.retail != null);
    if (retail.length < 5) continue;
    const mid = median(retail.map(([, c]) => c.retail));
    for (const [region, c] of retail) logs.set(region, [...(logs.get(region) ?? []), Math.log(c.retail / mid)]);
  }
  return [...logs].filter(([, l]) => l.length >= minItems)
    .map(([id, l]) => ({ id, name: names.get(id), items: l.length, value: Math.exp(l.reduce((s, v) => s + v, 0) / l.length) - 1 }))
    .sort((a, b) => a.value - b.value);
}

// How one district compares with Kerala, or with another district: +0.06 is 6% pricier.
export function versus(index, a, b = null) {
  const ia = index.find(r => r.id === a);
  if (!ia) return null;
  if (!b) return ia.value;
  const ib = index.find(r => r.id === b);
  return ib ? (1 + ia.value) / (1 + ib.value) - 1 : null;
}

// A dated price list (fuel, gold, LPG…) → the newest price and the change from
// the last different price.
export function fuelNow(list = []) {
  if (!list.length) return null;
  const last = list.at(-1);
  const before = list.findLast(p => p.price !== last.price);
  return { price: last.price, day: last.day, change: before ? last.price - before.price : 0, since: before?.day ?? null };
}
