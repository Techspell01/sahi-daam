// Screen-level summaries built from the engine in stats.js.
import { AREAS, BASKET, ITEMS } from './catalog.js';
import { estimateSeries, itemFair, marketChange } from './market.js';
import { change, clean, dailySeries, DAY, median, outlierMask } from './stats.js';

const groups = new WeakMap();

// Reports grouped by item, computed once per reports array.
export function byItem(reports) {
  let m = groups.get(reports);
  if (!m) {
    m = new Map(ITEMS.map(i => [i.id, []]));
    for (const r of reports) m.get(r.itemId)?.push(r);
    groups.set(reports, m);
  }
  return m;
}

// The fair range, weekly change and 14-day sparkline for one item. When the
// range is a mandi estimate, the change and sparkline come from mandi prices too.
export function itemSummary(reports, item, areaId, now = Date.now(), market = new Map()) {
  const reps = byItem(reports).get(item.id);
  const series = market.get(item.id);
  const fair = itemFair(reps, series, { itemId: item.id, areaId, now });
  const live = fair?.scope === 'estimate';
  return {
    item,
    fair,
    change: live ? marketChange(series, now) : change(reps, { now }),
    spark: (live ? estimateSeries(series, { now, days: 14 }) : dailySeries(reps, { now, days: 14 })).map(p => p.value),
  };
}

// Daily typical price for the trend chart: mandi estimate or report medians,
// matching what itemSummary used for the fair range.
export function itemSeries(reports, item, fair, now = Date.now(), market = new Map(), days = 30) {
  return fair?.scope === 'estimate'
    ? estimateSeries(market.get(item.id), { now, days })
    : dailySeries(byItem(reports).get(item.id), { now, days });
}

// Median price per area over the last two weeks, cheapest first.
export function areaMedians(reps, now = Date.now(), days = 14) {
  return AREAS.map(a => {
    const vals = clean(reps.filter(r => r.areaId === a.id && r.at > now - days * DAY && r.at <= now).map(r => r.price));
    return vals.length >= 3 ? { id: a.id, name: a.name, value: median(vals), n: vals.length } : null;
  }).filter(Boolean).sort((a, b) => a.value - b.value);
}

// Cost of the weekly kitchen basket, day by day. Items with a live mandi price
// use its estimate; the rest use report medians.
export function basketSeries(reports, now = Date.now(), days = 30, market = new Map()) {
  const m = byItem(reports);
  const parts = BASKET.map(([id, qty]) => [qty, market.get(id)?.length
    ? estimateSeries(market.get(id), { now, days })
    : dailySeries(m.get(id), { now, days, window: 5 })]);
  return parts[0][1].map((p, d) => {
    let sum = 0;
    for (const [qty, s] of parts) {
      if (s[d].value == null) return { day: p.day, value: null };
      sum += qty * s[d].value;
    }
    return { day: p.day, value: sum };
  });
}

// How much pricier or cheaper each area is than the city, across one category.
// Geometric mean of (area median / city median) per item, so no single item dominates.
export function areaIndex(reports, now = Date.now(), cat = 'veg', days = 7) {
  const m = byItem(reports);
  const items = ITEMS.filter(i => i.cat === cat);
  return AREAS.map(a => {
    const logs = [];
    for (const it of items) {
      const reps = m.get(it.id).filter(r => r.at > now - days * DAY && r.at <= now);
      const city = clean(reps.map(r => r.price));
      const local = clean(reps.filter(r => r.areaId === a.id).map(r => r.price));
      if (local.length >= 3 && city.length >= 6) logs.push(Math.log(median(local) / median(city)));
    }
    if (logs.length < 3) return null;
    return { id: a.id, name: a.name, value: Math.exp(logs.reduce((s, v) => s + v, 0) / logs.length) - 1, items: logs.length };
  }).filter(Boolean).sort((x, y) => x.value - y.value);
}

// How much data the last week has and how much of it the outlier filter set aside.
export function dataHealth(reports, now = Date.now(), days = 7) {
  const recent = reports.filter(r => r.at > now - days * DAY && r.at <= now);
  let flagged = 0;
  const cells = new Map();
  for (const r of recent) {
    const k = `${r.itemId}|${r.areaId}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(r.price);
  }
  for (const vals of cells.values()) flagged += outlierMask(vals).filter(Boolean).length;
  return { total: recent.length, flagged, items: new Set(recent.map(r => r.itemId)).size };
}

export function movers(reports, now = Date.now(), market = new Map()) {
  return ITEMS.filter(item => item.cat !== 'service')
    .map(item => itemSummary(reports, item, null, now, market))
    .filter(x => x.change != null);
}
