// Today's rates: the numbers people in Kerala check every day. Gold and silver
// are Kerala-wide; fuel and the LPG cylinder are for your district.
import { useMemo } from 'react';
import { AREA } from '../lib/catalog.js';
import { FARM_GROUPS, FARM_SOURCES } from '../lib/farm.js';
import { ago, paise, rupees, shortDate } from '../lib/format.js';
import { fuelNow } from '../lib/market.js';
import { DAY, startOfDay } from '../lib/stats.js';
import { SHARED, useLiveMeta, useStore } from '../lib/store.js';
import { TrendChart } from '../components/charts.jsx';
import { Icon } from '../components/Icons.jsx';

const PAVAN = 8; // grams in a pavan (sovereign), how gold is bought in Kerala

// "+₹95 since 6 Oct", or "No change" when there's nothing to compare.
function Change({ now, money = rupees }) {
  if (!now?.change) return <span className="tile-sub">No change lately</span>;
  return (
    <span className="tile-sub">
      {now.change > 0 ? '+' : '−'}{money(Math.abs(now.change))} since {shortDate(now.since)}
    </span>
  );
}

export default function Rates({ data, onPickArea }) {
  const settings = useStore(s => s.settings);
  const meta = useLiveMeta();
  const area = AREA[settings.area];
  const { gold22, gold24, silver, lpg } = data.rates;
  const g22 = fuelNow(gold22);
  const g24 = fuelNow(gold24);
  const ag = fuelNow(silver);
  const gas = fuelNow(lpg);
  const petrol = fuelNow(data.fuel.petrol);
  const diesel = fuelNow(data.fuel.diesel);
  const fuelCity = data.fuel.petrol.at(-1)?.city;

  // 22K per gram for up to 30 days, starting from the first day we have.
  const goldSeries = useMemo(() => {
    const byDay = new Map(gold22.map(p => [p.day, p.price]));
    const today = startOfDay(Date.now());
    const days = Array.from({ length: 30 }, (_, i) => {
      const day = today - (29 - i) * DAY;
      return { day, value: byDay.get(day) ?? null };
    });
    return days.slice(Math.max(0, days.findIndex(p => p.value != null)));
  }, [gold22]);

  const nothing = !g22 && !petrol && !gas;

  return (
    <main className="page">
      <header className="top">
        <h1 className="title">Today's rates</h1>
        <button type="button" className="chip-btn" onClick={onPickArea} aria-label={`District: ${area.name}. Change district`}>
          {Icon.pin()}<span>{area.name}</span>{Icon.chevron(14)}
        </button>
      </header>
      <p className="lede tight">Gold, silver, fuel, the gas cylinder and farm prices.</p>
      {meta?.checkedAt && (
        <p className="live-line"><i className="live-dot" aria-hidden="true" />Checked {ago(meta.checkedAt)} · the app looks for new prices every minute</p>
      )}

      {nothing && (
        <p className="empty">{SHARED ? 'Rates load when you’re online. Check your connection and come back.' : 'Rates need the online version of the app.'}</p>
      )}

      {g22 && (
        <section className="stat-card">
          <span className="eyebrow">Gold · 22 carat · Kerala · {shortDate(g22.day)}</span>
          <p className="stat-value">{rupees(g22.price)}<span className="unit">/g</span></p>
          <p className="stat-delta">
            <b>{rupees(g22.price * PAVAN)}</b> a pavan (8 g)
            {g22.change ? <> · <span className="delta-chip">{g22.change > 0 ? '+' : '−'}{rupees(Math.abs(g22.change))}</span> since {shortDate(g22.since)}</> : null}
          </p>
          {g24 && <p className="stat-delta">24 carat <b>{rupees(g24.price)}/g</b> · {rupees(g24.price * PAVAN)} a pavan</p>}
          <TrendChart series={goldSeries} unit="g" height={140} empty="The gold chart fills in as daily rates come in." />
        </section>
      )}

      {(petrol || gas || ag) && (
        <section>
          <h2 className="label">
            {area.name}
            {fuelCity && fuelCity !== area.name && <span className="label-note">fuel and gas use {fuelCity}'s rates</span>}
          </h2>
          <div className="bento">
            {petrol && (
              <div className="tile small">
                <span className="tile-value">{paise(petrol.price)}<span className="unit">/L</span></span>
                <span className="tile-title">Petrol</span>
                <Change now={petrol} money={paise} />
              </div>
            )}
            {diesel && (
              <div className="tile small">
                <span className="tile-value">{paise(diesel.price)}<span className="unit">/L</span></span>
                <span className="tile-title">Diesel</span>
                <Change now={diesel} money={paise} />
              </div>
            )}
            {gas && (
              <div className="tile small">
                <span className="tile-value">{rupees(gas.price)}</span>
                <span className="tile-title">Gas cylinder, 14.2 kg</span>
                <Change now={gas} />
              </div>
            )}
            {ag && (
              <div className="tile small">
                <span className="tile-value">{paise(ag.price)}<span className="unit">/g</span></span>
                <span className="tile-title">Silver · Kerala</span>
                <span className="tile-sub">{rupees(ag.price * 1000)} a kilo</span>
              </div>
            )}
          </div>
        </section>
      )}

      {FARM_GROUPS.some(([, crops]) => crops.some(c => data.farm[c.kind]?.length)) && (
        <section>
          <h2 className="label">Farm prices <span className="label-note">Kerala, per kg</span></h2>
          {FARM_GROUPS.map(([group, crops]) => {
            const rows = crops.map(c => ({ ...c, now: fuelNow(data.farm[c.kind] ?? []) })).filter(c => c.now);
            if (!rows.length) return null;
            return (
              <div key={group} className="farm-group">
                <h3 className="farm-title">{group} <span className="label-note">{FARM_SOURCES[rows[0].source]}</span></h3>
                <ul className="receipt farm">
                  {rows.map(c => (
                    <li key={c.kind}>
                      <span className="rc-price">
                        {c.name}{c.note && <span className="faint"> · {c.note}</span>}
                        {c.ml && settings.names !== 'hi' && <span className="farm-ml"> {c.ml}</span>}
                      </span>
                      <span className="rc-when">
                        <b>{c.now.price >= 1000 ? rupees(c.now.price) : paise(c.now.price)}</b>
                        <span className="faint"> {c.now.change ? `${c.now.change > 0 ? '+' : '−'}${paise(Math.abs(c.now.change))}` : shortDate(c.now.day)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {!nothing && (
        <p className="note">
          {Icon.info()}
          <span>
            Gold, silver, fuel and gas from Goodreturns; farm prices from the Rubber Board, the Spices Board and
            Agmarknet. Gold and silver are checked every 15 minutes, everything else every hour, but most sources
            publish once a day: fuel at 6 am, markets in the afternoon, gas on the 1st of the month. Gold and silver
            are Kerala-wide board rates, before making charges and GST. Farm prices are what traders pay growers.
          </span>
        </p>
      )}
    </main>
  );
}
