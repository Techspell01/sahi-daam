import { describe, expect, it } from 'vitest';
import { searchItems } from './catalog.js';
import { makeDemo } from './demo.js';
import { autoFair, meterFare, meterSteps, roadKm } from './fare.js';
import { change, DAY, dailySeries, fairPrice, niceRound, outlierMask, quantile, verdict } from './stats.js';

const NOW = new Date('2026-10-06T18:00:00+05:30').getTime();
const rep = (price, extra = {}) => ({ itemId: 'tomato', areaId: 'kakkanad', price, at: NOW - DAY, ...extra });

describe('quantile and outliers', () => {
  it('interpolates quantiles', () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(quantile([10, 20, 30, 40], 0.25)).toBe(17.5);
  });

  it('flags a tourist price and a typo, keeps normal prices', () => {
    const mask = outlierMask([40, 42, 38, 41, 44, 39, 95, 12]);
    expect(mask).toEqual([false, false, false, false, false, false, true, true]);
  });

  it('handles identical prices (MAD = 0)', () => {
    expect(outlierMask([12, 12, 12, 12, 30])).toEqual([false, false, false, false, true]);
  });
});

describe('fairPrice', () => {
  it('uses the area when it has enough reports, ignoring outliers', () => {
    const reports = [38, 40, 41, 42, 43, 45, 120].map(p => rep(p));
    const fair = fairPrice(reports, { itemId: 'tomato', areaId: 'kakkanad', now: NOW });
    expect(fair.scope).toBe('area');
    expect(fair.removed).toBe(1);
    expect(fair.typical).toBe(41.5);
  });

  it('widens to the city, then to 30 days', () => {
    const city = [40, 41, 42, 43, 44, 45].map(p => rep(p, { areaId: 'aluva' }));
    expect(fairPrice(city, { itemId: 'tomato', areaId: 'kakkanad', now: NOW }).scope).toBe('city');
    const old = city.map(r => ({ ...r, at: NOW - 20 * DAY }));
    expect(fairPrice(old, { itemId: 'tomato', areaId: 'kakkanad', now: NOW }).days).toBe(30);
  });

  it('returns null when there is almost nothing to go on', () => {
    expect(fairPrice([rep(40)], { itemId: 'tomato', areaId: 'kakkanad', now: NOW })).toBeNull();
  });
});

describe('verdict', () => {
  const fair = { low: 38, typical: 42, high: 46 };
  it.each([[30, 'good'], [42, 'fair'], [50, 'high'], [70, 'over']])('₹%i is %s', (quote, level) => {
    expect(verdict(quote, fair).level).toBe(level);
  });
  it('flags suspiciously cheap prices', () => {
    expect(verdict(20, fair).suspicious).toBe(true);
  });
  it('rounds offers the way people say them', () => {
    expect(niceRound(41.6)).toBe(42);
    expect(niceRound(187)).toBe(185);
    expect(niceRound(523)).toBe(520);
  });
});

describe('auto fares', () => {
  it('follows the Kerala meter rate', () => {
    expect(meterFare(1)).toBe(30);
    expect(meterFare(1.5)).toBe(30);
    expect(meterFare(5.5)).toBe(90);
    expect(meterFare(5.5, true)).toBe(135);
  });

  it('goes up ₹1.50 for each full 100 m after 1.5 km', () => {
    expect(meterFare(1.55)).toBe(30); // the next 100 m isn't done yet
    expect(meterFare(1.6)).toBe(31.5);
    expect(meterFare(1.7)).toBe(33); // 0.2 / 0.1 is 1.999… in floating point
    expect(meterFare(4.2)).toBe(70.5);
    expect(meterFare(4.29)).toBe(70.5);
    expect(meterSteps(4.2)).toBe(27);
    expect(meterFare(1.6, true)).toBe(47.25); // 50% on top of the meter
    expect(meterFare(10, true)).toBe(236.25);
  });

  it('estimates road distance from coordinates', () => {
    const km = roadKm({ lat: 10.0159, lng: 76.3419 }, { lat: 9.9675, lng: 76.3216 });
    expect(km).toBeGreaterThan(6);
    expect(km).toBeLessThan(9);
  });

  it('turns trips into a people-pay range for any distance', () => {
    const autos = [1.1, 1.15, 1.2, 1.1, 1.12, 2.5].map((r, i) =>
      ({ km: 4, night: false, fare: meterFare(4) * r, at: NOW - i * DAY }));
    const fair = autoFair(autos, { km: 8, now: NOW });
    expect(fair.meter).toBe(meterFare(8));
    expect(fair.removed).toBe(1);
    expect(fair.typical / fair.meter).toBeCloseTo(1.12, 2);
  });
});

describe('demo data', () => {
  const demo = makeDemo({ now: NOW });

  it('is deterministic and never in the future', () => {
    expect(makeDemo({ now: NOW }).reports.length).toBe(demo.reports.length);
    expect(demo.reports.every(r => r.at <= NOW)).toBe(true);
    expect(demo.autos.every(r => r.at <= NOW)).toBe(true);
  });

  it('gives every item a fair price in every area', () => {
    for (const itemId of ['tomato', 'mathi', 'haircut', 'tea']) {
      const fair = fairPrice(demo.reports, { itemId, areaId: 'kakkanad', now: NOW });
      expect(fair).not.toBeNull();
      expect(fair.low).toBeLessThanOrEqual(fair.typical);
      expect(fair.typical).toBeLessThanOrEqual(fair.high);
    }
  });

  it('shows tomatoes rising this week', () => {
    const tomatoes = demo.reports.filter(r => r.itemId === 'tomato');
    expect(change(tomatoes, { now: NOW })).toBeGreaterThan(0);
    const series = dailySeries(tomatoes, { now: NOW });
    expect(series).toHaveLength(30);
    expect(series.at(-1).value).toBeGreaterThan(series[0].value);
  });
});

describe('search', () => {
  it('finds items by Malayalam transliteration, script and English', () => {
    expect(searchItems('thakkali')[0].id).toBe('tomato');
    expect(searchItems('മത്തി')[0].id).toBe('mathi');
    expect(searchItems('fish').map(i => i.id)).toEqual(expect.arrayContaining(['mathi', 'ayala']));
    expect(searchItems('  ')).toEqual([]);
  });
});
