import { useCallback, useEffect, useMemo, useState } from 'react';
import AddPrice from './components/AddPrice.jsx';
import { Icon } from './components/Icons.jsx';
import TabBar from './components/TabBar.jsx';
import { Sheet, Toasts, useToasts } from './components/ui.jsx';
import { AREAS, ITEMS } from './lib/catalog.js';
import { signedPct } from './lib/format.js';
import { districtIndex } from './lib/market.js';
import { getPosition, nearestArea } from './lib/geo.js';
import { useRoute } from './lib/router.js';
import { setSettings, useData, useStore } from './lib/store.js';
import Auto from './screens/Auto.jsx';
import Home from './screens/Home.jsx';
import Item from './screens/Item.jsx';
import Me from './screens/Me.jsx';
import Pulse from './screens/Pulse.jsx';
import Rates from './screens/Rates.jsx';

function useTheme(theme) {
  useEffect(() => {
    const root = document.documentElement;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      if (theme === 'system') delete root.dataset.theme;
      else root.dataset.theme = theme;
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0B0B' : '#FFFFFF');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

// Each screen gets its own tab title (the build writes the same ones into the
// static pages search engines read; see scripts/seo.mjs).
function usePageTitle(route) {
  const item = route.name === 'item' ? ITEMS.find(i => i.id === route.id) : null;
  useEffect(() => {
    document.title = {
      home: 'Sahi Daam: fair prices across Kerala',
      item: item ? `${item.name} price today in Kerala | Sahi Daam` : 'Sahi Daam',
      rates: 'Gold, fuel and farm rates today in Kerala | Sahi Daam',
      pulse: 'Prices by district this week | Sahi Daam',
      auto: 'Kerala auto fare calculator | Sahi Daam',
      me: 'You | Sahi Daam',
    }[route.name] ?? 'Sahi Daam';
  }, [route.name, item]);
}

export default function App() {
  const route = useRoute();
  const data = useData();
  const settings = useStore(s => s.settings);
  const [toasts, notify] = useToasts();
  const [adding, setAdding] = useState(null);
  const [pickingArea, setPickingArea] = useState(false);
  const [locating, setLocating] = useState(false);
  // Each district against Kerala, shown in the picker.
  const index = useMemo(() => new Map(districtIndex(data.latest, new Set(ITEMS.filter(i => i.cat === 'veg').map(i => i.id)), AREAS)
    .map(r => [r.id, r])), [data.latest]);
  useTheme(settings.theme);
  usePageTitle(route);

  const openAdd = useCallback(init => setAdding(init ?? {}), []);
  const closeAdd = useCallback(() => setAdding(null), []);
  const openArea = useCallback(() => setPickingArea(true), []);
  const closeArea = useCallback(() => setPickingArea(false), []);

  // Your area from GPS. Only the area is kept, never the position.
  const useMyArea = async () => {
    setLocating(true);
    try {
      const area = nearestArea(await getPosition());
      if (area) {
        setSettings({ area: area.id });
        notify(`You're in ${area.name} district. Prices are shown for there.`);
        closeArea();
      } else {
        notify('You seem to be outside Kerala. Pick the district you shop in.');
      }
    } catch (e) {
      notify(e.message === 'denied'
        ? 'Location is turned off for this site. Allow it in your browser settings, or pick a district.'
        : "Couldn't get your location. Pick a district instead.");
    } finally {
      setLocating(false);
    }
  };

  const screen = {
    home: <Home data={data} onPickArea={openArea} />,
    item: <Item key={route.id} id={route.id} data={data} onAdd={openAdd} />,
    auto: <Auto key={settings.area} data={data} onAdd={openAdd} />,
    rates: <Rates data={data} onPickArea={openArea} />,
    pulse: <Pulse data={data} />,
    me: <Me onPickArea={openArea} />,
  }[route.name];

  return (
    <>
      <div className="app">{screen}</div>
      {route.name !== 'item' && <TabBar route={route} onAdd={() => openAdd({})} />}

      <AddPrice open={!!adding} init={adding} onClose={closeAdd} data={data} notify={notify} />

      <Sheet open={pickingArea} onClose={closeArea} title="Your district">
        <p className="sheet-hint">Prices, fuel and gas rates are shown for this district. The % is how its vegetable shop prices compare with the Kerala middle this week, where published.</p>
        <ul className="pick-list">
          <li>
            <button type="button" onClick={useMyArea} disabled={locating}>
              <span className="pick-icon">{Icon.pin(18)}{locating ? 'Finding where you are…' : 'Use my location'}</span>
            </button>
          </li>
          {AREAS.map(a => (
            <li key={a.id}>
              <button type="button" aria-pressed={a.id === settings.area} onClick={() => { setSettings({ area: a.id }); closeArea(); }}>
                <span>{a.name} <span className="faint">{a.ml}</span></span>
                <span className="pick-end">
                  {index.get(a.id) && <span className="faint">{signedPct(index.get(a.id).value)}</span>}
                  {a.id === settings.area && Icon.check()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Toasts toasts={toasts} />
    </>
  );
}
