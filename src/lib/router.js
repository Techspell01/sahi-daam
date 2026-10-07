// A tiny History-API router: four tabs, the auto fare page, and one page per item.
import { useEffect, useState } from 'react';

export function parse(path) {
  if (path.startsWith('/item/')) return { name: 'item', id: decodeURIComponent(path.slice(6)) };
  const name = { '/auto': 'auto', '/rates': 'rates', '/pulse': 'pulse', '/me': 'me' }[path] ?? 'home';
  return { name };
}

export function navigate(path) {
  if (path === location.pathname) return;
  history.pushState({ inApp: true }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

// Go back if we came from inside the app, otherwise home.
export function goBack() {
  if (history.state?.inApp) history.back();
  else navigate('/');
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(location.pathname));
  useEffect(() => {
    const on = () => setRoute(parse(location.pathname));
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return route;
}
