import { DAY, outlierMask, quantile } from './stats.js';

// Kerala auto-rickshaw meter rate (2022 revision). Rates change by government
// notification, so keep them here in one place and check before relying on them.
export const AUTO_RATE = {
  min: 30, // minimum charge…
  minKm: 1.5, // …covers this many km
  stepKm: 0.1, // then the meter goes up every 100 m…
  perStep: 1.5, // …by ₹1.50 (₹15 a km)
  night: 0.5, // 10 pm to 5 am: 50% extra on top of the meter fare
  nightFrom: 22,
  nightTo: 5,
  source: 'Kerala meter rate (2022 revision): ₹30 minimum for the first 1.5 km, then ₹1.50 for every 100 m (₹15 a km). From 10 pm to 5 am, 50% extra on top of the meter fare.',
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

// The meter: the minimum, then ₹1.50 for each full 100 m after the first 1.5 km
// (it only goes up once that 100 m is done). Not rounded: it can end in 50 paise.
export function meterFare(km, night = false, rate = AUTO_RATE) {
  const day = rate.min + meterSteps(km, rate) * rate.perStep;
  return Math.round(day * (night ? 1 + rate.night : 1) * 100) / 100;
}

// Full 100 m steps past the minimum distance. Works in whole metres so that
// 4.2 − 1.5 doesn't come out as 2.6999… km.
export function meterSteps(km, rate = AUTO_RATE) {
  const extra = Math.round((km - rate.minKm) * 1000);
  return extra > 0 ? Math.floor(extra / Math.round(rate.stepKm * 1000)) : 0;
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
