// The fair-price engine. Pure functions, no React, so they are easy to test and
// can move to a Postgres function or an Edge Function later unchanged.

export const DAY = 24 * 60 * 60 * 1000;

export function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values) {
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

// Outlier detection with the modified z-score (Iglewicz & Hoaglin):
// z = 0.6745 (x - median) / MAD, and anything with |z| > 3.5 is left out.
// The median and MAD are not dragged around by the outliers themselves,
// unlike a mean and standard deviation. When most values are identical
// (MAD = 0) fall back to "within 50% of the median".
export function outlierMask(values, limit = 3.5) {
  if (values.length < 4) return values.map(() => false);
  const med = median(values);
  const mad = median(values.map(v => Math.abs(v - med)));
  if (mad === 0) return values.map(v => Math.abs(v - med) > med * 0.5);
  return values.map(v => Math.abs((0.6745 * (v - med)) / mad) > limit);
}

// Fair range for one item: the middle half (P25–P75) of recent, cleaned reports.
// Prefers the user's area; widens to the whole city, then to 30 days, when
// there are too few reports to trust.
export function fairPrice(reports, { itemId, areaId, now = Date.now(), days = 7, minN = 6 }) {
  const forItem = reports.filter(r => r.itemId === itemId && r.at <= now);
  const recent = forItem.filter(r => r.at >= now - days * DAY);
  const steps = [
    { scope: 'area', days, pool: recent.filter(r => r.areaId === areaId) },
    { scope: 'city', days, pool: recent },
    { scope: 'city', days: 30, pool: forItem.filter(r => r.at >= now - 30 * DAY) },
  ];
  const step = steps.find(s => s.pool.length >= minN) ?? steps[2];
  if (step.pool.length < 3) return null;

  const { mask, ...range } = fairRange(step.pool.map(r => r.price));
  return {
    ...range,
    scope: step.scope,
    days: step.days,
    reports: step.pool.map((r, i) => ({ ...r, outlier: mask[i] })),
  };
}

// The middle half of a list of prices once outliers are out. The database has
// the same function (fair_range in supabase/migrations), checked against this
// one by scripts/check-sql.mjs.
export function fairRange(prices) {
  const mask = outlierMask(prices);
  const sorted = prices.filter((_, i) => !mask[i]).sort((a, b) => a - b);
  return {
    low: quantile(sorted, 0.25),
    typical: quantile(sorted, 0.5),
    high: quantile(sorted, 0.75),
    n: sorted.length,
    removed: prices.length - sorted.length,
    mask,
  };
}

export const VERDICTS = {
  good: { word: 'Good deal', line: 'Less than most people pay here.' },
  fair: { word: 'Fair price', line: 'Right in the usual range.' },
  high: { word: 'A bit high', line: 'Slightly above what most people pay.' },
  over: { word: 'Overpriced', line: 'Well above what most people pay.' },
};

// Compare a quoted price with the fair range.
export function verdict(quote, fair) {
  const pct = (quote - fair.typical) / fair.typical;
  let level = 'over';
  if (quote <= fair.low) level = 'good';
  else if (quote <= fair.high) level = 'fair';
  else if (quote <= fair.high * 1.15) level = 'high';
  return {
    level,
    pct,
    offer: niceRound(fair.typical),
    // Far below everyone else usually means short weight or poor quality.
    suspicious: quote < fair.low * 0.6,
  };
}

// Round to amounts people actually say out loud: ₹1 under ₹50, ₹5 under ₹500, else ₹10.
export function niceRound(x) {
  const step = x < 50 ? 1 : x < 500 ? 5 : 10;
  return Math.round(x / step) * step;
}

// Daily medians (rolling `window` days, cleaned) for the last `days` days, oldest first.
export function dailySeries(reports, { now = Date.now(), days = 30, window = 3 } = {}) {
  const today = startOfDay(now);
  const byDay = new Map();
  for (const r of reports) {
    const d = Math.round((today - startOfDay(r.at)) / DAY);
    if (d < 0 || d >= days + window) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(r.price);
  }
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const vals = [];
    for (let w = 0; w < window; w++) vals.push(...(byDay.get(d + w) ?? []));
    const mask = outlierMask(vals);
    const kept = vals.filter((_, i) => !mask[i]);
    out.push({ day: today - d * DAY, value: kept.length ? median(kept) : null, n: kept.length });
  }
  return out;
}

// Recent median vs the week before: the "is it going up?" number.
export function change(reports, { now = Date.now(), recentDays = 3, baseDays = 7 } = {}) {
  const cut = now - recentDays * DAY;
  const recent = clean(reports.filter(r => r.at > cut && r.at <= now).map(r => r.price));
  const base = clean(reports.filter(r => r.at <= cut && r.at > cut - baseDays * DAY).map(r => r.price));
  if (recent.length < 3 || base.length < 3) return null;
  return median(recent) / median(base) - 1;
}

export function clean(values) {
  const mask = outlierMask(values);
  return values.filter((_, i) => !mask[i]);
}

export function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
