// The "add what you paid" sheet, for an item or an auto trip. Designed to take
// five seconds: amount first, sensible defaults for everything else.
import { useEffect, useMemo, useState } from 'react';
import { AREAS, ITEM, ITEMS, PLACE, searchItems, SHOPS, UNITS } from '../lib/catalog.js';
import { rupees } from '../lib/format.js';
import { itemSummary } from '../lib/prices.js';
import { addAuto, addReport, useStore } from '../lib/store.js';
import { Icon } from './Icons.jsx';
import { localName, MoneyInput, Segmented, Sheet } from './ui.jsx';

const POPULAR = ['tomato', 'onion', 'shallots', 'coconut', 'mathi', 'chicken', 'eggs', 'nendran'];

export default function AddPrice({ open, init, onClose, data, notify }) {
  const title = init?.kind === 'auto' ? 'Add an auto fare' : 'Add a price';
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && (init?.kind === 'auto'
        ? <AutoForm init={init} onDone={msg => { notify(msg); onClose(); }} />
        : <ItemForm init={init} data={data} onDone={msg => { notify(msg); onClose(); }} />)}
    </Sheet>
  );
}

function ItemForm({ init, data, onDone }) {
  const settings = useStore(s => s.settings);
  const [itemId, setItemId] = useState(init?.itemId ?? null);
  const [q, setQ] = useState('');
  const [amount, setAmount] = useState('');
  const [qtyId, setQtyId] = useState(null);
  const [shop, setShop] = useState('street');
  const [areaId, setAreaId] = useState(settings.area);

  const item = itemId && ITEM[itemId];
  const unit = item && UNITS[item.unit];
  useEffect(() => { if (unit) setQtyId(unit.def); }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (item?.cat === 'service') setShop('shop'); }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fair = useMemo(() => item && itemSummary(data.reports, item, areaId, Date.now(), data.market).fair,
    [item, areaId, data.reports, data.market]);

  if (!item) {
    const list = q ? searchItems(q) : POPULAR.map(id => ITEM[id]);
    return (
      <>
        <div className="search in-sheet">
          {Icon.search()}
          <input type="search" placeholder="What did you buy?" value={q} onChange={e => setQ(e.target.value)} data-autofocus aria-label="What did you buy?" />
        </div>
        {!q && <p className="sheet-hint">Popular</p>}
        <ul className="pick-list">
          {list.map(it => (
            <li key={it.id}>
              <button type="button" onClick={() => setItemId(it.id)}>
                <span>{it.name}</span><span className="faint">{localName(it, settings.names)}</span>
              </button>
            </li>
          ))}
          {q && !list.length && <li className="empty">No match. Try another name.</li>}
          {!q && <li className="faint pick-more">{ITEMS.length - POPULAR.length} more: search above</li>}
        </ul>
      </>
    );
  }

  const qty = unit.qty.find(o => o[0] === qtyId) ?? unit.qty[0];
  const paid = parseFloat(amount);
  const per = paid > 0 ? paid / qty[2] : 0;
  const odd = fair && per > 0 && (per > fair.high * 1.6 || per < fair.low * 0.5);

  const submit = e => {
    e.preventDefault();
    if (!(paid > 0)) return;
    addReport({ itemId, areaId, paid, qty: { label: qty[1], f: qty[2] }, shop });
    onDone(`Added ${item.name} at ${rupees(per)}/${unit.per}. Thank you!`);
  };

  return (
    <form onSubmit={submit} className="form">
      <button type="button" className="picked" onClick={() => init?.itemId ? null : setItemId(null)} disabled={!!init?.itemId}>
        <span className="picked-name">{item.name}</span>
        <span className="faint">{localName(item, settings.names)}</span>
        {!init?.itemId && <span className="picked-change">Change</span>}
      </button>

      <MoneyInput id="paid" label="You paid" value={amount} onChange={setAmount} autoFocus />

      {unit.qty.length > 1 && (
        <div className="field">
          <span className="field-label">For</span>
          <Segmented label="Quantity" value={qty[0]} onChange={setQtyId} options={unit.qty.map(([id, label]) => [id, label])} />
        </div>
      )}

      <div className="field">
        <span className="field-label">Bought from</span>
        <Segmented label="Bought from" value={shop} onChange={setShop} options={SHOPS.map(s => [s.id, s.label])} small />
      </div>

      <label className="field">
        <span className="field-label">District</span>
        <span className="select">
          <select value={areaId} onChange={e => setAreaId(e.target.value)}>
            {AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {Icon.chevron()}
        </span>
      </label>

      <p className={`form-hint${odd ? ' warn' : ''}`} aria-live="polite">
        {per > 0 && <>That's <b>{rupees(per)}/{unit.per}</b>. </>}
        {odd ? <>That's far from the usual price ({rupees(fair.low)}–{rupees(fair.high)}). Check the amount and the quantity.</>
          : per > 0 && fair ? <>{fair.scope === 'estimate' ? 'Shops usually charge' : 'Others paid'} {rupees(fair.low)}–{rupees(fair.high)}.</> : null}
      </p>

      <button type="submit" className="btn primary wide" disabled={!(paid > 0)}>Add price</button>
    </form>
  );
}

function AutoForm({ init, onDone }) {
  const [fare, setFare] = useState('');
  const paid = parseFloat(fare);
  const where = init.label ?? (init.from ? `${PLACE[init.from].name} → ${PLACE[init.to].name}` : 'Your trip');

  const submit = e => {
    e.preventDefault();
    if (!(paid > 0)) return;
    addAuto({ from: init.from, to: init.to, km: init.km, fare: paid, night: init.night });
    onDone(`Added your ${rupees(paid)} auto fare. Thank you!`);
  };

  return (
    <form onSubmit={submit} className="form">
      <div className="picked static">
        <span className="picked-name">{where}</span>
        <span className="faint">{init.km} km{init.night ? ' · night' : ''}</span>
      </div>
      <MoneyInput id="fare" label="You paid" value={fare} onChange={setFare} autoFocus />
      <button type="submit" className="btn primary wide" disabled={!(paid > 0)}>Add fare</button>
    </form>
  );
}
