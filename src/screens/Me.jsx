import { AREA, ITEM, PLACE } from '../lib/catalog.js';
import { ago, rupees } from '../lib/format.js';
import { clearMine, removeAuto, removeReport, setSettings, SHARED, useStore } from '../lib/store.js';
import { Icon } from '../components/Icons.jsx';
import { ConfirmButton, Segmented } from '../components/ui.jsx';

export default function Me({ onPickArea }) {
  const settings = useStore(s => s.settings);
  const reports = useStore(s => s.reports);
  const autos = useStore(s => s.autos);
  const checks = useStore(s => s.checks);

  const caught = checks.filter(c => c.level === 'high' || c.level === 'over');
  const spotted = caught.reduce((s, c) => s + Math.max(0, c.quote - c.offer), 0);
  const mine = [
    ...reports.map(r => ({ ...r, what: ITEM[r.itemId]?.name, price: `${rupees(r.paid)} for ${r.qty}`, where: AREA[r.areaId]?.name, remove: () => removeReport(r.id) })),
    ...autos.map(a => ({ ...a, what: 'Auto', price: rupees(a.fare), where: a.from ? `${PLACE[a.from].name} → ${PLACE[a.to].name}` : `${a.km} km`, remove: () => removeAuto(a.id) })),
  ].sort((a, b) => b.at - a.at);
  // Shown instead of the time while a price isn't on the server.
  const status = r => (!SHARED ? null : r.sync === 'pending' ? 'sending' : r.sync === 'local' ? 'phone only' : null);

  return (
    <main className="page">
      <header className="top">
        <h1 className="title">You</h1>
      </header>

      <div className="bento">
        <div className="tile wide inverse">
          <span className="eyebrow">Overcharges spotted</span>
          <span className="tile-value big">{rupees(spotted)}</span>
          <span className="tile-sub">{caught.length ? `Across ${caught.length} ${caught.length === 1 ? 'quote' : 'quotes'} that were above the usual price.` : 'Check a quote and this fills up when you catch one.'}</span>
        </div>
        <div className="tile small"><span className="tile-value">{reports.length + autos.length}</span><span className="tile-title">prices you added</span></div>
        <div className="tile small"><span className="tile-value">{checks.length}</span><span className="tile-title">quotes you checked</span></div>
      </div>

      <section>
        <h2 className="label">Your prices</h2>
        {mine.length ? (
          <ul className="receipt mine">
            {mine.map(r => (
              <li key={r.id}>
                <span className="rc-price">{r.what}</span>
                <span className="rc-meta">{r.price} · {r.where}</span>
                <span className="rc-when">{status(r) ?? ago(r.at)}</span>
                <button type="button" className="icon-btn ghost small" aria-label={`Delete ${r.what} price`} onClick={r.remove}>{Icon.trash()}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing yet. After you buy something, add what you paid. It takes five seconds and helps the next person.</p>
        )}
      </section>

      <section>
        <h2 className="label">Settings</h2>
        <div className="settings">
          <button type="button" className="set-row" onClick={onPickArea}>
            <span>Your district</span><span className="set-value">{AREA[settings.area].name} {Icon.chevron(14)}</span>
          </button>
          <div className="set-row col">
            <span>Appearance</span>
            <Segmented label="Appearance" small value={settings.theme} onChange={theme => setSettings({ theme })}
              options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
          </div>
          <div className="set-row col">
            <span>Local names</span>
            <Segmented label="Local names" small value={settings.names} onChange={names => setSettings({ names })}
              options={[['ml', 'മലയാളം'], ['hi', 'हिन्दी'], ['both', 'Both']]} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="label">About</h2>
        <p className="note plain">
          Sahi Daam shows fair prices across Kerala, so you know what to pay before you pay.
          {SHARED ? (
            <> Prices you add are shared with everyone, with only the area, never your name or exact location.
              There's no sign-up: this phone gets an anonymous account the first time you add a price.
              Vegetable prices come daily from VFPCK's district markets and Agmarknet mandi prices, and gold, fuel and
              gas rates from Goodreturns. Items marked sample have no live source yet. The quotes you check stay on this phone, and so
              does your location: it's only used to find your district and auto routes.</>
          ) : (
            <> Right now the prices are demo data. Your own reports and checks are saved only on this phone.</>
          )}
        </p>
        {(mine.length > 0 || checks.length > 0) && (
          <ConfirmButton className="btn outline wide" onConfirm={clearMine} confirmText="Tap again to delete everything">
            {Icon.trash()} Delete my data
          </ConfirmButton>
        )}
      </section>
    </main>
  );
}
