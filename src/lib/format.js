export function rupees(n) {
  if (n == null || Number.isNaN(n)) return '–';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// (-0.04, 'Kerala') → "4% cheaper than Kerala"; under 2% → "about the same as Kerala".
export function cheaperPricier(x, than) {
  if (x == null || Number.isNaN(x)) return '';
  const pct = Math.round(Math.abs(x) * 100);
  if (pct < 2) return `about the same as ${than}`;
  return `${pct}% ${x < 0 ? 'cheaper' : 'pricier'} than ${than}`;
}

// To the paisa, for prices that move in paise (fuel, silver).
// Meter fares can end in 50 paise: ₹31.50, but ₹90 rather than ₹90.00.
export function fare(n) {
  if (n == null || Number.isNaN(n)) return '–';
  return Number.isInteger(n) ? rupees(n) : paise(n);
}

export function paise(n) {
  if (n == null || Number.isNaN(n)) return '–';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function signedPct(x, digits = 0) {
  const v = Math.round(x * 100 * 10 ** digits) / 10 ** digits;
  if (v === 0) return '0%';
  return `${v > 0 ? '+' : '−'}${Math.abs(v)}%`;
}

export function ago(t, now = Date.now()) {
  const m = Math.round((now - t) / 60e3);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function shortDate(t) {
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const SHOP_LABEL = { street: 'Street vendor', shop: 'Shop', super: 'Supermarket', online: 'Online' };
