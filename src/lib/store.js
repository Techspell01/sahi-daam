// App state: your prices and auto fares, the quotes you checked, and settings,
// kept in localStorage. With Supabase set up (phase 2, see remote.js) the
// prices you add are also sent to the server, and everyone else's are fetched
// from it. Demo prices are generated, never stored. Screens only use the hooks
// and actions below, so they don't need to know where the data lives.
import { useMemo, useSyncExternalStore } from 'react';
import * as cache from './cache.js';
import { areaId } from './catalog.js';
import { makeDemo, withDemo } from './demo.js';
import { liveItems, marketByItem } from './market.js';
import * as remote from './remote.js';
import { DAY } from './stats.js';

// True when prices are shared through the server.
export const SHARED = remote.enabled;

const KEY = 'sahidaam:v1';
const SHARED_KEY = 'sahidaam:shared:v1'; // in IndexedDB (cache.js); older versions used localStorage
const DEFAULTS = {
  // Your rows. `sync` is 'pending' (not sent yet), 'ok' (on the server) or
  // 'local' (only on this phone: added before sharing, or turned down by the server).
  reports: [],
  autos: [],
  deletes: [], // [kind, id] of your rows still to delete on the server
  forget: false, // "Delete my data" still has to reach the server
  checks: [],
  recent: [],
  settings: { area: 'ernakulam', theme: 'system', names: 'ml' },
};
// Everyone else's prices plus live mandi and fuel prices, cached for offline use.
// `cursor` is the newest visible_at fetched, `full` when everything was last fetched.
// Live prices are for one district (`region`) and refetched when you change it.
const NO_SHARED = { reports: [], autos: [], market: [], latest: [], fuel: [], rates: [], region: null, at: 0, full: 0, cursor: null };

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}

function load() {
  const saved = read(KEY);
  const shared = { ...NO_SHARED, ...read(SHARED_KEY) }; // from older versions, until IndexedDB has loaded
  if (!saved) return { ...DEFAULTS, shared };
  // Prices added before sharing existed were promised to stay on this phone.
  // Areas used to be Kochi neighbourhoods; those are all in Ernakulam now.
  const local = r => ({ ...r, sync: r.sync ?? 'local', ...(r.areaId ? { areaId: areaId(r.areaId) } : {}) });
  const settings = { ...DEFAULTS.settings, ...saved.settings };
  return {
    ...DEFAULTS, ...saved,
    reports: (saved.reports ?? []).map(local),
    autos: (saved.autos ?? []).map(local),
    settings: { ...settings, area: areaId(settings.area) },
    shared,
  };
}

let state = load();
const listeners = new Set();
const emit = () => listeners.forEach(l => l());

function set(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  const { shared, ...mine } = state; // everyone else's prices have their own key, written only when fetched
  try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch { /* private mode: keep it in memory */ }
  emit();
}

// Writing tens of thousands of rows to IndexedDB blocks the page for a moment,
// so fetchAll calls this only when something changed.
function setShared(shared) {
  state = { ...state, shared };
  cache.setItem(SHARED_KEY, shared);
  emit();
}

// Load the cached prices before the first fetch, so it can ask only for what's new.
const cacheReady = typeof window === 'undefined' ? Promise.resolve() : cache.getItem(SHARED_KEY).then(saved => {
  try { localStorage.removeItem(SHARED_KEY); } catch { /* nothing to tidy */ }
  if (saved && saved.at > state.shared.at) {
    state = { ...state, shared: { ...NO_SHARED, ...saved } };
    emit();
  }
});

const subscribe = l => { listeners.add(l); return () => listeners.delete(l); };

// Select an existing slice of state (never build a new object in the selector).
export function useStore(select) {
  return useSyncExternalStore(subscribe, () => select(state));
}

let demo;
export const getDemo = () => (demo ??= makeDemo());

// Everything the screens show: reports (yours, everyone else's, and sample ones
// for items with no live source), auto trips, live mandi prices by item, and fuel.
export function useData() {
  const reports = useStore(s => s.reports);
  const autos = useStore(s => s.autos);
  const shared = useStore(s => s.shared);
  const area = useStore(s => s.settings.area);
  return useMemo(() => {
    // Until the new district's prices arrive, show none rather than the old district's.
    const here = shared.region === area;
    const market = marketByItem(here ? shared.market : [], area);
    const ids = new Set([...reports, ...autos].map(r => r.id));
    const others = list => list.filter(r => !ids.has(r.id));
    const blended = withDemo(getDemo(), {
      reports: [...others(shared.reports), ...reports],
      autos: [...others(shared.autos), ...autos],
    }, Date.now(), liveItems(market));
    const fuel = kind => (here ? shared.fuel : []).filter(f => f.fuel === kind);
    const rate = kind => (here || kind !== 'lpg' ? shared.rates : []).filter(r => r.kind === kind);
    return {
      ...blended,
      market,
      latest: shared.latest,
      fuel: { petrol: fuel('petrol'), diesel: fuel('diesel') },
      rates: { gold22: rate('gold22'), gold24: rate('gold24'), silver: rate('silver'), lpg: rate('lpg') },
    };
  }, [reports, autos, shared, area]);
}

const newSync = () => (SHARED ? 'pending' : 'local');

export function addReport({ itemId, areaId, paid, qty, shop }) {
  const report = {
    id: remote.uuid(), itemId, areaId, shop, paid, qty: qty.label,
    price: Math.round((paid / qty.f) * 100) / 100, at: Date.now(), mine: true, sync: newSync(),
  };
  set(s => ({ reports: [...s.reports, report] }));
  sync();
  return report;
}

export function addAuto({ from, to, km, fare, night }) {
  const trip = { id: remote.uuid(), kind: 'auto', from, to, km, fare, night, at: Date.now(), mine: true, sync: newSync() };
  set(s => ({ autos: [...s.autos, trip] }));
  sync();
  return trip;
}

function removeMine(kind, id) {
  set(s => {
    const row = s[kind].find(r => r.id === id);
    return {
      [kind]: s[kind].filter(r => r.id !== id),
      // A pending row may be on its way to the server already, so delete it there too.
      deletes: row && row.sync !== 'local' ? [...s.deletes, [kind, id]] : s.deletes,
    };
  });
  sync();
}

export const removeReport = id => removeMine('reports', id);
export const removeAuto = id => removeMine('autos', id);

// One entry per subject: typing "6", "60", "65" updates the same check.
export function logCheck(check) {
  set(s => {
    const last = s.checks[s.checks.length - 1];
    const same = last && last.key === check.key && Date.now() - last.at < 120e3;
    const entry = { ...check, at: Date.now() };
    return { checks: same ? [...s.checks.slice(0, -1), entry] : [...s.checks, entry].slice(-200) };
  });
}

export const pushRecent = itemId =>
  set(s => ({ recent: [itemId, ...s.recent.filter(i => i !== itemId)].slice(0, 8) }));

export function setSettings(patch) {
  const moved = patch.area && patch.area !== state.settings.area;
  set(s => ({ settings: { ...s.settings, ...patch } }));
  if (moved && SHARED) queue(fetchLiveOnly); // that district's prices
}

// Deletes everything on this phone, and the anonymous account with every price it sent.
export function clearMine() {
  set({ reports: [], autos: [], deletes: [], checks: [], recent: [], forget: SHARED });
  sync();
}

// --- Server sync -------------------------------------------------------------

// Server jobs run one at a time, in order, so a delete can't overtake the add it
// undoes. A failed job (offline, server down) is retried by the next sync.
let chain = Promise.resolve();
function queue(job) {
  chain = chain.then(job).catch(() => {});
  return chain;
}

async function sendAll() {
  if (state.forget) {
    await remote.deleteAccount();
    set({ forget: false });
  }
  for (const [kind, id] of state.deletes) {
    try {
      await remote.remove(kind, id);
    } catch (e) {
      if (!remote.isRejection(e)) throw e;
    }
    set(s => ({ deletes: s.deletes.filter(d => d[1] !== id) }));
  }
  for (const kind of ['reports', 'autos']) {
    for (const row of state[kind].filter(r => r.sync === 'pending')) {
      let status = 'ok';
      try {
        await remote.send(kind, row);
      } catch (e) {
        if (!remote.isRejection(e)) throw e;
        status = 'local';
      }
      set(s => ({ [kind]: s[kind].map(r => (r.id === row.id ? { ...r, sync: status } : r)) }));
    }
  }
}

// Your rows: the server's list is the truth for rows already sent. Rows not
// sent yet, or kept only on this phone, stay as they are.
export function mergeMine(local, server, deletes = []) {
  const keep = local.filter(r => r.sync !== 'ok');
  const skip = new Set([...keep.map(r => r.id), ...deletes.map(d => d[1])]);
  return [...keep, ...server.filter(r => !skip.has(r.id))].sort((a, b) => a.at - b.at);
}

// Fresh rows replace cached ones by id; rows older than `since` drop out.
export function mergeShared(old, fresh, since) {
  const byId = new Map(old.filter(r => r.at >= since).map(r => [r.id, r]));
  for (const r of fresh) byId.set(r.id, r);
  return [...byId.values()];
}

const FULL_EVERY = 24 * 3600e3; // a full fetch also drops prices people deleted
const MARGIN = 3 * 60e3; // re-fetch a little overlap; duplicates merge by id

async function fetchAll() {
  await cacheReady;
  const now = Date.now();
  const since = now - 40 * DAY;
  const old = state.shared;
  const delta = old.cursor != null && now - old.full < FULL_EVERY;
  const [shared, live] = await Promise.allSettled([
    remote.fetchShared(since, delta ? old.cursor - MARGIN : null),
    remote.fetchLive(since, state.settings.area),
  ]);
  const next = { ...old, at: now };
  let changed = false;
  if (shared.status === 'fulfilled') {
    const { reports, autos } = shared.value;
    changed = !delta || reports.length > 0 || autos.length > 0;
    if (changed) {
      next.reports = delta ? mergeShared(old.reports, reports, since) : reports;
      next.autos = delta ? mergeShared(old.autos, autos, since) : autos;
    }
    let newest = 0;
    for (const r of next.reports) if (r.seen > newest) newest = r.seen;
    for (const r of next.autos) if (r.seen > newest) newest = r.seen;
    next.cursor = newest || null;
    if (!delta) next.full = now;
  }
  if (live.status === 'fulfilled' && liveChanged(old, live.value)) {
    Object.assign(next, live.value);
    changed = true;
  }
  // Nothing new: keep the same object so screens don't recompute everything.
  if (changed) setShared(next);
  else old.at = now;
  if (shared.status === 'rejected') throw shared.reason;

  const mine = await remote.fetchMine();
  if (mine) {
    set(s => ({
      reports: mergeMine(s.reports, mine.reports, s.deletes),
      autos: mergeMine(s.autos, mine.autos, s.deletes),
    }));
  }
}

const LIVE = ['region', 'market', 'latest', 'fuel', 'rates'];
const liveChanged = (old, live) => LIVE.some(k => JSON.stringify(old[k]) !== JSON.stringify(live[k]));

// Just the live prices, after you change district.
async function fetchLiveOnly() {
  await cacheReady;
  const live = await remote.fetchLive(Date.now() - 40 * DAY, state.settings.area);
  if (liveChanged(state.shared, live)) setShared({ ...state.shared, ...live });
}

export const sync = () => (SHARED ? queue(sendAll) : chain);

// Send anything waiting, then fetch everyone's latest prices. Without `force`
// it does nothing if it ran in the last two minutes.
let lastRefresh = 0;
export function refresh({ force = false } = {}) {
  if (!SHARED || (!force && Date.now() - lastRefresh < 2 * 60e3)) return chain;
  lastRefresh = Date.now();
  sync();
  return queue(fetchAll);
}

if (SHARED && typeof window !== 'undefined') {
  refresh({ force: true });
  window.addEventListener('online', () => refresh({ force: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}
