import { describe, expect, it } from 'vitest';
import { REAL_ENOUGH, withDemo } from './demo.js';
import { fromShared, fromSharedTrip, isRejection, toRow, uuid } from './remote.js';
import { DAY } from './stats.js';
import { mergeMine } from './store.js';

const NOW = new Date('2026-10-06T18:00:00+05:30').getTime();
const demo = {
  reports: [
    { id: 'd1', itemId: 'tomato', price: 40, at: NOW - DAY, demo: true },
    { id: 'd2', itemId: 'onion', price: 44, at: NOW - DAY, demo: true },
  ],
  autos: [{ id: 'a1', km: 3, fare: 70, at: NOW - DAY, demo: true }],
};
const real = (n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, itemId: 'tomato', price: 60, at: NOW - DAY, ...extra }));

describe('withDemo', () => {
  it('keeps demo prices while real ones are few', () => {
    const out = withDemo(demo, { reports: real(REAL_ENOUGH - 1), autos: [] }, NOW);
    expect(out.reports.filter(r => r.demo)).toHaveLength(2);
    expect(out.autos).toHaveLength(1);
  });

  it('drops an item\'s demo prices once it has enough real ones this week', () => {
    const out = withDemo(demo, { reports: real(REAL_ENOUGH), autos: [] }, NOW);
    expect(out.reports.filter(r => r.demo).map(r => r.itemId)).toEqual(['onion']);
    expect(out.reports).toHaveLength(REAL_ENOUGH + 1);
  });

  it('only counts real prices from the last week', () => {
    const out = withDemo(demo, { reports: real(REAL_ENOUGH, { at: NOW - 8 * DAY }), autos: [] }, NOW);
    expect(out.reports.filter(r => r.demo)).toHaveLength(2);
  });

  it('switches auto fares to real ones over 30 days', () => {
    const trips = Array.from({ length: REAL_ENOUGH }, (_, i) => ({ id: `t${i}`, km: 3, fare: 80, at: NOW - 20 * DAY }));
    expect(withDemo(demo, { reports: [], autos: trips }, NOW).autos).toHaveLength(REAL_ENOUGH);
  });
});

describe('mergeMine', () => {
  const row = (id, sync, at = NOW) => ({ id, sync, at });

  it('takes sent rows from the server and keeps unsent and phone-only ones', () => {
    const local = [row('a', 'ok'), row('b', 'pending'), row('c', 'local'), row('gone', 'ok')];
    const server = [row('a', 'ok', NOW - 5), row('b', 'ok'), row('new', 'ok', NOW - 9)];
    const out = mergeMine(local, server);
    expect(out.map(r => r.id)).toEqual(['new', 'a', 'b', 'c']);
    expect(out.find(r => r.id === 'b').sync).toBe('pending'); // still sent once more; the server ignores the repeat
  });

  it('does not bring back rows waiting to be deleted', () => {
    expect(mergeMine([], [row('x', 'ok')], [['reports', 'x']])).toEqual([]);
  });
});

describe('server rows', () => {
  it('maps a report both ways', () => {
    const r = { id: uuid(), itemId: 'tomato', areaId: 'kakkanad', price: 120, paid: 60, qty: '500 g', shop: 'street', at: NOW };
    const row = toRow.reports(r);
    expect(row).toMatchObject({ item_id: 'tomato', area_id: 'kakkanad', qty_label: '500 g', paid_at: new Date(NOW).toISOString() });
    expect(fromShared({ ...row, price: '120.00' })).toEqual({ id: r.id, itemId: 'tomato', areaId: 'kakkanad', price: 120, shop: 'street', at: NOW });
  });

  it('maps a manual auto trip without places', () => {
    const row = toRow.autos({ id: 'x', from: null, to: null, km: 4.2, fare: 90, night: false, at: NOW });
    expect(row).toMatchObject({ from_place: null, to_place: null, km: 4.2, night: false });
    expect(fromSharedTrip({ ...row, km: '4.2', fare: '90.00' })).toMatchObject({ kind: 'auto', from: null, km: 4.2, fare: 90 });
  });

  it('tells a rejection from a network problem', () => {
    expect(isRejection({ code: 'P0001', message: 'daily_limit' })).toBe(true);
    expect(isRejection({ code: '23503' })).toBe(true);
    expect(isRejection({ code: '', message: 'TypeError: Failed to fetch' })).toBe(false);
    expect(isRejection(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('makes v4 uuids', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
