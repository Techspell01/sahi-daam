import { useEffect, useMemo, useState } from 'react';
import { AREA, AREAS, CATEGORIES, ITEM, ITEMS, searchItems, UNITS } from '../lib/catalog.js';
import { ago, cheaperPricier, rupees } from '../lib/format.js';
import { nearestArea, silentPosition } from '../lib/geo.js';
import { districtIndex, versus } from '../lib/market.js';
import { itemSummary } from '../lib/prices.js';
import { navigate } from '../lib/router.js';
import { setSettings, SHARED, useLiveMeta, useStore } from '../lib/store.js';
import { Sparkline } from '../components/charts.jsx';
import { Icon, Mark } from '../components/Icons.jsx';
import { localName } from '../components/ui.jsx';

export function Change({ value }) {
  if (value == null) return <span className="chg" />;
  const pct = Math.round(Math.abs(value) * 100);
  if (pct < 2) return <span className="chg flat">steady</span>;
  return (
    <span className="chg" aria-label={`${value > 0 ? 'up' : 'down'} ${pct}% this week`}>
      {value > 0 ? Icon.up() : Icon.down()}{pct}%
    </span>
  );
}

function PriceRow({ s, names }) {
  const { item, fair } = s;
  return (
    <li>
      <button type="button" className="row" onClick={() => navigate(`/item/${item.id}`)}>
        <span className="row-main">
          <span className="row-name">{item.name}</span>
          <span className="row-sub">{localName(item, names)}{fair?.sample && <span className="tag">sample</span>}</span>
        </span>
        <Sparkline values={s.spark} />
        <span className="row-end">
          <span className="row-price">{fair ? rupees(fair.typical) : '–'}<span className="unit">/{UNITS[item.unit].per}</span></span>
          <Change value={s.change} />
        </span>
      </button>
    </li>
  );
}

const VEG = new Set(ITEMS.filter(i => i.cat === 'veg').map(i => i.id));

// Your district against Kerala; or, when your phone says you're in another
// district right now, that district against yours, with a switch.
function WhereCard({ data, area }) {
  const [here, setHere] = useState(null);
  useEffect(() => {
    let live = true;
    silentPosition().then(p => { if (live && p) setHere(nearestArea(p)); });
    return () => { live = false; };
  }, []);
  const index = useMemo(() => districtIndex(data.latest, VEG, AREAS), [data.latest]);
  const away = here && here.id !== area.id ? here : null;

  if (away) {
    const vs = versus(index, away.id, area.id);
    return (
      <section className="where-card">
        <span className="eyebrow">You're in {away.name} right now</span>
        <span className="where-value">{vs != null ? `Vegetables ${cheaperPricier(vs, area.name)}` : `Prices below are for ${area.name}`}</span>
        <span className="where-sub">{vs != null ? "At this week's shop prices." : `No shop prices to compare for ${away.name} yet.`}</span>
        <span className="where-actions">
          <button type="button" className="btn primary" onClick={() => setSettings({ area: away.id })}>Show {away.name} prices</button>
        </span>
      </section>
    );
  }
  const vs = versus(index, area.id);
  if (vs == null) return null;
  return (
    <button type="button" className="where-card" onClick={() => navigate('/pulse')}>
      <span className="eyebrow">{area.name} vs Kerala</span>
      <span className="where-value">Vegetables {cheaperPricier(vs, 'the Kerala middle')}</span>
      <span className="where-sub">At this week's shop prices. Compare all 14 districts →</span>
    </button>
  );
}

export default function Home({ data, onPickArea }) {
  const settings = useStore(s => s.settings);
  const meta = useLiveMeta();
  const recent = useStore(s => s.recent);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const area = AREA[settings.area];

  const summaries = useMemo(
    () => new Map(ITEMS.map(it => [it.id, itemSummary(data.reports, it, settings.area, Date.now(), data.market)])),
    [data.reports, data.market, settings.area],
  );
  const results = searchItems(q);
  const moving = [...summaries.values()]
    .filter(s => s.item.cat !== 'service' && s.change != null && Math.abs(s.change) >= 0.04)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 4);
  const everyday = ITEMS.filter(it => it.pop >= 1);

  return (
    <main className="page">
      <header className="top">
        <span className="brand"><Mark size={30} /><span>Sahi Daam</span></span>
        <button type="button" className="chip-btn" onClick={onPickArea} aria-label={`District: ${area.name}. Change district`}>
          {Icon.pin()}<span>{area.name}</span>{Icon.chevron(14)}
        </button>
      </header>

      <h1 className="display">Is it the<br />right price?</h1>
      <p className="lede">Fair prices across Kerala, before you pay.</p>
      {meta?.checkedAt && (
        <p className="live-line"><i className="live-dot" aria-hidden="true" />Live prices · checked {ago(meta.checkedAt)}</p>
      )}

      <div className="search">
        {Icon.search()}
        <input type="search" placeholder="Tomato, mathi, haircut…" value={q} aria-label="Search prices"
          onChange={e => setQ(e.target.value)} />
        {q && <button type="button" className="icon-btn ghost small" aria-label="Clear search" onClick={() => setQ('')}>{Icon.close(18)}</button>}
      </div>

      {q ? (
        results.length ? (
          <ul className="list">{results.map(it => <PriceRow key={it.id} s={summaries.get(it.id)} names={settings.names} />)}</ul>
        ) : (
          <p className="empty">Nothing called “{q.trim()}” yet. Try the English or Malayalam name.</p>
        )
      ) : (
        <>
          <nav className="chips" aria-label="Categories">
            {[{ id: 'all', label: 'All' }, ...CATEGORIES].map(c => (
              <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} aria-pressed={cat === c.id}
                onClick={() => setCat(c.id)}>{c.label}</button>
            ))}
          </nav>

          {cat === 'all' && (
            <>
              <button type="button" className="auto-card" onClick={() => navigate('/auto')}>
                <span className="auto-card-icon">{Icon.auto(26)}</span>
                <span className="auto-card-text">
                  <span className="auto-card-title">Auto fare</span>
                  <span className="auto-card-sub">The meter fare from where you are, and what people really pay</span>
                </span>
                <span className="auto-card-go">{Icon.arrow()}</span>
              </button>

              {SHARED && <WhereCard data={data} area={area} />}

              {recent.length > 0 && (
                <section>
                  <h2 className="label">Checked recently</h2>
                  <div className="recent">
                    {recent.filter(id => ITEM[id]).map(id => (
                      <button key={id} type="button" className="pill" onClick={() => navigate(`/item/${id}`)}>{ITEM[id].name}</button>
                    ))}
                  </div>
                </section>
              )}

              {moving.length > 0 && (
                <section>
                  <h2 className="label">Moving this week <span className="label-note">{area.name}</span></h2>
                  <div className="bento">
                    {moving.map((s, i) => (
                      <button key={s.item.id} type="button" className={`tile${i === 0 ? ' inverse' : ''}`}
                        onClick={() => navigate(`/item/${s.item.id}`)}>
                        <span className="tile-top">
                          <Change value={s.change} />
                          <Sparkline values={s.spark} w={64} h={26} />
                        </span>
                        <span className="tile-value">{rupees(s.fair?.typical)}<span className="unit">/{UNITS[s.item.unit].per}</span></span>
                        <span className="tile-title">{s.item.name}</span>
                        <span className="tile-sub">{localName(s.item, settings.names)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <section>
            <h2 className="label">
              {cat === 'all' ? 'Everyday' : CATEGORIES.find(c => c.id === cat).label}
              <span className="label-note">typical in {area.name}</span>
            </h2>
            <ul className="list">
              {(cat === 'all' ? everyday : ITEMS.filter(it => it.cat === cat))
                .map(it => <PriceRow key={it.id} s={summaries.get(it.id)} names={settings.names} />)}
            </ul>
            {cat === 'all' && <p className="list-more">{ITEMS.length - everyday.length} more items under the categories above.</p>}
          </section>

          <p className="note">{Icon.info()}<span>{SHARED
            ? "Every price here is real: vegetables from VFPCK's district markets and Agmarknet, the rest from what people paid. Items with no public source show – until someone reports. Prices people add are shared, without names."
            : 'These are demo prices for now. Prices you add are real and stay on this phone.'}</span></p>
        </>
      )}
    </main>
  );
}
