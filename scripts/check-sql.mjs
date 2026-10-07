// Checks that the database's fair_range() gives the same answer as fairRange()
// in src/lib/stats.js, on every item × area pool in the demo data plus edge cases.
//   node --env-file=.env.local scripts/check-sql.mjs
import { createClient } from '@supabase/supabase-js';
import { AREAS, ITEMS } from '../src/lib/catalog.js';
import { makeDemo } from '../src/lib/demo.js';
import { DAY, fairRange } from '../src/lib/stats.js';

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = process.env;
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (node --env-file=.env.local …)');
const db = createClient(url, key, { auth: { persistSession: false } });

const now = new Date('2026-10-06T18:00:00+05:30').getTime();
const { reports } = makeDemo({ now });
const pools = [
  [], [42], [40, 41], [12, 12, 12], [12, 12, 12, 12, 30], [40, 42, 38, 41, 44, 39, 95, 12],
  [38, 40, 41, 42, 43, 45, 120], [10, 10, 10, 10, 10, 10], [99.99, 100.01, 100, 250.5, 0.5],
];
for (const it of ITEMS) {
  const forItem = reports.filter(r => r.itemId === it.id);
  pools.push(forItem.filter(r => r.at >= now - 30 * DAY).map(r => r.price));
  for (const a of AREAS) pools.push(forItem.filter(r => r.areaId === a.id && r.at >= now - 7 * DAY).map(r => r.price));
}

// Retry dropped connections; only a wrong answer should fail the check.
async function fairRangeSql(prices) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await db.rpc('fair_range', { prices });
    if (!error) return data[0];
    if (error.code || attempt === 4) throw error;
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
}

const same = (js, sql) => (Number.isNaN(js) ? sql == null : Math.abs(js - sql) < 1e-9);
let failed = 0;
for (let i = 0; i < pools.length; i += 5) {
  await Promise.all(pools.slice(i, i + 5).map(async prices => {
    const sql = await fairRangeSql(prices);
    const js = fairRange(prices);
    const ok = ['low', 'typical', 'high'].every(k => same(js[k], sql[k])) && js.n === sql.n && js.removed === sql.removed;
    if (!ok) {
      failed++;
      console.log('MISMATCH', prices.length, 'prices', { js: { ...js, mask: undefined }, sql });
    }
  }));
}
console.log(`${pools.length - failed}/${pools.length} pools match (${pools.reduce((s, p) => s + p.length, 0)} prices)`);
process.exit(failed ? 1 : 0);
