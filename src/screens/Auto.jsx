import { useEffect, useMemo, useState } from 'react';
import { AREA, PLACE, PLACES } from '../lib/catalog.js';
import { AUTO_RATE, autoFair, isNight, roadKm } from '../lib/fare.js';
import { rupees } from '../lib/format.js';
import { getPosition, placeName, roadDistance, searchPlaces } from '../lib/geo.js';
import { goBack } from '../lib/router.js';
import { verdict } from '../lib/stats.js';
import { logCheck, useStore } from '../lib/store.js';
import { Icon } from '../components/Icons.jsx';
import { MoneyInput, Sheet, Switch, Verdict } from '../components/ui.jsx';

// A landmark from the catalogue, your current location, or a place found on the map.
function PlacePicker({ open, onClose, onPick, title, exclude, near, landmarks: all = [] }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [status, setStatus] = useState('idle'); // idle · searching · failed · denied · nofix
  const [locating, setLocating] = useState(false);
  useEffect(() => { if (open) { setQ(''); setFound([]); setStatus('idle'); } }, [open]);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 3) { setFound([]); return undefined; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setStatus('searching');
      searchPlaces(term, near, { signal: ctl.signal })
        .then(r => { setFound(r); setStatus('idle'); })
        .catch(e => { if (e.name !== 'AbortError') setStatus('failed'); });
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = p => { onPick(p); onClose(); };
  const useHere = async () => {
    setLocating(true);
    try {
      const pos = await getPosition();
      pick({ ...pos, name: await placeName(pos), me: true });
    } catch (e) {
      setStatus(e.message === 'denied' ? 'denied' : 'nofix');
    } finally {
      setLocating(false);
    }
  };
  const landmarks = all.filter(p => p.id !== exclude && (p.name + p.ml).toLowerCase().includes(term.toLowerCase()));

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="search in-sheet">
        {Icon.search()}
        <input type="search" placeholder="Search any place in Kerala" value={q} onChange={e => setQ(e.target.value)} data-autofocus aria-label="Search a place" />
      </div>
      <ul className="pick-list">
        {!term && (
          <li>
            <button type="button" onClick={useHere} disabled={locating}>
              <span className="pick-icon">{Icon.pin(18)}{locating ? 'Finding where you are…' : 'Use my current location'}</span>
            </button>
          </li>
        )}
        {status === 'denied' && <li className="empty">Location is turned off for this site. Allow it in your browser settings, or search for the place.</li>}
        {status === 'nofix' && <li className="empty">Couldn't get your location. Search for the place instead.</li>}
        {landmarks.map(p => (
          <li key={p.id}>
            <button type="button" onClick={() => pick(p)}>
              <span>{p.name}</span><span className="faint">{p.ml}</span>
            </button>
          </li>
        ))}
        {term.length >= 3 && found.length > 0 && <li className="pick-group">On the map</li>}
        {found.map(p => (
          <li key={`${p.lat},${p.lng}`}>
            <button type="button" onClick={() => pick(p)}>
              <span>{p.name}</span><span className="faint">{p.sub}</span>
            </button>
          </li>
        ))}
        {status === 'searching' && <li className="empty">Searching the map…</li>}
        {status === 'failed' && <li className="empty">Map search isn't reachable right now. Pick a landmark, or enter the distance instead.</li>}
        {term.length >= 3 && status === 'idle' && !found.length && !landmarks.length && (
          <li className="empty">No place called “{term}” in Kerala. Try another spelling, or enter the distance instead.</li>
        )}
        {term.length > 0 && term.length < 3 && !landmarks.length && <li className="empty">Keep typing to search the map.</li>}
      </ul>
    </Sheet>
  );
}

// Full-screen card to show the driver: huge numbers, readable from outside the auto.
function DriverCard({ open, onClose, fare, from, to, km, night }) {
  if (!open) return null;
  return (
    <div className="driver" role="dialog" aria-modal="true" aria-label="Fare to show the driver" onClick={onClose}>
      <p className="driver-ml">മീറ്റർ ചാർജ്</p>
      <p className="driver-label">Meter fare</p>
      <p className="driver-fare">{rupees(fare)}</p>
      <p className="driver-route">{from && to ? `${from.name} → ${to.name}` : 'Your trip'} · {km} km{night ? ' · night' : ''}</p>
      <p className="driver-route ml">{from?.ml && to?.ml ? `${from.ml} → ${to.ml}` : ''}</p>
      <button type="button" className="btn ghost-inverse" onClick={onClose}>Close</button>
    </div>
  );
}

// Kochi has landmarks to pick from; elsewhere the trip starts at the district's
// main town, and places come from map search or your location.
const startFor = area => (area.id === 'ernakulam' ? [PLACE.kakkanad, PLACE.vyttila] : [area.town, null]);

export default function Auto({ data, onAdd }) {
  const settings = useStore(s => s.settings);
  const area = AREA[settings.area];
  const landmarks = area.id === 'ernakulam' ? PLACES : [];
  const [from, setFrom] = useState(() => startFor(area)[0]);
  const [to, setTo] = useState(() => startFor(area)[1]);
  const [route, setRoute] = useState(null); // { km, exact } for the current from → to
  const [manual, setManual] = useState(false);
  const [manualKm, setManualKm] = useState('');
  const [night, setNight] = useState(() => isNight());
  const [picking, setPicking] = useState(null);
  const [quote, setQuote] = useState('');
  const [showDriver, setShowDriver] = useState(false);

  // Road distance from the routing service; the straight-line estimate meanwhile.
  useEffect(() => {
    let current = true;
    setRoute(null);
    if (from && to) roadDistance(from, to).then(r => { if (current) setRoute(r); });
    return () => { current = false; };
  }, [from, to]);

  const km = manual ? parseFloat(manualKm) || 0 : from && to ? route?.km ?? roadKm(from, to) : 0;
  const fair = useMemo(() => (km > 0 ? autoFair(data.autos, { km, night }) : null), [data.autos, km, night]);
  const q = parseFloat(quote);
  const v = fair && fair.n && q > 0 ? verdict(q, fair) : null;

  useEffect(() => {
    if (!v) return;
    const t = setTimeout(() => logCheck({ key: `auto:${from?.name}:${to?.name}:${km}`, kind: 'auto', from: from?.id ?? null, to: to?.id ?? null, km, quote: q, typical: fair.typical, offer: v.offer, level: v.level }), 1200);
    return () => clearTimeout(t);
  }, [q, v?.level, km]); // eslint-disable-line react-hooks/exhaustive-deps

  const swap = () => { setFrom(to); setTo(from); };
  const shown = p => (p ? <>{p.me && <span className="route-me">{Icon.pin(14)}</span>}{p.name}</> : <span className="faint">Where to?</span>);

  return (
    <main className="page">
      <div className="page-top">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Back">{Icon.back()}</button>
        <span className="eyebrow">{area.name}</span>
        <span className="icon-btn-space" />
      </div>
      <h1 className="title">Auto fare</h1>
      <p className="lede tight">Know the meter fare before you get in, and what people in Kerala really pay.</p>

      {!manual ? (
        <div className="route">
          <button type="button" className="route-row" onClick={() => setPicking('from')}>
            <span className="route-dot" /><span className="route-label">From</span><span className="route-name">{shown(from)}</span>
          </button>
          <span className="route-line" aria-hidden="true" />
          <button type="button" className="route-row" onClick={() => setPicking('to')}>
            <span className="route-dot end" /><span className="route-label">To</span><span className="route-name">{shown(to)}</span>
          </button>
          <button type="button" className="icon-btn swap" onClick={swap} aria-label="Swap from and to">{Icon.swap()}</button>
        </div>
      ) : (
        <label className="km-field">
          <span>Distance</span>
          <input inputMode="decimal" placeholder="0" value={manualKm} autoFocus
            onChange={e => setManualKm(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} />
          <span>km</span>
        </label>
      )}
      <div className="route-tools">
        <button type="button" className="link-btn" onClick={() => setManual(m => !m)}>
          {manual ? 'Pick places instead' : 'Enter the distance instead'}
        </button>
      </div>
      <Switch checked={night} onChange={setNight} label="Night fare" hint="10 pm to 5 am, 50% extra" />

      {fair && (
        <section className="fare-card">
          <span className="eyebrow">Meter fare · about {km} km</span>
          <p className="fare-big">{rupees(fair.meter)}</p>
          {fair.n > 0 && (
            <p className="fair-sub">
              People usually pay <b>{rupees(fair.low)}–{rupees(fair.high)}</b> for a trip like this.
              {fair.sample && <span className="tag">sample</span>}
            </p>
          )}
          <button type="button" className="btn ghost-inverse" onClick={() => setShowDriver(true)}>{Icon.eye()} Show the driver</button>
        </section>
      )}

      {fair && fair.n > 0 && (
        <section className="check">
          <MoneyInput id="auto-quote" label="The driver is asking" value={quote} onChange={setQuote} />
          {v && <Verdict v={v} quote={q} fair={fair} />}
        </section>
      )}

      <section>
        <h2 className="label">How it's worked out</h2>
        <ul className="facts">
          <li>{AUTO_RATE.source}</li>
          <li>{manual ? 'Distance is the one you entered.'
            : route?.exact ? 'Distance is the shortest road route, from OpenStreetMap.'
            : 'Distance is estimated from the map with a detour allowance, so treat it as approximate.'}</li>
          <li>Your location stays on your phone. Map search and road distance come from OpenStreetMap services (Photon, OSRM), never from Sahi Daam's server.</li>
          {fair?.n > 0 && (fair.sample
            ? <li>“People usually pay” is sample data until enough people add real fares. The meter fare is real.</li>
            : <li>“People usually pay” comes from {fair.n} trips reported in the last 30 days, with {fair.removed} unusual fares left out.</li>)}
        </ul>
      </section>

      {fair && (
        <button type="button" className="btn wide outline" onClick={() => onAdd({
          kind: 'auto', km, night,
          // Only landmarks are saved with a fare; your location and map places never leave the phone.
          from: manual ? null : from?.id ?? null, to: manual ? null : to?.id ?? null,
          label: manual ? null : `${from?.name} → ${to?.name}`,
        })}>
          {Icon.plus(20)} Add the fare you paid
        </button>
      )}

      <PlacePicker open={picking === 'from'} onClose={() => setPicking(null)} onPick={setFrom} title="Starting from"
        exclude={to?.id} near={to ?? from} landmarks={landmarks} />
      <PlacePicker open={picking === 'to'} onClose={() => setPicking(null)} onPick={setTo} title="Going to"
        exclude={from?.id} near={from ?? area.town} landmarks={landmarks} />
      <DriverCard open={showDriver} onClose={() => setShowDriver(false)} fare={fair?.meter} km={km} night={night}
        from={manual ? null : from} to={manual ? null : to} />
    </main>
  );
}
