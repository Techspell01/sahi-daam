import { navigate } from '../lib/router.js';
import { Icon } from './Icons.jsx';

const TABS = [
  ['home', '/', 'Check', Icon.tag],
  ['rates', '/rates', 'Rates', Icon.rates],
  ['pulse', '/pulse', 'Pulse', Icon.pulse],
  ['me', '/me', 'You', Icon.user],
];

function Tab({ tab: [name, path, label, icon], route }) {
  const on = route.name === name;
  return (
    <button type="button" className={`tab${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => navigate(path)}>
      {icon(22)}<span>{label}</span>
    </button>
  );
}

export default function TabBar({ route, onAdd }) {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {TABS.slice(0, 2).map(t => <Tab key={t[0]} tab={t} route={route} />)}
        <button type="button" className="tab-add" onClick={onAdd} aria-label="Add a price you paid">{Icon.plus(24)}</button>
        {TABS.slice(2).map(t => <Tab key={t[0]} tab={t} route={route} />)}
      </div>
    </nav>
  );
}
