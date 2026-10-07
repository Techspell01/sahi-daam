import { DAY, outlierMask, quantile } from './stats.js';

// Kerala auto-rickshaw meter rate (2022 revision). Rates change by government
// notification, so keep them here in one place and check before relying on them.
export const AUTO_RATE = {
  min: 30, // minimum charge…
  minKm: 1.5, // …covers this many km
  perKm: 15, // then this much per km
  night: 0.5, // 50% extra at night
  nightFrom: 22,
  nightTo: 5,
  source: 'Kerala auto rate (2022 revision): ₹30 for the first 1.5 km, then ₹15 per km, 50% extra from 10 pm to 5 am.',
};

const R = 6371;
const rad = d => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Straight-line distance times a detour factor: roads are rarely straight.
// Good enough to estimate a fare; a routing API (OSRM) replaces it later.
export function roadKm(a, b) {
  return Math.max(0.5, Math.round(haversineKm(a, b) * 1.35 * 10) / 10);
}

export function meterFare(km, night = false, rate = AUTO_RATE) {
  const day = km <= rate.minKm ? rate.min : rate.min + (km - rate.minKm) * rate.perKm;
  return Math.round(day * (night ? 1 + rate.night : 1));
}

export function isNight(date = new Date(), rate = AUTO_RATE) {
  const h = date.getHours();
  return h >= rate.nightFrom || h < rate.nightTo;
}

// What people actually pay, as a multiple of the meter fare. Using the ratio lets
// every trip in the city inform every other trip, whatever its length.
export function autoFair(autos, { km, night = false, now = Date.now(), days = 30 }) {
  const pool = autos.filter(a => a.at <= now && a.at >= now - days * DAY);
  const meter = meterFare(km, night);
  if (pool.length < 5) return { meter, low: meter, typical: meter, high: meter, n: 0, removed: 0, ratios: [] };
  const ratios = pool.map(a => a.fare / meterFare(a.km, a.night));
  const mask = outlierMask(ratios);
  const kept = ratios.filter((_, i) => !mask[i]).sort((a, b) => a - b);
  return {
    meter,
    low: Math.max(meter, meter * quantile(kept, 0.25)),
    typical: meter * quantile(kept, 0.5),
    high: meter * quantile(kept, 0.75),
    n: kept.length,
    removed: pool.length - kept.length,
    sample: pool.some(a => a.demo),
    ratios: ratios.map((r, i) => ({ ratio: r, outlier: mask[i] })),
  };
}
