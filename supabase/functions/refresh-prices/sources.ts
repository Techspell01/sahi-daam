// Where live prices come from, and how to read them. No Deno or Supabase
// imports here, so the parsers can be tested from Node (src/lib/live.test.js).
//
// 1. VFPCK (Vegetable & Fruit Promotion Council Keralam): the day's wholesale and
//    retail price at 7 district markets, for vegetables and bananas. The main source.
// 2. Agmarknet: mandi prices per district, and Kerala-wide. Used for items VFPCK
//    doesn't list (garlic, most fruit), districts without a VFPCK market, and
//    days VFPCK doesn't publish.
// 3. Goodreturns: petrol, diesel and LPG per district, gold and silver for Kerala.
//
// Every row has a `region`: a district id from src/lib/catalog.js, or 'kerala'.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const month = (name: string) => MONTHS[name.slice(0, 3).toLowerCase()];

export type MarketRow = {
  item_id: string; region: string; day: string; source: 'vfpck' | 'agmarknet';
  price: number; wholesale?: number | null;
};

// Where each district's prices come from. `vfpck`: its VFPCK market page id
// (Manjeri for Malappuram, Thalassery for Kannur). `agmarknet`: its Agmarknet
// district ids (some districts are listed twice). `fuel`: its Goodreturns page.
export const DISTRICTS: Record<string, { vfpck?: number; agmarknet: number[]; fuel: string; fuelCity: string }> = {
  thiruvananthapuram: { agmarknet: [284], fuel: 'trivandrum', fuelCity: 'Thiruvananthapuram' },
  kollam: { agmarknet: [277], fuel: 'kollam', fuelCity: 'Kollam' },
  pathanamthitta: { agmarknet: [282], fuel: 'kottayam', fuelCity: 'Kottayam' }, // no page of its own
  alappuzha: { vfpck: 1, agmarknet: [270, 271], fuel: 'alappuzha', fuelCity: 'Alappuzha' },
  kottayam: { vfpck: 9, agmarknet: [278], fuel: 'kottayam', fuelCity: 'Kottayam' },
  idukki: { agmarknet: [274], fuel: 'idukki', fuelCity: 'Idukki' },
  ernakulam: { vfpck: 6, agmarknet: [273], fuel: 'ernakulam', fuelCity: 'Ernakulam' },
  thrissur: { vfpck: 16, agmarknet: [283], fuel: 'thrissur', fuelCity: 'Thrissur' },
  palakkad: { vfpck: 13, agmarknet: [281], fuel: 'palakkad', fuelCity: 'Palakkad' },
  malappuram: { vfpck: 11, agmarknet: [280], fuel: 'malappuram', fuelCity: 'Malappuram' },
  kozhikode: { agmarknet: [272, 279], fuel: 'kozhikode', fuelCity: 'Kozhikode' },
  wayanad: { agmarknet: [285], fuel: 'wayanad', fuelCity: 'Wayanad' },
  kannur: { vfpck: 15, agmarknet: [275], fuel: 'kannur', fuelCity: 'Kannur' },
  kasaragod: { agmarknet: [276], fuel: 'kasaragod', fuelCity: 'Kasaragod' },
};

// --- VFPCK: daily retail prices at district markets -----------------------------
// A table of: name, Kerala-grown wholesale, Kerala-grown retail, out-of-state
// wholesale, out-of-state retail (rupees per kg; 0 = not available that day).
export const vfpckUrl = (id: number) => `https://www.vfpck.org/mwiseprice.asp?ID=${id}`;

// VFPCK name → item ids. Varieties of one item (two brinjals) are averaged.
const VFPCK_NAMES: Record<string, string[]> = {
  'tomato': ['tomato'], 'onion (big)': ['onion'], 'onion (small)': ['shallots'], 'potato': ['potato'],
  'carrot': ['carrot'], 'french beans': ['beans'], 'cabbage': ['cabbage'], 'bhindi': ['okra'],
  'brinjal green long': ['brinjal'], 'brinjal purple round': ['brinjal'], 'green chilli (big)': ['green-chilli'],
  'ginger': ['ginger'], 'drumstick': ['drumstick'], 'beetroot': ['beetroot'], 'cucumber': ['cucumber'],
  'bitter gourd': ['bitter-gourd'], 'pumpkin': ['pumpkin'], 'banana nendran': ['nendran', 'raw-banana'],
};

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function parseVfpck(html: string, region: string): MarketRow[] {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
  const date = /Date:\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(text);
  if (!date || !month(date[1])) return [];
  const day = iso(+date[3], month(date[1]), +date[2]);
  const cells = text.split('\n').map(c => c.trim()).filter(Boolean);
  const found: Record<string, { retail: number[]; wholesale: number[] }> = {};
  for (let i = 0; i + 4 < cells.length; i++) {
    const ids = VFPCK_NAMES[cells[i].toLowerCase()];
    const nums = cells.slice(i + 1, i + 5).map(Number);
    if (!ids || nums.some(n => !Number.isFinite(n))) continue;
    const [kw, kr, ow, or] = nums;
    for (const id of ids) {
      found[id] ??= { retail: [], wholesale: [] };
      for (const r of [kr, or]) if (r > 0 && r < 2000) found[id].retail.push(r);
      for (const w of [kw, ow]) if (w > 0 && w < 2000) found[id].wholesale.push(w);
    }
  }
  return Object.entries(found).filter(([, v]) => v.retail.length).map(([item_id, v]) => ({
    item_id, region, day, source: 'vfpck',
    price: Math.round(avg(v.retail) * 100) / 100,
    wholesale: v.wholesale.length ? Math.round(avg(v.wholesale) * 100) / 100 : null,
  }));
}

// --- Agmarknet 2.0: daily wholesale (mandi) prices -----------------------------
// The public API behind agmarknet.gov.in. No key needed. Each answer holds, per
// commodity, the price on the latest reported day and the two days before it,
// in rupees per quintal (100 kg). The `date` asked for doesn't change that.
export const AGMARKNET = 'https://api.agmarknet.gov.in/v1/dashboard-data/';
export const KERALA = 17;

// Agmarknet commodity id → Sahi Daam item id. All are priced per kg in the app.
// Left out on purpose: coconut (sold per nut), coconut oil and rice (different
// margins from fresh produce), eggs (priced per 100), and shallots (no separate
// commodity).
export const COMMODITIES: Record<number, string> = {
  65: 'tomato', 23: 'onion', 24: 'potato', 125: 'carrot', 80: 'beans', 126: 'cabbage',
  71: 'okra', 32: 'brinjal', 73: 'green-chilli', 87: 'ginger', 25: 'garlic', 140: 'drumstick',
  129: 'beetroot', 131: 'cucumber', 67: 'bitter-gourd', 70: 'pumpkin', 76: 'raw-banana',
  19: 'nendran', 17: 'apple', 18: 'orange', 160: 'pomegranate', 22: 'grapes', 59: 'papaya',
  21: 'pineapple',
};

// `districts`: Agmarknet district ids (answers are summed over them), or none for all of Kerala.
export function agmarknetBody(date: string, districts: number[] = []) {
  return {
    dashboard: 'marketwise_price_arrival',
    date,
    commodity: Object.keys(COMMODITIES).map(Number),
    state: KERALA,
    ...(districts.length ? { district: districts } : {}),
    page: 1,
    limit: 200,
    format: 'json',
  };
}

// "04 Oct, 2026" → "2026-10-04"
export function parseDayTitle(title: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})/.exec(title ?? '');
  return m && MONTHS[m[2].toLowerCase()] ? iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]) : null;
}

// One Agmarknet answer → rows of rupees per kg. Days come from the column titles;
// zero means "not reported that day" and is skipped.
export function parseAgmarknet(json: any, region: string): MarketRow[] {
  const cols = json?.data?.columns?.find((c: any) => c.key === 'price_group')?.columns ?? [];
  const dayOf: Record<string, string | null> = {};
  for (const c of cols) dayOf[c.key] = parseDayTitle(c.title);
  const rows: MarketRow[] = [];
  for (const r of json?.data?.records ?? []) {
    const item = NAMES[String(r.cmdt_name ?? '').trim().toLowerCase()];
    if (!item) continue;
    for (const key of ['as_on_price', 'one_day_ago_price', 'two_day_ago_price']) {
      const perKg = Math.round(parseFloat(r[key])) / 100; // per quintal → per kg, to the paisa
      const day = dayOf[key];
      if (!day || !(perKg >= 1 && perKg <= 2000)) continue;
      rows.push({ item_id: item, region, day, source: 'agmarknet', price: perKg });
    }
  }
  return rows;
}

// Records carry the commodity name, not its id (same commodities as above).
const NAMES: Record<string, string> = {
  tomato: 'tomato', onion: 'onion', potato: 'potato', carrot: 'carrot', beans: 'beans', cabbage: 'cabbage',
  'bhindi(ladies finger)': 'okra', brinjal: 'brinjal', 'green chilli': 'green-chilli', 'ginger(green)': 'ginger',
  garlic: 'garlic', drumstick: 'drumstick', beetroot: 'beetroot', 'cucumbar(kheera)': 'cucumber',
  'bitter gourd': 'bitter-gourd', pumpkin: 'pumpkin', 'banana - green': 'raw-banana', banana: 'nendran',
  apple: 'apple', orange: 'orange', pomegranate: 'pomegranate', grapes: 'grapes', papaya: 'papaya', pineapple: 'pineapple',
};

// --- Fuel: petrol and diesel per district ------------------------------------------
// Goodreturns publishes the day's rate in the page title and the last ten days in
// a table. Its robots.txt allows these pages; we read each twice a day.
export const fuelUrl = (fuel: 'petrol' | 'diesel', page: string) => `https://www.goodreturns.in/${fuel}-price-in-${page}.html`;

export type FuelRow = { fuel: 'petrol' | 'diesel'; region: string; city: string; day: string; price: number };

const FULL_MONTH = /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/;

export function parseFuel(html: string, fuel: 'petrol' | 'diesel', region: string, city: string): FuelRow[] {
  const rows: FuelRow[] = [];
  const ok = (p: number) => p > 50 && p < 300;

  // Title: "Petrol Price in Ernakulam, Petrol Rate Today (7th Oct, 2026), Rs. 113.50/Ltr - Goodreturns"
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '';
  const tDay = /\((\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})\)/.exec(title);
  const tPrice = /Rs\.\s*([\d.]+)\s*\/\s*Ltr/i.exec(title);
  if (tDay && tPrice && MONTHS[tDay[2].toLowerCase()] && ok(+tPrice[1])) {
    rows.push({ fuel, region, city, day: iso(+tDay[3], MONTHS[tDay[2].toLowerCase()], +tDay[1]), price: +tPrice[1] });
  }

  // History table: "October 5, 2026 ₹113.53 0.00"
  const table = /<table class="gr-table[^"]*">([\s\S]*?)<\/table>/.exec(html)?.[1] ?? '';
  const text = table.replace(/<[^>]+>/g, ' ').replace(/&#x20b9;|&#8377;|₹/g, ' ').replace(/\s+/g, ' ');
  const re = new RegExp(`${FULL_MONTH.source}\\s+([\\d.]+)`, 'g');
  for (const m of text.matchAll(re)) {
    const day = iso(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
    if (ok(+m[4]) && !rows.some(r => r.day === day)) rows.push({ fuel, region, city, day, price: +m[4] });
  }
  return rows;
}

// --- Today's rates: gold, silver (Kerala) and LPG (per district) -----------------
// `kind` is gold22, gold24, silver, lpg, or a farm crop (FARM_KINDS below).
// `source` defaults to Goodreturns in the database.
export type RateRow = { kind: string; region: string; day: string; price: number; source?: string };

export const GOLD = 'https://www.goodreturns.in/gold-rates/kerala.html';
export const SILVER = 'https://www.goodreturns.in/silver-rates/kerala.html';
export const lpgUrl = (page: string) => `https://www.goodreturns.in/lpg-price-in-${page}.html`;

const tableTexts = (html: string) => [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)]
  .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/&#x20b9;|&#8377;|₹/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' '));
const amount = (s: string) => Number(s.replace(/,/g, ''));
const SHORT_DATE = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/;

// "Date 24K 22K / Oct 07, 2026 15,023 (+1) 13,771 (+1) / …": the last ten days, per gram.
export function parseGold(html: string): RateRow[] {
  const table = tableTexts(html).find(t => /^Date 24K 22K/.test(t.trim())) ?? '';
  const re = new RegExp(String.raw`${SHORT_DATE.source}\s+([\d,]+)\s*\([^)]*\)\s+([\d,]+)`, 'g');
  const rows: RateRow[] = [];
  for (const m of table.matchAll(re)) {
    if (!month(m[1])) continue;
    const day = iso(+m[3], month(m[1]), +m[2]);
    const [k24, k22] = [amount(m[4]), amount(m[5])];
    if (k24 > 1000 && k24 < 100000) rows.push({ kind: 'gold24', region: 'kerala', day, price: k24 });
    if (k22 > 1000 && k22 < 100000) rows.push({ kind: 'gold22', region: 'kerala', day, price: k22 });
  }
  return rows;
}

// "Date 10 gram 100 gram 1 Kg / Oct 07, 2026 2,449 24,490 2,44,900 (-100) / …": stored per gram.
export function parseSilver(html: string): RateRow[] {
  const table = tableTexts(html).find(t => /^Date 10 gram 100 gram 1 Kg/.test(t.trim())) ?? '';
  const re = new RegExp(String.raw`${SHORT_DATE.source}\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)`, 'g');
  const rows: RateRow[] = [];
  for (const m of table.matchAll(re)) {
    const perGram = Math.round(amount(m[6]) / 10) / 100; // 1 kg → per gram, to the paisa
    if (month(m[1]) && perGram > 10 && perGram < 10000) {
      rows.push({ kind: 'silver', region: 'kerala', day: iso(+m[3], month(m[1]), +m[2]), price: perGram });
    }
  }
  return rows;
}

// Today's domestic 14.2 kg cylinder (title), and the monthly history (dated the 1st).
export function parseLpg(html: string, region: string): RateRow[] {
  const rows: RateRow[] = [];
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '';
  const t = /Rs\.\s*([\d,.]+)\s*\/\s*14\.2 Kg.*\((\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})\)/i.exec(title);
  if (t && month(t[3]) && amount(t[1]) > 200 && amount(t[1]) < 5000) {
    rows.push({ kind: 'lpg', region, day: iso(+t[4], month(t[3]), +t[2]), price: amount(t[1]) });
  }
  const history = tableTexts(html).find(x => /Date Domestic \(14\.2 Kg\)/.test(x)) ?? '';
  for (const m of history.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\s+([\d,.]+)/g)) {
    const price = amount(m[3]);
    const day = iso(+m[2], month(m[1]), 1);
    if (price > 200 && price < 5000 && !rows.some(r => r.day === day)) rows.push({ kind: 'lpg', region, day, price });
  }
  return rows;
}

// --- Farm prices for Kerala's growers, all stored in rupees per kg -------------------
// Rubber Board: the day's domestic prices, per 100 kg. The first table on the
// page is Kottayam, the benchmark market (then Kochi and Agartala).
// Plain http on purpose: the https site's certificate chains to a Let's Encrypt
// root ("ISRG Root YR") that Deno doesn't trust yet, so https fails in the Edge
// Function. These are public reference prices. Switch back once Deno trusts it.
export const RUBBER = 'http://rubberboard.gov.in/public';
const RUBBER_GRADES: Record<string, string> = {
  RSS4: 'rubber_rss4', RSS5: 'rubber_rss5', ISNR20: 'rubber_isnr20', 'Latex(60%)': 'rubber_latex',
};

export function parseRubber(html: string): RateRow[] {
  // The date is in the heading just above the first price table: the nearest one before it.
  const at = html.search(/<table[^>]*>(?:(?!<\/table>)[\s\S])*RSS4/);
  const date = at < 0 ? null : [...html.slice(Math.max(0, at - 3000), at).matchAll(/(\d{2})-(\d{2})-(\d{4})/g)].at(-1);
  const table = tableTexts(html).map(t => t.replace(/&#160;/g, ' ')).find(t => /RSS4/.test(t) && /ISNR20/.test(t));
  if (!date || !table) return [];
  const day = iso(+date[3], +date[2], +date[1]);
  const rows: RateRow[] = [];
  for (const m of table.matchAll(/(RSS4|RSS5|ISNR20|Latex\(60%\))\s+([\d.]+)/g)) {
    const perKg = Number(m[2]) / 100;
    if (perKg > 20 && perKg < 2000) rows.push({ kind: RUBBER_GRADES[m[1]], region: 'kerala', day, price: perKg, source: 'rubberboard' });
  }
  return rows;
}

// Spices Board: Kochi's prices per kg in a table, and the day's small-cardamom
// e-auctions as text. Cardamom is the auctions' average, weighted by kilos sold.
export const SPICES = 'https://www.indianspices.com/marketing/price/domestic/current-market-price.html';
const SPICE_ROWS: [RegExp, RegExp, string][] = [
  [/^Pepper$/i, /^Ungarbled$/i, 'pepper'],
  [/^Pepper$/i, /^Garbled$/i, 'pepper_garbled'],
  [/^Nutmeg$/i, /^Without Shell$/i, 'nutmeg'],
  [/^Mace$/i, /^Red$/i, 'mace'],
  [/^Clove$/i, /.*/, 'clove'],
];
const dmy = (s: string) => {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s);
  return m && month(m[2]) ? iso(+m[3], month(m[2]), +m[1]) : null;
};

export function parseSpices(html: string): RateRow[] {
  const rows: RateRow[] = [];
  const trs = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()));
  for (const [date, spice, centre, , grade, , , , avg] of trs) {
    const day = dmy(date ?? '');
    const price = Number(avg);
    if (!day || !/cochin|kochi/i.test(centre ?? '') || !(price > 10 && price < 50000)) continue;
    const hit = SPICE_ROWS.find(([s, g]) => s.test(spice) && g.test(grade ?? ''));
    if (hit && !rows.some(r => r.kind === hit[2])) rows.push({ kind: hit[2], region: 'kerala', day, price, source: 'spicesboard' });
  }
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const auctions = new Map<string, { kg: number; value: number }>();
  for (const m of text.matchAll(/Small Cardamom\s*,\s*Date of Auction:\s*([\w-]+).*?Qty Sold \(Kgs\):\s*([\d.]+).*?Avg\. Price \(Rs\.\/Kg\):\s*([\d.]+)/g)) {
    const day = dmy(m[1]);
    const kg = Number(m[2]);
    const avg = Number(m[3]);
    if (!day || !(kg > 0) || !(avg > 100 && avg < 20000)) continue;
    const a = auctions.get(day) ?? { kg: 0, value: 0 };
    auctions.set(day, { kg: a.kg + kg, value: a.value + kg * avg });
  }
  for (const [day, a] of auctions) {
    rows.push({ kind: 'cardamom', region: 'kerala', day, price: Math.round((a.value / a.kg) * 100) / 100, source: 'spicesboard' });
  }
  return rows;
}

// Agmarknet, Kerala-wide: the other crops (rupees per quintal → per kg).
export const FARM_COMMODITIES: Record<number, string> = {
  111: 'copra', 116: 'coconut', 118: 'arecanut', 41: 'coffee', 88: 'cocoa', 33: 'cashew', 2: 'paddy', 85: 'tapioca',
};
const FARM_NAMES: Record<string, string> = {
  copra: 'copra', coconut: 'coconut', 'arecanut(betelnut/supari)': 'arecanut', coffee: 'coffee', cocoa: 'cocoa',
  cashewnuts: 'cashew', 'paddy(common)': 'paddy', tapioca: 'tapioca',
};

export function farmBody(date: string) {
  return { ...agmarknetBody(date), commodity: Object.keys(FARM_COMMODITIES).map(Number) };
}

export function parseFarmAgmarknet(json: any): RateRow[] {
  const cols = json?.data?.columns?.find((c: any) => c.key === 'price_group')?.columns ?? [];
  const dayOf: Record<string, string | null> = {};
  for (const c of cols) dayOf[c.key] = parseDayTitle(c.title);
  const rows: RateRow[] = [];
  for (const r of json?.data?.records ?? []) {
    const kind = FARM_NAMES[String(r.cmdt_name ?? '').trim().toLowerCase()];
    if (!kind) continue;
    for (const key of ['as_on_price', 'one_day_ago_price', 'two_day_ago_price']) {
      const perKg = Math.round(parseFloat(r[key])) / 100;
      const day = dayOf[key];
      if (day && perKg >= 1 && perKg <= 5000) rows.push({ kind, region: 'kerala', day, price: perKg, source: 'agmarknet' });
    }
  }
  return rows;
}

// Every farm kind the app knows (src/lib/farm.js lists them for the screen).
export const FARM_KINDS = [
  ...Object.values(RUBBER_GRADES), ...new Set(SPICE_ROWS.map(r => r[2])), 'cardamom', ...Object.values(FARM_COMMODITIES),
];
