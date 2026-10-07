// Demo data: 30 days of believable price reports so the app is useful before
// anyone has reported anything. Clearly marked `demo: true` everywhere and in
// the UI. Real reports replace it item by item (withDemo below), and government
// mandi prices fill the gaps in phase 3.
import { AREAS, ITEMS, PLACES } from './catalog.js';
import { meterFare, roadKm } from './fare.js';
import { gaussian, mulberry32, pickWeighted, poisson } from './random.js';
import { DAY, startOfDay } from './stats.js';

const SHOP_FACTOR = { street: 0.96, shop: 1, super: 1.08, online: 1.05 };
const SHOP_MIX = {
  goods: [['street', 45], ['shop', 35], ['super', 15], ['online', 5]],
  service: [['shop', 1]],
  tea: [['street', 1], ['shop', 1]],
};

const roundPrice = p => (p < 200 ? Math.round(p) : Math.round(p / 5) * 5);

export function makeDemo({ now = Date.now(), days = 30, seed = 20261006 } = {}) {
  const rnd = mulberry32(seed);
  const today = startOfDay(now);
  const reports = [];
  const autos = [];

  // A time on day `d` days ago, during shop hours, never in the future.
  const timeOn = (d, fromH = 7, toH = 21) => {
    const start = today - d * DAY;
    const t = start + (fromH + rnd() * (toH - fromH)) * 3600e3;
    return d === 0 ? Math.min(t, now - 60e3 * (5 + rnd() * 90)) : t;
  };

  for (const it of ITEMS) {
    // City-wide price path: a trend plus a mean-reverting wobble.
    const path = [];
    let wobble = 0;
    for (let d = days - 1; d >= 0; d--) {
      const t = (days - 1 - d) / (days - 1);
      wobble = 0.85 * wobble + it.vol * gaussian(rnd);
      path[d] = (1 + it.trend * (Math.pow(t, 1.6) - 0.5)) * Math.exp(wobble);
    }
    const isService = it.cat === 'service';
    const mix = it.id === 'tea' ? SHOP_MIX.tea : isService ? SHOP_MIX.service : SHOP_MIX.goods;

    for (const area of AREAS) {
      const areaF = isService ? area.factor ** 2 : area.factor;
      for (let d = days - 1; d >= 0; d--) {
        const count = poisson(rnd, it.pop * (d === 0 ? 0.7 : 1.5));
        for (let k = 0; k < count; k++) {
          const shop = pickWeighted(rnd, mix);
          let price = it.base * path[d] * areaF * SHOP_FACTOR[shop] * Math.exp(gaussian(rnd) * (isService ? 0.05 : 0.07));
          const u = rnd();
          if (u < 0.035) price *= 1.5 + rnd() * 0.8; // tourist / newcomer overcharge
          else if (u < 0.045) price *= 0.45 + rnd() * 0.15; // typo or short weight
          reports.push({
            id: `d${reports.length}`, itemId: it.id, areaId: area.id, price: roundPrice(price),
            shop, at: timeOn(d), demo: true,
          });
        }
      }
    }
  }

  for (let d = days - 1; d >= 0; d--) {
    const count = poisson(rnd, d === 0 ? 6 : 14);
    for (let k = 0; k < count; k++) {
      let from, to, km;
      do {
        from = PLACES[Math.floor(rnd() * PLACES.length)];
        to = PLACES[Math.floor(rnd() * PLACES.length)];
        km = roadKm(from, to);
      } while (from === to || km < 1.2 || km > 18);
      const night = rnd() < 0.15;
      let ratio = 1.12 * Math.exp(gaussian(rnd) * 0.07);
      if (rnd() < 0.08) ratio *= 1.35 + rnd() * 0.5;
      const at = night ? today - d * DAY + (rnd() < 0.5 ? 22.2 + rnd() * 1.7 : 0.2 + rnd() * 4.6) * 3600e3 : timeOn(d, 6, 21.5);
      if (at > now) continue;
      autos.push({
        id: `a${autos.length}`, kind: 'auto', from: from.id, to: to.id, km, night,
        fare: Math.round((meterFare(km, night) * ratio) / 5) * 5, at, demo: true,
      });
    }
  }

  return { reports, autos };
}

// Real prices take over from the demo ones item by item: an item loses its demo
// reports once it has a live mandi price (`live`, see market.js) or REAL_ENOUGH
// real reports in the last week. Auto fares switch over 30 days of real trips.
// What's left is sample data for items with no live source yet.
export const REAL_ENOUGH = 20;

export function withDemo(demo, real, now = Date.now(), live = new Set()) {
  const counts = new Map();
  for (const r of real.reports) {
    if (r.at > now - 7 * DAY && r.at <= now) counts.set(r.itemId, (counts.get(r.itemId) ?? 0) + 1);
  }
  const keep = r => !live.has(r.itemId) && (counts.get(r.itemId) ?? 0) < REAL_ENOUGH;
  const trips = real.autos.filter(a => a.at > now - 30 * DAY && a.at <= now).length;
  return {
    reports: [...demo.reports.filter(keep), ...real.reports],
    autos: [...(trips < REAL_ENOUGH ? demo.autos : []), ...real.autos],
  };
}
