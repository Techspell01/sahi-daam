// Renders the PWA icons from the same rupee mark as public/favicon.svg.
import sharp from 'sharp';

const mark = (size, { rounded = true, scale = 1 } = {}) => {
  const pad = (64 - 64 * scale) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="#0B0B0B"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})">
    <path d="M21 16h22M21 25h22M29 16c8 0 11 4 11 9s-3 9-11 9h-6l15 14" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </g></svg>`);
};

const out = [
  ['public/pwa-192.png', 192, {}],
  ['public/pwa-512.png', 512, {}],
  ['public/pwa-maskable-512.png', 512, { rounded: false, scale: 0.72 }],
  ['public/apple-touch-icon.png', 180, { rounded: false, scale: 0.86 }],
];
for (const [file, size, opts] of out) {
  await sharp(mark(size, opts)).png().toFile(file);
  console.log('wrote', file);
}
