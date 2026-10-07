const svg = (children, size = 20, extra = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{children}</svg>
);

export const Icon = {
  tag: (s = 22) => svg(<><path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.3 7.3a1.4 1.4 0 0 1 0 2l-7.5 7.5a1.4 1.4 0 0 1-2 0l-7.3-7.3a1 1 0 0 1-.3-.7z" /><circle cx="8.3" cy="8.3" r="1.5" /></>, s),
  auto: (s = 22) => svg(<><path d="M3.5 16.5V11a5 5 0 0 1 5-5h5.2a2 2 0 0 1 1.5.7l3.3 3.8h.5a1.5 1.5 0 0 1 1.5 1.5v4.5" /><path d="M10.5 6v4.5h8" /><path d="M3.5 16.5h1.6M9.4 16.5h5.2M18.9 16.5h1.6" /><circle cx="7.2" cy="16.8" r="2" /><circle cx="16.8" cy="16.8" r="2" /></>, s),
  pulse: (s = 22) => svg(<path d="M3 12.5h4l2.5-6 4.5 12 2.5-6H21" />, s),
  rates: (s = 22) => svg(<><ellipse cx="12" cy="6.5" rx="7" ry="2.8" /><path d="M5 6.5v5.2c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6.5" /><path d="M5 11.7v5.2c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5.2" /></>, s),
  user: (s = 22) => svg(<><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>, s),
  plus: (s = 22) => svg(<path d="M12 5v14M5 12h14" />, s, { strokeWidth: 2.4 }),
  search: (s = 20) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></>, s, { strokeWidth: 2.2 }),
  back: (s = 22) => svg(<path d="M15 18l-6-6 6-6" />, s, { strokeWidth: 2.4 }),
  close: (s = 20) => svg(<path d="M6 6l12 12M18 6L6 18" />, s, { strokeWidth: 2.2 }),
  pin: (s = 16) => svg(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>, s, { strokeWidth: 2.2 }),
  chevron: (s = 16) => svg(<path d="M6 9l6 6 6-6" />, s, { strokeWidth: 2.4 }),
  arrow: (s = 20) => svg(<path d="M5 12h14M13 6l6 6-6 6" />, s, { strokeWidth: 2.2 }),
  up: (s = 12) => svg(<path d="M12 19V5M6 11l6-6 6 6" />, s, { strokeWidth: 2.8 }),
  down: (s = 12) => svg(<path d="M12 5v14M6 13l6 6 6-6" />, s, { strokeWidth: 2.8 }),
  swap: (s = 18) => svg(<><path d="M7 4v16M3.5 7.5L7 4l3.5 3.5" /><path d="M17 20V4M13.5 16.5L17 20l3.5-3.5" /></>, s, { strokeWidth: 2.2 }),
  check: (s = 18) => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, s, { strokeWidth: 2.6 }),
  alert: (s = 18) => svg(<><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.4v.1" /></>, s, { strokeWidth: 2.2 }),
  moon: (s = 18) => svg(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />, s),
  eye: (s = 18) => svg(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>, s),
  trash: (s = 17) => svg(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>, s),
  info: (s = 16) => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></>, s, { strokeWidth: 2.2 }),
};

// The app mark: a price tag with a rupee sign, ink on paper.
export function Mark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="mark">
      <rect width="64" height="64" rx="18" fill="currentColor" />
      <path d="M21 16h22M21 25h22M29 16c8 0 11 4 11 9s-3 9-11 9h-6l15 14"
        fill="none" stroke="var(--paper)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
