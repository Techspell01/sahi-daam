import { useCallback, useEffect, useRef, useState } from 'react';
import { VERDICTS } from '../lib/stats.js';
import { rupees } from '../lib/format.js';
import { Icon } from './Icons.jsx';

// Bottom sheet: secondary forms live here instead of stacking more cards on a page.
export function Sheet({ open, onClose, title, children, footer }) {
  const [mounted, setMounted] = useState(open);
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (open) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = e => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('locked');
    const t = setTimeout(() => (ref.current?.querySelector('[data-autofocus]') ?? ref.current)?.focus(), 60);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('locked');
      prev?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;
  return (
    <div className="sheet-wrap" data-open={open}>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Close">{Icon.close()}</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange, label, small }) {
  return (
    <div className={`seg${small ? ' small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'on' : ''}
          onClick={() => onChange(id)}>{text}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" onClick={() => onChange(!checked)}>
      <span className="switch-text"><span>{label}</span>{hint && <span className="switch-hint">{hint}</span>}</span>
      <span className="switch" data-on={checked}><span /></span>
    </button>
  );
}

// The big "₹ ___" field used to check a quote or log a price.
export function MoneyInput({ label, value, onChange, unit, autoFocus, id = 'money' }) {
  return (
    <label className="money" htmlFor={id}>
      <span className="money-label">{label}</span>
      <span className="money-field">
        <span className="money-rupee">₹</span>
        <input id={id} inputMode="decimal" autoComplete="off" placeholder="0" value={value}
          data-autofocus={autoFocus ? '' : undefined}
          onChange={e => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7))} />
        {unit && <span className="money-unit">/{unit}</span>}
      </span>
    </label>
  );
}

const LEVELS = ['good', 'fair', 'high', 'over'];

// Verdict: a word you can read from arm's length, a four-step scale, one line of advice.
export function Verdict({ v, quote, fair }) {
  const { word } = VERDICTS[v.level];
  const range = `${rupees(fair.low)}–${rupees(fair.high)}`;
  const pct = Math.round(Math.abs(v.pct) * 100);
  const line = {
    good: <>{rupees(quote)} is less than most people pay here ({range}).</>,
    fair: <>{rupees(quote)} is in the usual range of {range}.</>,
    high: <>{rupees(quote)} is {pct}% above the usual {rupees(fair.typical)}. Ask for {rupees(v.offer)}.</>,
    over: <>{rupees(quote)} is {pct}% above the usual {rupees(fair.typical)}. Most people pay {range}, so offer around {rupees(v.offer)}.</>,
  }[v.level];
  const strong = v.level === 'high' || v.level === 'over';
  return (
    <div className={`verdict${strong ? ' strong' : ''}`} role="status" aria-live="polite">
      <div className="verdict-head">
        <span className="verdict-icon">{strong ? Icon.alert(20) : Icon.check(20)}</span>
        <span className="verdict-word">{word}</span>
      </div>
      <div className="scale" aria-hidden="true">
        {LEVELS.map(l => <span key={l} className={l === v.level ? 'on' : ''}>{VERDICTS[l].word}</span>)}
      </div>
      <p className="verdict-line">{line}</p>
      {v.suspicious && <p className="verdict-tip">{Icon.info()} Much cheaper than usual. Check the weight and the quality.</p>}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);
  const notify = useCallback(text => {
    const key = ++id.current;
    setToasts(t => [...t.slice(-1), { key, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.key !== key)), 3400);
  }, []);
  return [toasts, notify];
}

export function Toasts({ toasts }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => <div key={t.key} className="toast">{Icon.check(16)}<span>{t.text}</span></div>)}
    </div>
  );
}

// Two taps to confirm, so nothing is deleted by accident.
export function ConfirmButton({ onConfirm, children, confirmText = 'Tap again to confirm', className = 'btn' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`${className}${armed ? ' armed' : ''}`}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmText : children}
    </button>
  );
}

export function localName(item, names) {
  if (names === 'hi') return item.hi;
  if (names === 'both') return `${item.ml} · ${item.hi}`;
  return item.ml;
}
