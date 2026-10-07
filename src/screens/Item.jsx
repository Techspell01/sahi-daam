import { useEffect, useMemo, useState } from 'react';
import { AREA, AREAS, CATEGORIES, ITEM, UNITS } from '../lib/catalog.js';
import { ago, cheaperPricier, rupees, SHOP_LABEL, shortDate } from '../lib/format.js';
import { BANDS, itemAcross } from '../lib/market.js';
import { areaMedians, byItem, itemSeries, itemSummary } from '../lib/prices.js';
import { goBack } from '../lib/router.js';
import { median, verdict } from '../lib/stats.js';
import { logCheck, pushRecent, useLiveMeta, useStore } from '../lib/store.js';
import { AreaDots, DataTable, PriceStrip, TrendChart } from '../components/charts.jsx';
import { Icon } from '../components/Icons.jsx';
import { localName, MoneyInput, Verdict } from '../components/ui.jsx';

// Where a live price came from, in words: your district's VFPCK market, the
// average of VFPCK's Kerala markets, your district's mandi, or Kerala's.
function liveSource(fair, unit) {
  const here = AREA[fair.region];
  const margin = `${Math.round((BANDS.agmarknet.low - 1) * 100)}–${Math.round((BANDS.agmarknet.high - 1) * 100)}%`;
  if (fair.source === 'vfpck') {
    return {
      eyebrow: here ? `Fair price · ${here.name}` : 'Fair price · Kerala average',
      sub: <>{here ? <>VFPCK's retail price at {here.market} market</> : <>The average of VFPCK's retail prices at Kerala's district markets</>}{' '}
        on {shortDate(fair.day)}{fair.wholesale ? <> (wholesale {rupees(fair.wholesale)})</> : null}, allowing 10–15% either way between shops.</>,
      note: "Live from VFPCK, Kerala's Vegetable & Fruit Promotion Council, updated daily.",
      trend: here ? `VFPCK retail price, ${here.market}` : 'VFPCK retail price, Kerala average',
    };
  }
  return {
    eyebrow: `Estimated fair price · ${here ? here.name : 'Kerala'}`,
    sub: <>Worked out from {here ? `${here.name}'s` : "Kerala's"} mandi price of <b>{rupees(fair.price)}/{unit}</b> on{' '}
      {shortDate(fair.day)}, plus a typical {margin} shop margin.</>,
    note: 'Live from Agmarknet mandi prices, updated daily.',
    trend: 'estimated from mandi prices',
  };
}

export default function Item({ id, data, onAdd }) {
  const item = ITEM[id];
  const settings = useStore(s => s.settings);
  const meta = useLiveMeta();
  const [quote, setQuote] = useState('');

  const reps = item ? byItem(data.reports).get(id) : [];
  const fair = useMemo(() => item && itemSummary(data.reports, item, settings.area, Date.now(), data.market).fair,
    [data.reports, data.market, item, settings.area]);
  const series = useMemo(() => item ? itemSeries(data.reports, item, fair, Date.now(), data.market) : [],
    [data.reports, data.market, item, fair]);
  // All 14 districts by this week's market prices; by reports once they cover half of Kerala.
  const areas = useMemo(() => {
    const byReports = areaMedians(reps);
    return byReports.length >= 7 ? { rows: byReports, live: false } : { rows: itemAcross(data.latest, id, AREAS), live: true };
  }, [reps, data.latest, id]);
  const estimate = fair?.scope === 'estimate';

  const q = parseFloat(quote);
  const v = fair && q > 0 ? verdict(q, fair) : null;

  useEffect(() => { if (item) pushRecent(id); }, [id, item]);
  useEffect(() => { setQuote(''); }, [id]);
  // Log the check once the user stops typing.
  useEffect(() => {
    if (!v) return;
    const t = setTimeout(() => logCheck({ key: `item:${id}`, kind: 'item', itemId: id, quote: q, typical: fair.typical, offer: v.offer, level: v.level }), 1200);
    return () => clearTimeout(t);
  }, [q, v?.level]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) {
    return (
      <main className="page">
        <div className="page-top"><button type="button" className="icon-btn" onClick={goBack} aria-label="Back">{Icon.back()}</button></div>
        <p className="empty">We don't track that item yet.</p>
      </main>
    );
  }

  const unit = UNITS[item.unit].per;
  const area = AREA[settings.area];
  const latest = fair ? [...fair.reports].sort((a, b) => b.at - a.at).slice(0, 6) : [];

  return (
    <main className="page with-action">
      <div className="page-top">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Back">{Icon.back()}</button>
        <span className="eyebrow">{CATEGORIES.find(c => c.id === item.cat).label} · per {unit}</span>
        <span className="icon-btn-space" />
      </div>

      <h1 className="item-title">{item.name}</h1>
      <p className="item-local">{localName(item, settings.names)}</p>

      {fair ? (() => {
        const live = estimate && liveSource(fair, unit);
        return (
          <section className="fair-card">
            <span className="eyebrow">
              {live ? live.eyebrow : `Fair price ${fair.scope === 'area' ? `in ${area.name}` : 'across Kerala'}`}
              {fair.sample && ' · sample'}
            </span>
            <p className="fair-range" style={{ '--chars': `${rupees(fair.low)}–${rupees(fair.high)}`.length }}>
              {rupees(fair.low)}<span className="fair-dash">–</span>{rupees(fair.high)}
              <span className="unit">/{unit}</span>
            </p>
            {live ? (
              <p className="fair-sub">Shops usually charge about <b>{rupees(fair.typical)}</b>. {live.sub}</p>
            ) : (
              <p className="fair-sub">
                Most people pay about <b>{rupees(fair.typical)}</b>. From {fair.n} {fair.sample ? 'sample ' : ''}reports in the last {fair.days} days
                {fair.removed > 0 && <>, with {fair.removed} unusual {fair.removed === 1 ? 'price' : 'prices'} left out</>}.
              </p>
            )}
            {live && (
              <p className="fair-note">
                {live.note}{meta?.checkedAt ? ` Checked ${ago(meta.checkedAt)}.` : ''} Real prices people add take over once there are enough.
              </p>
            )}
            {fair.sample && <p className="fair-note">Sample data: there's no live price source for {item.name.toLowerCase()} yet. Add what you paid to make it real.</p>}
            {!estimate && !fair.sample && fair.scope === 'city' && <p className="fair-note">Not enough reports in {area.name} yet, so this uses all of Kerala.</p>}
          </section>
        );
      })() : (
        <p className="empty">No price yet. There's no public source for {item.name.toLowerCase()}, so it comes from what people pay. Be the first to add one.</p>
      )}

      {fair && (
        <section className="check">
          <MoneyInput id="quote" label="Check a price they're asking" value={quote} onChange={setQuote} unit={unit} />
          {v && <Verdict v={v} quote={q} fair={fair} />}
        </section>
      )}

      {fair?.reports.length > 0 && (
        <section>
          <h2 className="label">What people paid</h2>
          <p className="sub">Each dot is one report. The shaded band is the middle half; the line is the typical price.</p>
          <PriceStrip fair={fair} quote={q > 0 ? q : 0} unit={unit} />
        </section>
      )}

      <section>
        <h2 className="label">Last 30 days <span className="label-note">{estimate ? liveSource(fair, unit).trend : 'daily median of reports'}</span></h2>
        <TrendChart series={series} unit={unit}
          empty={estimate ? 'The trend fills in day by day as new market prices come in.' : undefined} />
        <DataTable caption={`${item.name}, typical price per ${unit} in ${area.name}`} columns={['Day', `Typical /${unit}`]}
          rows={series.filter(p => p.value != null).reverse().map(p => [shortDate(p.day), rupees(p.value)])} />
      </section>

      {areas.rows.filter(r => r.value != null).length > 1 && (() => {
        const priced = areas.rows.filter(r => r.value != null);
        const mine = priced.find(r => r.id === settings.area);
        const vsKerala = mine && mine.value / median(priced.map(r => r.value)) - 1;
        const mandiOnly = areas.rows.filter(r => r.value == null && r.mandi != null);
        return (
          <section>
            <h2 className="label">
              All 14 districts
              <span className="label-note">{areas.live ? 'shop prices this week' : 'reports, last 14 days'}</span>
            </h2>
            <p className="sub">
              Cheapest in <b>{priced[0].name}</b> ({rupees(priced[0].value)}/{unit}).{' '}
              {mine ? <>{area.name} is <b>{cheaperPricier(vsKerala, 'the Kerala middle')}</b>.</>
                : <>No shop price for {area.name} yet, so it isn't ranked.</>}
            </p>
            <AreaDots rows={areas.rows} current={settings.area} unit={unit} />
            {areas.live && mandiOnly.length > 0 && (
              <p className="sub after">Shop prices come from VFPCK's 7 district markets. Elsewhere only the mandi (wholesale) price is published, and it isn't comparable: some mandis sell at farm-gate prices.</p>
            )}
          </section>
        );
      })()}

      {latest.length > 0 && (
        <section>
          <h2 className="label">Latest reports</h2>
          <ul className="receipt">
            {latest.map(r => (
              <li key={r.id} className={r.outlier ? 'out' : ''}>
                <span className="rc-price">{rupees(r.price)}<span className="faint">/{unit}</span></span>
                <span className="rc-meta">{SHOP_LABEL[r.shop]} · {AREA[r.areaId]?.name}{r.mine ? ' · you' : ''}</span>
                <span className="rc-when">{ago(r.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="action-bar">
        <button type="button" className="btn primary wide" onClick={() => onAdd({ itemId: id })}>
          {Icon.plus(20)} Add the price you paid
        </button>
      </div>
    </main>
  );
}
