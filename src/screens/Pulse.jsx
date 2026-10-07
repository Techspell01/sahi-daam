import { useMemo } from 'react';
import { AREA, AREAS, BASKET, ITEM, ITEMS, UNITS } from '../lib/catalog.js';
import { rupees, shortDate, signedPct } from '../lib/format.js';
import { districtIndex, districtPrices, liveItems } from '../lib/market.js';
import { areaIndex, basketSeries, dataHealth, movers } from '../lib/prices.js';
import { DAY } from '../lib/stats.js';
import { navigate } from '../lib/router.js';
import { useStore } from '../lib/store.js';
import { DataTable, DivergingBars, Sparkline, TrendChart } from '../components/charts.jsx';
import { Change } from './Home.jsx';

const qtyLabel = (id, qty) => {
  const per = UNITS[ITEM[id].unit].per;
  if (per === 'kg') return qty < 1 ? `${qty * 1000} g` : `${qty} kg`;
  if (per === 'litre') return `${qty} L`;
  if (per === 'dozen') return `${qty} dozen`;
  return `${qty}`;
};

// The vegetables every kitchen buys, for the district table.
const TABLE_ITEMS = ['tomato', 'onion', 'shallots', 'potato'];

export default function Pulse({ data }) {
  const settings = useStore(s => s.settings);
  const mine = useStore(s => s.reports);
  const basket = useMemo(() => basketSeries(data.reports, Date.now(), 30, data.market), [data.reports, data.market]);
  // Districts compared: by reports once they cover half of Kerala, else this week's market prices.
  const index = useMemo(() => {
    const byReports = areaIndex(data.reports);
    if (byReports.length >= 7) return { rows: byReports, live: false };
    return { rows: districtIndex(data.latest, new Set(ITEMS.filter(i => i.cat === 'veg').map(i => i.id)), AREAS), live: true };
  }, [data.reports, data.latest]);
  const table = useMemo(() => {
    const prices = districtPrices(data.latest, AREAS);
    const items = TABLE_ITEMS.filter(id => [...(prices.get(id)?.values() ?? [])].some(c => c.retail != null));
    const low = Object.fromEntries(items.map(id => [id, Math.min(...[...prices.get(id).values()].map(c => c.retail ?? Infinity))]));
    return { prices, items, low };
  }, [data.latest]);
  const area = AREA[settings.area];
  const health = useMemo(() => dataHealth(data.reports), [data.reports]);
  const moves = useMemo(() => movers(data.reports, Date.now(), data.market), [data.reports, data.market]);
  const live = useMemo(() => liveItems(data.market).size, [data.market]);

  const known = basket.filter(p => p.value != null);
  const now = known.at(-1);
  // Compare with a week ago only once there's a price from (about) a week ago.
  const weekAgo = now && known.find(p => p.day >= now.day - 7 * DAY && p.day <= now.day - 6 * DAY);
  const delta = weekAgo ? now.value / weekAgo.value - 1 : null;
  const rising = [...moves].filter(m => m.change > 0.02).sort((a, b) => b.change - a.change).slice(0, 4);
  const falling = [...moves].filter(m => m.change < -0.02).sort((a, b) => a.change - b.change).slice(0, 4);

  return (
    <main className="page">
      <header className="top">
        <h1 className="title">Pulse</h1>
      </header>
      <p className="lede tight">How everyday prices are moving in {area.name} and across Kerala.</p>

      {now && <section className="stat-card">
        <span className="eyebrow">Weekly kitchen basket · {area.name}</span>
        <p className="stat-value">{rupees(now.value)}</p>
        {delta != null ? (
          <p className="stat-delta">
            <span className="delta-chip">{signedPct(delta, 1)}</span> vs a week ago ({rupees(weekAgo.value)})
          </p>
        ) : (
          <p className="stat-delta">Tracking live prices since {shortDate(known[0].day)}. The weekly change shows once there's a week of them.</p>
        )}
        {known.length >= 7 && <TrendChart series={basket.slice(basket.indexOf(known[0]))} height={150} />}
        <details className="basket">
          <summary>What's in the basket</summary>
          <ul>
            {BASKET.map(([id, qty]) => <li key={id}><span>{ITEM[id].name}</span><span className="faint">{qtyLabel(id, qty)}</span></li>)}
          </ul>
        </details>
        <DataTable caption="Weekly kitchen basket cost by day" columns={['Day', 'Basket cost']}
          rows={known.slice().reverse().map(p => [shortDate(p.day), rupees(p.value)])} />
      </section>}

      <section>
        <h2 className="label">
          Vegetables by district
          <span className="label-note">vs the Kerala middle, {index.live ? 'shop prices this week' : 'reports this week'}</span>
        </h2>
        {index.rows.length > 1 ? (
          <>
            <DivergingBars rows={index.rows} current={settings.area} />
            <p className="axis-note"><span>← cheaper</span><span>pricier →</span></p>
          </>
        ) : (
          <p className="empty small">Not enough district prices yet to compare. This fills in as market prices and reports come in.</p>
        )}
      </section>

      {table.items.length > 0 && (
        <section>
          <h2 className="label">Prices by district <span className="label-note">shop price per kg, this week · cheapest in bold</span></h2>
          <table className="dist-table">
            <thead>
              <tr><th>District</th>{table.items.map(id => <th key={id}>{ITEM[id].name}</th>)}</tr>
            </thead>
            <tbody>
              {AREAS.map(a => (
                <tr key={a.id} className={a.id === settings.area ? 'cur' : ''}>
                  <td>{a.name}</td>
                  {table.items.map(id => {
                    const c = table.prices.get(id).get(a.id);
                    if (c?.retail != null) return <td key={id} className={c.retail === table.low[id] ? 'low' : ''}>{rupees(c.retail)}</td>;
                    if (c?.mandi != null) return <td key={id} className="mandi">({rupees(c.mandi)})</td>;
                    return <td key={id} className="mandi">–</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sub after">Shop prices from VFPCK's district markets. (₹…) is the mandi (wholesale) price where no shop price is published; it isn't comparable. – means no price this week.</p>
        </section>
      )}

      <section>
        <h2 className="label">Rising <span className="label-note">this week vs last</span></h2>
        <MoverList list={rising} />
      </section>
      <section>
        <h2 className="label">Falling</h2>
        <MoverList list={falling} />
      </section>

      <section>
        <h2 className="label">The data this week</h2>
        <div className="bento">
          <div className="tile small"><span className="tile-value">{health.total.toLocaleString('en-IN')}</span><span className="tile-title">price reports</span></div>
          <div className="tile small"><span className="tile-value">{health.flagged}</span><span className="tile-title">unusual prices set aside</span></div>
          <div className="tile small"><span className="tile-value">{live}</span><span className="tile-title">items priced live from markets</span></div>
          <div className="tile small"><span className="tile-value">{mine.length}</span><span className="tile-title">added by you</span></div>
        </div>
        <p className="note">Unusual prices are found with a robust z-score (median and MAD) per item and area, so one tourist price or typo can't move the fair range. Report counts include sample data for items with no live source.</p>
      </section>
    </main>
  );
}

function MoverList({ list }) {
  if (!list.length) return <p className="empty small">Nothing moving much.</p>;
  return (
    <ul className="movers">
      {list.map(m => (
        <li key={m.item.id}>
          <button type="button" onClick={() => navigate(`/item/${m.item.id}`)}>
            <span className="mv-name">{m.item.name}</span>
            <Sparkline values={m.spark} w={64} h={22} />
            <Change value={m.change} />
          </button>
        </li>
      ))}
    </ul>
  );
}
