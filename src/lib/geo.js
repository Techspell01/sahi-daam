// Where you are and where you're going. Your location stays on the phone: it's
// used to pick your area, and sent to OpenStreetMap services (Photon for place
// search, OSRM for road distance) for auto fares. Sahi Daam's server never gets it.
import { AREAS } from './catalog.js';
import { haversineKm, roadKm } from './fare.js';

// Kerala, for place search: west, south, east, north.
const BBOX = [74.85, 8.15, 77.45, 12.85];
const NEAR_KM = 45; // farther than this from every district's middle means "not in Kerala"

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => reject(new Error(e.code === 1 ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60e3 },
    );
  });
}

// Where you are right now, but only if you've already allowed location for this
// site: never pops up a permission prompt. Null otherwise (and on browsers
// without the Permissions API, like older iPhones).
export async function silentPosition() {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' });
    return p?.state === 'granted' ? await getPosition() : null;
  } catch {
    return null;
  }
}

// Your district: the one whose middle is closest, or null outside Kerala. Near a
// border it can pick the neighbour, so people can still change it by hand.
export function nearestArea(pos) {
  let best = null;
  for (const a of AREAS) {
    const km = haversineKm(pos, a);
    if (!best || km < best.km) best = { area: a, km };
  }
  return best && best.km <= NEAR_KM ? best.area : null;
}

const label = f => {
  const p = f.properties;
  const name = p.name ?? p.street ?? 'Place';
  const where = [p.district, p.city].filter(v => v && v !== name)[0];
  return { name, sub: where ?? '' };
};

// Places anywhere in Kerala matching `q`, closest to `near` first.
export async function searchPlaces(q, near, { signal } = {}) {
  const params = new URLSearchParams({ q, limit: '6', lang: 'en', bbox: BBOX.join(',') });
  if (near) { params.set('lat', near.lat); params.set('lon', near.lng); }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`search failed (${res.status})`);
  const { features } = await res.json();
  return features.map(f => ({ ...label(f), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
}

// A short name for where you are now ("Near Kakkanad Junction").
export async function placeName(pos) {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${pos.lat}&lon=${pos.lng}&lang=en&limit=1`);
    const f = (await res.json()).features?.[0];
    if (f) return label(f).name;
  } catch { /* offline: fall through */ }
  return 'Your location';
}

const routes = new Map();

// Road distance in km by the shortest driving route, or the straight-line
// estimate when the routing service can't be reached. `exact` says which.
export async function roadDistance(a, b) {
  const key = [a.lat, a.lng, b.lat, b.lng].map(v => v.toFixed(4)).join(',');
  if (!routes.has(key)) {
    routes.set(key, (async () => {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`);
        const km = (await res.json()).routes?.[0]?.distance / 1000;
        if (km > 0) return { km: Math.max(0.5, Math.round(km * 10) / 10), exact: true };
      } catch { /* offline */ }
      routes.delete(key); // try the service again next time
      return { km: roadKm(a, b), exact: false };
    })());
  }
  return routes.get(key);
}
