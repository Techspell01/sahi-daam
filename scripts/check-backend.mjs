// End-to-end check of the backend's rules through the same public API the app
// uses, with two throwaway anonymous accounts that delete themselves at the end.
//   node --env-file=.env.local scripts/check-backend.mjs
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = process.env;
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (node --env-file=.env.local …)');
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let passed = 0;
let failed = 0;
function check(name, ok, info) {
  if (ok) passed++;
  else { failed++; console.log('FAIL', name, JSON.stringify(info ?? null)); }
}

const report = (extra = {}) => ({
  id: randomUUID(), item_id: 'tomato', area_id: 'ernakulam', price: 44, paid: 44, qty_label: '1 kg', shop: 'street',
  paid_at: new Date().toISOString(), ...extra,
});

const a = client();
const b = client();
const nobody = client();
const { data: sa, error: ea } = await a.auth.signInAnonymously();
const { data: sb, error: eb } = await b.auth.signInAnonymously();
if (ea || eb) throw ea ?? eb;
const bId = sb.user.id;

try {
  // Your own prices
  const r1 = report();
  let res = await a.from('reports').insert(r1);
  check('A can add a price', !res.error, res.error);
  res = await a.from('reports').select('*').eq('id', r1.id);
  check('A sees its own price', res.data?.length === 1 && res.data[0].user_id === sa.user.id, res);
  res = await a.from('reports').insert(r1);
  check('sending the same id again is refused as a duplicate', res.error?.code === '23505', res.error);

  // Other people
  res = await b.from('reports').select('id');
  check("B can't read A's rows from the table", res.data?.length === 0, res);
  res = await nobody.from('reports').select('id');
  check("signed out can't read the table", !!res.error || res.data.length === 0, res);
  res = await b.rpc('shared_reports');
  check("A's price doesn't count yet (account under 10 minutes old)", !res.error && !res.data.some(r => r.id === r1.id), res.error);
  res = await nobody.rpc('shared_reports');
  check('shared_reports works signed out', !res.error && Array.isArray(res.data), res.error);
  check('shared_reports never returns user ids', !res.error && res.data.every(r => !('user_id' in r)));
  res = await b.from('reports').delete().eq('id', r1.id).select();
  check("B can't delete A's price", !res.error && res.data.length === 0, res);
  res = await a.from('reports').update({ price: 1 }).eq('id', r1.id).select();
  check("prices can't be edited", !!res.error, res);

  // Forged fields
  res = await a.from('reports').insert(report({ user_id: bId }));
  check("A can't add a price as B", !!res.error, res);
  res = await a.from('reports').insert(report({ counts_from: '2020-01-01T00:00:00Z' }));
  check("A can't choose when its price counts", !!res.error, res);
  res = await a.from('reports').insert(report({ created_at: '2020-01-01T00:00:00Z' }));
  check("A can't choose the server time", !!res.error, res);
  const old = report({ paid_at: '2020-01-01T00:00:00Z' });
  const future = report({ paid_at: '2099-01-01T00:00:00Z' });
  res = await a.from('reports').insert([old, future]);
  check('backdated and future prices are accepted', !res.error, res.error);
  res = await a.from('reports').select('id, paid_at').in('id', [old.id, future.id]);
  const at = Object.fromEntries((res.data ?? []).map(r => [r.id, Date.parse(r.paid_at)]));
  check('…but paid_at is clamped to two days back', Math.abs(at[old.id] - (Date.now() - 2 * 86400e3)) < 120e3, at);
  check('…and never in the future', at[future.id] <= Date.now() + 5e3, at);

  // Bad values
  res = await a.from('reports').insert(report({ item_id: 'unicorn' }));
  check('unknown items are refused', res.error?.code === '23503', res.error);
  res = await a.from('reports').insert(report({ area_id: 'atlantis' }));
  check('unknown areas are refused', res.error?.code === '23503', res.error);
  res = await a.from('reports').insert(report({ price: -5 }));
  check('negative prices are refused', res.error?.code === '23514', res.error);
  res = await a.from('reports').insert(report({ shop: 'mall' }));
  check('unknown shop types are refused', res.error?.code === '23514', res.error);
  res = await nobody.from('reports').insert(report());
  check("signed out can't add", !!res.error, res);

  // Auto fares
  const t1 = { id: randomUUID(), from_place: 'kakkanad', to_place: 'vyttila', km: 9.4, fare: 150, night: false };
  res = await a.from('auto_trips').insert(t1);
  check('A can add an auto fare', !res.error, res.error);
  res = await a.from('auto_trips').insert({ id: randomUUID(), from_place: null, to_place: null, km: 3, fare: 60, night: true });
  check('a typed-in distance needs no places', !res.error, res.error);
  res = await a.from('auto_trips').insert({ id: randomUUID(), from_place: 'narnia', to_place: null, km: 3, fare: 60 });
  check('unknown places are refused', res.error?.code === '23503', res.error);
  res = await b.rpc('shared_trips');
  check("A's trip doesn't count yet", !res.error && !res.data.some(t => t.id === t1.id), res.error);

  // Daily limit: A has 5 rows so far (3 prices, 2 trips); 30 a day across both.
  let added = 5;
  let limit = null;
  while (added <= 30 && !limit) {
    res = await a.from('reports').insert(report());
    if (res.error) limit = res.error;
    else added++;
  }
  check('the 31st price of the day is refused', added === 30 && limit?.message === 'daily_limit', { added, limit });
  res = await b.from('reports').insert(report());
  check("one account's limit doesn't block another", !res.error, res.error);

  // Fair price is public; nothing counts yet, so there's no range from these accounts.
  res = await nobody.rpc('fair_price', { p_item: 'tomato', p_area: 'ernakulam' });
  check('fair_price works signed out', !res.error, res.error);

  // Deleting your data
  res = await nobody.rpc('delete_my_data');
  check("signed out can't call delete_my_data", !!res.error, res);
  res = await a.rpc('delete_my_data');
  check('A can delete its account', !res.error, res.error);
  res = await a.from('reports').select('id');
  check("…and A's prices are gone with it", !res.error && res.data.length === 0, res);
} finally {
  await a.rpc('delete_my_data');
  await b.rpc('delete_my_data');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
