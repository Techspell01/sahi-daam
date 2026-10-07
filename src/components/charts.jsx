// Monochrome charts. Ink marks on paper, one series each, so no legends: the
// section title names what is plotted. Every chart has a hover/focus readout,
// and every value is also reachable as text or in a table.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ago, rupees, SHOP_LABEL, shortDate, signedPct } from '../lib/format.js';

export function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(lo, hi, count = 3) {
  const span = hi - lo || 1;
  const mag = 10 ** Math.floor(Math.log10(span / count));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) ?? 10 * mag;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function Tip({ x, y, w, children }) {
  const left = clamp(x, 70, w - 70);
  return <div className="tip" style={{ left, top: y }}>{children}</div>;
}

// Every report as a dot on a price line, the fair band (P25–P75) behind them,
// and the quoted price as a marker. Outliers are drawn hollow: shown, not counted.
export function PriceStrip({ fair, quote, unit }) {
  const [ref, w] = useWidth();
  const [active, setActive] = useState(null);
  const H = 150, top = 30, bottom = 30, padX = 16, r = 4;

  const kept = fair.reports.filter(d => !d.outlier).map(d => d.price);
  const hasQuote = quote > 0;
  const lo = Math.min(...kept, hasQuote ? quote : Infinity);
  const hi = Math.max(...kept, hasQuote ? quote : -Infinity);
  const span = hi - lo || hi * 0.2;
  const d0 = lo - span * 0.08, d1 = hi + span * 0.08;
  const x = v => padX + ((clamp(v, d0, d1) - d0) / (d1 - d0)) * (w - 2 * padX);

  const dots = useMemo(() => {
    if (!w) return [];
    const mid = (top + H - bottom) / 2;
    const laneH = 2 * r + 2.5;
    const maxLanes = Math.max(1, Math.floor((H - bottom - top) / laneH));
    const order = [0];
    for (let i = 1; order.length < maxLanes; i++) order.push(i, -i);
    const last = new Map();
    return [...fair.reports].sort((a, b) => a.price - b.price).map(d => {
      const cx = x(d.price);
      let lane = order.slice(0, maxLanes).find(l => !last.has(l) || cx - last.get(l) >= 2 * r + 1.5) ?? 0;
      last.set(lane, cx);
      return { ...d, cx, cy: mid + lane * laneH };
    });
  }, [fair, w, d0, d1]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left, py = e.clientY - box.top;
    let best = null, bestD = 24;
    dots.forEach((d, i) => { const dd = Math.hypot(d.cx - px, d.cy - py); if (dd < bestD) { bestD = dd; best = i; } });
    setActive(best);
  };
  const onKey = e => {
    if (!dots.length) return;
    if (e.key === 'ArrowRight') setActive(i => (i == null ? 0 : Math.min(i + 1, dots.length - 1)));
    else if (e.key === 'ArrowLeft') setActive(i => (i == null ? 0 : Math.max(i - 1, 0)));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const a = active != null ? dots[active] : null;
  const bandL = x(fair.low), bandR = x(fair.high);
  const narrow = bandR - bandL < 52;
  const base = H - bottom + 8;
  const qx = hasQuote ? x(quote) : 0;

  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg width={w} height={H} tabIndex={0} onPointerMove={pick} onPointerLeave={() => setActive(null)}
          onKeyDown={onKey} onBlur={() => setActive(null)}
          role="img" aria-label={`${fair.reports.length} reports. Middle half paid ${rupees(fair.low)} to ${rupees(fair.high)}. Use arrow keys to read each report.`}>
          <rect className="band" x={bandL} y={top - 8} width={Math.max(2, bandR - bandL)} height={H - bottom - top + 16} rx="8" />
          <line className="median" x1={x(fair.typical)} x2={x(fair.typical)} y1={top - 8} y2={H - bottom + 8} />
          <line className="axis" x1={padX} x2={w - padX} y1={base} y2={base} />
          {dots.map((d, i) => (
            <circle key={d.id} cx={d.cx} cy={d.cy} r={i === active ? r + 1.5 : r}
              className={`dot${d.outlier ? ' out' : ''}${d.mine ? ' mine' : ''}`} />
          ))}
          {narrow ? (
            <text className="tick strong" x={clamp((bandL + bandR) / 2, 40, w - 40)} y={H - 4} textAnchor="middle">
              {rupees(fair.low)}–{rupees(fair.high)}
            </text>
          ) : (
            <>
              <text className="tick strong" x={clamp(bandL, 22, w - 22)} y={H - 4} textAnchor="middle">{rupees(fair.low)}</text>
              <text className="tick strong" x={clamp(bandR, 22, w - 22)} y={H - 4} textAnchor="middle">{rupees(fair.high)}</text>
            </>
          )}
          {hasQuote && (
            <g className="quote-mark">
              <line x1={qx} x2={qx} y1={top - 6} y2={base} />
              <path d={`M${qx - 6} ${top - 13}h12l-6 7z`} />
              <text x={clamp(qx, 44, w - 44)} y={top - 17} textAnchor="middle">Asked {rupees(quote)}</text>
            </g>
          )}
        </svg>
      )}
      {a && (
        <Tip x={a.cx} y={a.cy - 14} w={w}>
          <strong>{rupees(a.price)}<span className="faint">/{unit}</span></strong>
          <span>{SHOP_LABEL[a.shop] ?? 'Report'} · {ago(a.at)}</span>
          {a.mine && <span>Your report</span>}
          {a.outlier && <span>Unusual, left out of the range</span>}
        </Tip>
      )}
    </div>
  );
}

// One line over time: 2px ink, a faint wash under it, the latest value at the end.
export function TrendChart({ series, unit, height = 172, empty = 'Not enough reports yet to draw a trend.' }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const m = { l: 44, r: 52, t: 14, b: 28 };
  const vals = series.map(p => p.value).filter(v => v != null);
  if (vals.length < 2) return <p className="empty">{empty}</p>;

  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.18 || hi * 0.05;
  lo -= pad; hi += pad;
  const n = series.length;
  const pw = Math.max(1, w - m.l - m.r);
  const x = i => m.l + (i / (n - 1)) * pw;
  const y = v => m.t + (1 - (v - lo) / (hi - lo)) * (height - m.t - m.b);
  const ticks = niceTicks(lo, hi, 3).filter(t => t >= lo && t <= hi);

  let line = '', area = '', run = [];
  const flush = () => {
    if (run.length > 1) {
      line += run.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
      area += `M${x(run[0][0])},${y(lo)}` + run.map(([i, v]) => `L${x(i)},${y(v)}`).join('') + `L${x(run.at(-1)[0])},${y(lo)}Z`;
    }
    run = [];
  };
  series.forEach((p, i) => (p.value == null ? flush() : run.push([i, p.value])));
  flush();

  let lastI = n - 1;
  while (series[lastI].value == null) lastI--;
  const nearest = i => {
    for (let k = 0; k < n; k++) {
      for (const j of [i - k, i + k]) if (j >= 0 && j < n && series[j].value != null) return j;
    }
    return null;
  };
  const onMove = e => {
    const box = e.currentTarget.getBoundingClientRect();
    setHover(nearest(clamp(Math.round(((e.clientX - box.left - m.l) / pw) * (n - 1)), 0, n - 1)));
  };
  const onKey = e => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    setHover(h => nearest(clamp((h ?? lastI) + step, 0, n - 1)));
  };
  const h = hover != null ? series[hover] : null;

  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg width={w} height={height} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)}
          onKeyDown={onKey} onBlur={() => setHover(null)}
          role="img" aria-label={`Trend over ${n} days, from ${rupees(vals[0])} to ${rupees(series[lastI].value)}. Use arrow keys to read each day.`}>
          {ticks.map(t => (
            <g key={t}>
              <line className="grid" x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />
              <text className="tick" x={m.l - 8} y={y(t) + 4} textAnchor="end">{rupees(t)}</text>
            </g>
          ))}
          <path className="area" d={area} />
          <path className="line" d={line} />
          <text className="tick" x={m.l} y={height - 6}>{shortDate(series[0].day)}</text>
          <text className="tick" x={x(n - 1)} y={height - 6} textAnchor="end">Today</text>
          {h && <line className="cross" x1={x(hover)} x2={x(hover)} y1={m.t} y2={height - m.b} />}
          <circle className="end" cx={x(lastI)} cy={y(series[lastI].value)} r="4.5" />
          <text className="end-label" x={x(lastI) + 10} y={y(series[lastI].value) + 5}>{rupees(series[lastI].value)}</text>
          {h && <circle className="end" cx={x(hover)} cy={y(h.value)} r="4.5" />}
        </svg>
      )}
      {h && (
        <Tip x={x(hover)} y={y(h.value) - 14} w={w}>
          <strong>{rupees(h.value)}{unit && <span className="faint">/{unit}</span>}</strong>
          <span>{shortDate(h.day)}{h.n ? ` · ${h.n} reports` : ''}</span>
        </Tip>
      )}
    </div>
  );
}

// Compare close values honestly: dots on a shared axis, not bars cut off at a fake zero.
// One row per area: a dot on a shared scale. Areas with only a mandi
// (wholesale) price show it as text instead of a dot, since it isn't comparable.
export function AreaDots({ rows, current, unit }) {
  const vals = rows.map(r => r.value).filter(v => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1;
  const pos = v => ((v - lo + pad) / (hi - lo + 2 * pad)) * 100;
  const tip = r => (r.value != null ? `${r.name}: ${rupees(r.value)}/${unit}${r.n ? ` from ${r.n} reports` : ', shop price'}`
    : r.mandi != null ? `${r.name}: no shop price yet; mandi (wholesale) price ${rupees(r.mandi)}/${unit}`
      : `${r.name}: no price this week`);
  return (
    <ul className="area-dots">
      {rows.map(r => (
        <li key={r.id} className={[r.id === current && 'cur', r.value == null && 'none'].filter(Boolean).join(' ')}
          tabIndex={0} data-tip={tip(r)}>
          <span className="ad-name">{r.name}</span>
          <span className="ad-track">
            {r.value != null ? <span className="ad-dot" style={{ left: `${pos(r.value)}%` }} />
              : r.mandi != null ? <span className="ad-note">mandi {rupees(r.mandi)}</span> : null}
          </span>
          <span className="ad-val">{r.value != null ? rupees(r.value) : '–'}</span>
        </li>
      ))}
    </ul>
  );
}

// Bars that grow left (cheaper) or right (pricier) from a zero line.
export function DivergingBars({ rows, current }) {
  const max = Math.max(...rows.map(r => Math.abs(r.value)), 0.01);
  return (
    <ul className="div-bars">
      {rows.map(r => {
        const width = (Math.abs(r.value) / max) * 50;
        return (
          <li key={r.id} className={r.id === current ? 'cur' : ''} tabIndex={0}
            data-tip={`${r.name}: ${signedPct(r.value, 1)} vs the Kerala middle`}>
            <span className="db-name">{r.name}</span>
            <span className="db-track">
              <span className="db-zero" />
              <span className={`db-bar ${r.value < 0 ? 'neg' : 'pos'}`}
                style={r.value < 0 ? { right: '50%', width: `${width}%` } : { left: '50%', width: `${width}%` }} />
            </span>
            <span className="db-val">{signedPct(r.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Sparkline({ values, w = 56, h = 24 }) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return <span className="spark" style={{ width: w }} />;
  const lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
  const X = i => 2 + (i / (values.length - 1)) * (w - 6);
  const Y = v => 3 + (1 - (v - lo) / (hi - lo || 1)) * (h - 6);
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const [li, lv] = pts.at(-1);
  return (
    <svg className="spark" width={w} height={h} aria-hidden="true">
      <path d={d} />
      <circle cx={X(li)} cy={Y(lv)} r="2.5" />
    </svg>
  );
}

export function DataTable({ caption, columns, rows }) {
  return (
    <details className="table-view">
      <summary>Show as a table</summary>
      <table>
        <caption>{caption}</caption>
        <thead><tr>{columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}
