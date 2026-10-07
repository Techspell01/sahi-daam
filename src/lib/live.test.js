import { describe, expect, it } from 'vitest';
import {
  DISTRICTS, FARM_KINDS, parseAgmarknet, parseDayTitle, parseFarmAgmarknet, parseFuel, parseGold, parseLpg, parseRubber,
  parseSilver, parseSpices, parseVfpck,
} from '../../supabase/functions/refresh-prices/sources.ts';
import { AREAS } from './catalog.js';
import { FARM } from './farm.js';
import { basketSeries } from './prices.js';
import { withDemo } from './demo.js';
import { nearestArea } from './geo.js';
import {
  BANDS, districtIndex, estimateFair, estimateSeries, fuelNow, itemAcross, itemFair, liveItems, marketByItem, marketChange, versus,
} from './market.js';
import { DAY, startOfDay } from './stats.js';
import { mergeShared } from './store.js';

const NOW = new Date('2026-10-07T18:00:00+05:30').getTime();
const TODAY = startOfDay(NOW);
const day = n => TODAY - n * DAY; // n days ago, local midnight
const rows = (itemId, prices, source = 'agmarknet', region = 'ernakulam') =>
  prices.map(([ago, price]) => ({ itemId, day: day(ago), source, region, price }));
const MANDI = BANDS.agmarknet;

describe('mandi estimates', () => {
  const market = marketByItem([...rows('tomato', [[5, 40], [4, 42], [3, 44]]), ...rows('onion', [[20, 50]])], 'ernakulam', NOW);

  it('marks up the latest mandi price into a fair band', () => {
    const est = estimateFair(market.get('tomato'), NOW);
    expect(est).toMatchObject({ scope: 'estimate', source: 'agmarknet', region: 'ernakulam', price: 44, day: day(3) });
    expect(est.low).toBeCloseTo(44 * MANDI.low);
    expect(est.typical).toBeCloseTo(44 * MANDI.typical);
    expect(est.high).toBeCloseTo(44 * MANDI.high);
  });

  it('centres the band on a VFPCK retail price', () => {
    const est = estimateFair([{ ...rows('tomato', [[1, 50]], 'vfpck')[0], wholesale: 45 }], NOW);
    expect(est).toMatchObject({ source: 'vfpck', typical: 50, wholesale: 45 });
    expect(est.low).toBeCloseTo(45);
    expect(est.high).toBeCloseTo(57.5);
  });

  it('ignores mandi prices older than a week', () => {
    expect(estimateFair(market.get('onion'), NOW)).toBeNull();
    expect([...liveItems(market, NOW)]).toEqual(['tomato']);
  });

  it('carries a price over missing days, but not for long', () => {
    const s = estimateSeries(rows('x', [[10, 40]]), { now: NOW, days: 12 });
    const at = n => s.find(p => p.day === day(n)).value;
    expect(at(10)).toBeCloseTo(40 * MANDI.typical);
    expect(at(7)).toBeCloseTo(40 * MANDI.typical); // 3 days later
    expect(at(6)).toBeNull();
  });

  it('never mixes sources in a trend', () => {
    const s = [...rows('x', [[3, 40], [2, 40]]), ...rows('x', [[1, 50]], 'vfpck')];
    const values = estimateSeries(s, { now: NOW, days: 5 }).map(p => p.value);
    expect(values).toEqual([null, null, null, 50, 50]); // the Agmarknet days are left out
  });

  it('measures the change from the newest mandi day, not today', () => {
    const s = rows('x', [[12, 40], [11, 40], [10, 40], [9, 40], [8, 40], [3, 50], [2, 50]]);
    expect(marketChange(s, NOW)).toBeCloseTo(0.25);
    expect(marketChange(rows('x', [[2, 50]]), NOW)).toBeNull();
  });
});

describe('which fair range to show', () => {
  const series = rows('tomato', [[2, 40]]);
  const rep = (price, extra = {}) => ({ id: `${price}${Math.random()}`, itemId: 'tomato', areaId: 'kakkanad', price, at: NOW - DAY, ...extra });

  it('prefers enough real reports from the last week', () => {
    const fair = itemFair([60, 61, 62, 63, 64, 65].map(p => rep(p)), series, { itemId: 'tomato', areaId: 'kakkanad', now: NOW });
    expect(fair.scope).toBe('area');
    expect(fair.sample).toBe(false);
  });

  it('uses the mandi estimate when reports are thin, keeping them as dots', () => {
    const fair = itemFair([rep(60), rep(61), rep(62)], series, { itemId: 'tomato', areaId: 'kakkanad', now: NOW });
    expect(fair.scope).toBe('estimate');
    expect(fair.reports).toHaveLength(3);
  });

  it('flags ranges built on sample data', () => {
    const fair = itemFair([60, 61, 62, 63, 64, 65].map(p => rep(p, { demo: true })), undefined, { itemId: 'tomato', areaId: 'kakkanad', now: NOW });
    expect(fair.sample).toBe(true);
  });

  it('drops demo reports for items with a live price', () => {
    const demo = { reports: [{ itemId: 'tomato', at: NOW - DAY, demo: true }, { itemId: 'mathi', at: NOW - DAY, demo: true }], autos: [] };
    const out = withDemo(demo, { reports: [], autos: [] }, NOW, new Set(['tomato']));
    expect(out.reports.map(r => r.itemId)).toEqual(['mathi']);
  });
});

describe('fuel', () => {
  it('gives today\'s price and the last change', () => {
    const list = [{ day: day(9), price: 108.6 }, { day: day(8), price: 113.53 }, { day: day(1), price: 113.53 }, { day: day(0), price: 113.5 }];
    expect(fuelNow(list)).toEqual({ price: 113.5, day: day(0), change: 113.5 - 113.53, since: day(1) });
    expect(fuelNow([])).toBeNull();
  });
});

describe('location', () => {
  it('finds your district, or none outside Kerala', () => {
    expect(nearestArea({ lat: 10.027, lng: 76.308 }).id).toBe('ernakulam'); // Lulu Mall, Kochi
    expect(nearestArea({ lat: 8.4875, lng: 76.9525 }).id).toBe('thiruvananthapuram'); // Thampanoor
    expect(nearestArea({ lat: 10.3, lng: 76.33 }).id).toBe('thrissur'); // Chalakudy
    expect(nearestArea({ lat: 11.8, lng: 76.0 }).id).toBe('wayanad'); // Mananthavady
    expect(nearestArea({ lat: 12.72, lng: 74.88 }).id).toBe('kasaragod'); // Manjeshwar
    expect(nearestArea({ lat: 11.0168, lng: 76.9558 })).toBeNull(); // Coimbatore
    expect(nearestArea({ lat: 12.97, lng: 77.59 })).toBeNull(); // Bengaluru
  });
});

describe('districts', () => {
  it('fetches prices for exactly the districts the app shows', () => {
    expect(Object.keys(DISTRICTS).sort()).toEqual(AREAS.map(a => a.id).sort());
  });

  it("uses your district's market price, else Kerala's", () => {
    const m = marketByItem([
      ...rows('tomato', [[2, 50]], 'vfpck', 'thrissur'),
      ...rows('tomato', [[2, 48]], 'vfpck', 'kerala'),
      ...rows('garlic', [[2, 200]], 'agmarknet', 'kerala'),
      ...rows('onion', [[30, 60]], 'vfpck', 'thrissur'), // too old
      ...rows('onion', [[1, 58]], 'vfpck', 'kerala'),
    ], 'thrissur', NOW);
    expect(m.get('tomato').at(-1)).toMatchObject({ region: 'thrissur', price: 50 });
    expect(m.get('garlic').at(-1)).toMatchObject({ region: 'kerala', price: 200 });
    expect(m.get('onion').at(-1)).toMatchObject({ region: 'kerala', price: 58 });
  });

  // Five districts with VFPCK retail prices, one with both sources, two with Agmarknet only.
  const v = (itemId, region, price) => ({ itemId, region, source: 'vfpck', price });
  const g = (itemId, region, price) => ({ itemId, region, source: 'agmarknet', price });
  const latest = [
    v('tomato', 'thrissur', 45), v('tomato', 'alappuzha', 56), v('tomato', 'ernakulam', 50), v('tomato', 'kottayam', 55), v('tomato', 'palakkad', 50),
    g('tomato', 'ernakulam', 40), g('tomato', 'wayanad', 20), g('tomato', 'kollam', 44), v('tomato', 'kerala', 48),
    v('onion', 'thrissur', 55), v('onion', 'alappuzha', 66), v('onion', 'ernakulam', 60), v('onion', 'kottayam', 62), v('onion', 'palakkad', 58),
    v('potato', 'thrissur', 34), v('potato', 'alappuzha', 40), v('potato', 'ernakulam', 38), v('potato', 'kottayam', 39), v('potato', 'palakkad', 36),
    g('garlic', 'ernakulam', 200), g('garlic', 'kozhikode', 180),
  ];

  it('lists all 14 districts: shop prices ranked, then mandi-only, then none', () => {
    const rows = itemAcross(latest, 'tomato', AREAS);
    expect(rows).toHaveLength(14);
    expect(rows.slice(0, 5).map(r => [r.id, r.value])).toEqual([
      ['thrissur', 45], ['ernakulam', 50], ['palakkad', 50], ['kottayam', 55], ['alappuzha', 56]]);
    expect(rows.find(r => r.id === 'ernakulam').mandi).toBe(40);
    // Mandi-only districts aren't given a comparable price.
    expect(rows.slice(5, 7)).toEqual([
      { id: 'wayanad', name: 'Wayanad', value: null, mandi: 20 },
      { id: 'kollam', name: 'Kollam', value: null, mandi: 44 }]);
    expect(rows.slice(7).every(r => r.value == null && r.mandi == null)).toBe(true);
  });

  it('ranks only districts with shop prices against the Kerala middle', () => {
    const index = districtIndex(latest, new Set(['tomato', 'onion', 'potato']), AREAS);
    expect(index.map(r => r.id)).not.toContain('wayanad');
    expect(index.map(r => r.id)).toHaveLength(5);
    expect(index.find(r => r.id === 'thrissur').value).toBeLessThan(0);
    expect(index.find(r => r.id === 'alappuzha').value).toBeGreaterThan(0);
  });

  it('says how one district compares with Kerala, or with another', () => {
    const index = [{ id: 'thrissur', value: -0.04 }, { id: 'ernakulam', value: 0.02 }];
    expect(versus(index, 'thrissur')).toBeCloseTo(-0.04);
    expect(versus(index, 'ernakulam', 'thrissur')).toBeCloseTo(1.02 / 0.96 - 1);
    expect(versus(index, 'wayanad')).toBeNull();
  });
});

describe('fetching only what is new', () => {
  it('merges by id and drops prices older than the window', () => {
    const old = [{ id: 'a', at: NOW - 50 * DAY }, { id: 'b', at: NOW - DAY, price: 1 }];
    const out = mergeShared(old, [{ id: 'b', at: NOW - DAY, price: 2 }, { id: 'c', at: NOW }], NOW - 40 * DAY);
    expect(out.map(r => [r.id, r.price])).toEqual([['b', 2], ['c', undefined]]);
  });
});

describe('source parsers', () => {
  const agmarknet = {
    status: 'success',
    data: {
      columns: [{ key: 'price_group', columns: [
        { key: 'as_on_price', title: '04 Oct, 2026' },
        { key: 'one_day_ago_price', title: '03 Oct, 2026' },
        { key: 'two_day_ago_price', title: '02 Oct, 2026' },
      ] }],
      records: [
        { cmdt_name: 'Tomato', as_on_price: '4400.00', one_day_ago_price: '4276.92', two_day_ago_price: '0.00' },
        { cmdt_name: 'Bhindi(Ladies Finger)', as_on_price: '5570.00', one_day_ago_price: '0', two_day_ago_price: '0' },
        { cmdt_name: 'Coconut', as_on_price: '3000.00', one_day_ago_price: '0', two_day_ago_price: '0' },
      ],
    },
  };

  it('reads Agmarknet rupees per quintal as rupees per kg, skipping blanks and unknowns', () => {
    expect(parseAgmarknet(agmarknet, 'ernakulam')).toEqual([
      { item_id: 'tomato', region: 'ernakulam', day: '2026-10-04', source: 'agmarknet', price: 44 },
      { item_id: 'tomato', region: 'ernakulam', day: '2026-10-03', source: 'agmarknet', price: 42.77 },
      { item_id: 'okra', region: 'ernakulam', day: '2026-10-04', source: 'agmarknet', price: 55.7 },
    ]);
    expect(parseDayTitle('04 Oct, 2026')).toBe('2026-10-04');
  });

  it('reads VFPCK retail prices, averaging Kerala and out-of-state and skipping zeros', () => {
    const cell = v => `<td>${v}</td>`;
    const row = (...v) => `<tr>${v.map(cell).join('')}</tr>`;
    const html = `<h2>DAILY MARKET PRICE AT ERNAKULAM</h2><p>Date: October 6, 2026</p><table>
      ${row('Vegetable/Fruit', 'WP* (Rs.)', 'RP* (Rs.)', 'WP* (Rs.)', 'RP* (Rs.)')}
      ${row('Banana Nendran', 68, 75, 62, 68)}
      ${row('Brinjal Green Long', 0, 0, 42, 47)}
      ${row('Brinjal Purple Round', 0, 0, 36, 42)}
      ${row('Tomato', 0, 0, 45, 50)}
      ${row('Tapioca', 30, 34, 0, 0)}
      ${row('Garlic', 0, 0, 0, 0)}
    </table>`;
    const out = Object.fromEntries(parseVfpck(html, 'thrissur').map(r => [r.item_id, r]));
    expect(Object.keys(out).sort()).toEqual(['brinjal', 'nendran', 'raw-banana', 'tomato']);
    expect(out.tomato).toEqual({ item_id: 'tomato', region: 'thrissur', day: '2026-10-06', source: 'vfpck', price: 50, wholesale: 45 });
    expect(out.nendran.price).toBe(71.5);
    expect(out.brinjal).toMatchObject({ price: 44.5, wholesale: 39 });
    expect(parseVfpck('<p>no date here</p>', 'thrissur')).toEqual([]);
  });

  it('reads Goodreturns: today from the title, history from the table', () => {
    const html = `<title>Petrol Price in Ernakulam, Petrol Rate Today (7th Oct, 2026), Rs. 113.50/Ltr - Goodreturns</title>
      <table class="gr-table"><tr><td>October 5, 2026</td><td>&#x20b9;113.53</td><td>0.00</td></tr>
      <tr><td>October 4, 2026</td><td>&#x20b9;113.53</td><td>0.00</td></tr></table>`;
    const at = { fuel: 'petrol', region: 'pathanamthitta', city: 'Kottayam' };
    expect(parseFuel(html, 'petrol', 'pathanamthitta', 'Kottayam')).toEqual([
      { ...at, day: '2026-10-07', price: 113.5 },
      { ...at, day: '2026-10-05', price: 113.53 },
      { ...at, day: '2026-10-04', price: 113.53 },
    ]);
    expect(parseFuel('<title>Something else</title>', 'diesel', 'kollam', 'Kollam')).toEqual([]);
  });

  it('reads gold (22K and 24K per gram) and silver (per gram) for Kerala', () => {
    const gold = `<table><tr><th>Date</th><th>24K</th><th>22K</th></tr>
      <tr><td>Oct 07, 2026</td><td>&#x20b9;15,023 (+1)</td><td>&#x20b9;13,771 (+1)</td></tr>
      <tr><td>Oct 06, 2026</td><td>&#x20b9;15,022 (+104)</td><td>&#x20b9;13,770 (+95)</td></tr></table>`;
    expect(parseGold(gold)).toEqual([
      { kind: 'gold24', region: 'kerala', day: '2026-10-07', price: 15023 },
      { kind: 'gold22', region: 'kerala', day: '2026-10-07', price: 13771 },
      { kind: 'gold24', region: 'kerala', day: '2026-10-06', price: 15022 },
      { kind: 'gold22', region: 'kerala', day: '2026-10-06', price: 13770 },
    ]);
    const silver = `<table><tr><th>Date</th><th>10 gram</th><th>100 gram</th><th>1 Kg</th></tr>
      <tr><td>Oct 07, 2026</td><td>&#x20b9;2,449</td><td>&#x20b9;24,490</td><td>&#x20b9;2,44,900 (-100)</td></tr></table>`;
    expect(parseSilver(silver)).toEqual([{ kind: 'silver', region: 'kerala', day: '2026-10-07', price: 244.9 }]);
  });

  it('reads the LPG cylinder price: today from the title, earlier months from the table', () => {
    const html = `<title>LPG Price in Ernakulam Today Rs. 949.00/14.2 Kg Gas Cylinder (7th Oct, 2026) - Goodreturns</title>
      <table><tr><th>Date</th><th>Domestic (14.2 Kg)</th><th>Commercial (19 Kg)</th></tr>
      <tr><td>September 2026</td><td>&#x20b9;949.00 (0.00)</td><td>&#x20b9;2,763.00</td></tr>
      <tr><td>May 2026</td><td>&#x20b9;920.00 (0.00)</td><td>&#x20b9;3,085.00</td></tr></table>`;
    expect(parseLpg(html, 'ernakulam')).toEqual([
      { kind: 'lpg', region: 'ernakulam', day: '2026-10-07', price: 949 },
      { kind: 'lpg', region: 'ernakulam', day: '2026-09-01', price: 949 },
      { kind: 'lpg', region: 'ernakulam', day: '2026-05-01', price: 920 },
    ]);
  });
});

describe('farm prices', () => {
  it('reads the Rubber Board: Kottayam, per 100 kg → per kg, dated by the heading above the table', () => {
    const html = `<p>Updated 30-06-2022</p><p>देशी बाज़ार 07-10-2026 को प्रति 100 कि.ग्रा. कोट्टयम कोच्ची</p>
      <table><tr><td>श्रेणी</td><td>₹</td><td>$</td></tr><tr><td>&#160;RSS4</td><td>28150.0</td><td>291.35</td></tr>
      <tr><td>ISNR20</td><td>26500.0</td><td>274.25</td></tr><tr><td>Latex(60%)</td><td>20340.0</td><td>210.50</td></tr></table>
      <table><tr><td>RSS4</td><td>27200.0</td><td>281.50</td></tr></table>`;
    expect(parseRubber(html)).toEqual([
      { kind: 'rubber_rss4', region: 'kerala', day: '2026-10-07', price: 281.5, source: 'rubberboard' },
      { kind: 'rubber_isnr20', region: 'kerala', day: '2026-10-07', price: 265, source: 'rubberboard' },
      { kind: 'rubber_latex', region: 'kerala', day: '2026-10-07', price: 203.4, source: 'rubberboard' },
    ]);
  });

  it('reads the Spices Board: Kochi prices, and cardamom auctions weighted by kilos sold', () => {
    const row = (...v) => `<tr>${v.map(c => `<td>${c}</td>`).join('')}</tr>`;
    const html = `<table>${row('Date', 'Spice', 'Market Centre', 'State', 'Grade', 'Source', 'Min', 'Max', 'Avg')}
      ${row('07-Oct-2026', 'Pepper', 'Cochin', 'KERALA', 'Ungarbled', 'Daily News Paper', '-', '-', '704.00')}
      ${row('07-Oct-2026', 'Pepper', 'Cochin', 'KERALA', 'Garbled', 'Daily News Paper', '-', '-', '724.00')}
      ${row('07-Oct-2026', 'Pepper', 'Delhi', 'DELHI', 'Ungarbled', 'Daily News Paper', '-', '-', '999.00')}</table>
      <div>Spice: Small Cardamom, Date of Auction: 07-Oct-2026, Auctioneer: A, Qty Sold (Kgs): 100, Max Price (Rs./Kg): 3600.00, Avg. Price (Rs./Kg): 3000.00</div>
      <div>Spice: Small Cardamom, Date of Auction: 07-Oct-2026, Auctioneer: B, Qty Sold (Kgs): 300, Max Price (Rs./Kg): 3800.00, Avg. Price (Rs./Kg): 3200.00</div>`;
    const out = Object.fromEntries(parseSpices(html).map(r => [r.kind, r.price]));
    expect(out).toEqual({ pepper: 704, pepper_garbled: 724, cardamom: 3150 });
  });

  it('reads Agmarknet farm crops per quintal as per kg', () => {
    const json = { data: {
      columns: [{ key: 'price_group', columns: [{ key: 'as_on_price', title: '05 Oct, 2026' }, { key: 'one_day_ago_price', title: '04 Oct, 2026' }] }],
      records: [{ cmdt_name: 'Copra', as_on_price: '13900.00', one_day_ago_price: null }, { cmdt_name: 'Paddy(Common)', as_on_price: '2815.00' }],
    } };
    expect(parseFarmAgmarknet(json)).toEqual([
      { kind: 'copra', region: 'kerala', day: '2026-10-05', price: 139, source: 'agmarknet' },
      { kind: 'paddy', region: 'kerala', day: '2026-10-05', price: 28.15, source: 'agmarknet' },
    ]);
  });

  it('shows exactly the crops the server fetches', () => {
    expect(FARM.map(f => f.kind).sort()).toEqual([...FARM_KINDS].sort());
  });
});

describe('kitchen basket', () => {
  it('counts only the items that have a price this week', () => {
    const market = marketByItem(['tomato', 'onion'].flatMap(id => [0, 1, 2, 3, 4, 5, 6, 7].map(n => ({
      itemId: id, region: 'ernakulam', day: day(n), source: 'vfpck', price: id === 'tomato' ? 50 : 60,
    }))), 'ernakulam', NOW);
    const basket = basketSeries([], NOW, 10, market);
    expect(basket.items).toEqual([['tomato', 1], ['onion', 1]]);
    expect(basket.at(-1).value).toBe(110);
  });
});
