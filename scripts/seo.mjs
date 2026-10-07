// Runs after `vite build`: gives search engines a real page for every route.
// For each one it writes dist/<route>/index.html with its own title,
// description, canonical URL and readable content inside #root (React replaces
// it on load), plus sitemap.xml and robots.txt. Vercel serves these files
// before the SPA rewrite, so /rates and /item/tomato each get their own page.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { AREAS, CATEGORIES, ITEMS } from '../src/lib/catalog.js';

const SITE = 'https://sahi-daam-lime.vercel.app';
const dist = new URL('../dist/', import.meta.url);
const template = readFileSync(new URL('index.html', dist), 'utf8');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const districts = AREAS.map(a => a.name).join(', ');
const LIVE_CATS = new Set(['veg', 'fruit']);

const itemLinks = cat => ITEMS.filter(i => !cat || i.cat === cat)
  .map(i => `<li><a href="/item/${i.id}">${esc(i.name)} price today <span lang="ml">${esc(i.ml)}</span></a></li>`).join('');

const ROUTES = [
  {
    path: '/',
    title: 'Sahi Daam: fair prices across Kerala. Vegetables, gold rate, fuel and rubber price today',
    description: 'Is it the right price? Check the fair price of vegetables, fruit, fish and auto fares in all 14 Kerala districts, plus today\'s gold rate, petrol, diesel, LPG and rubber prices. Live data, free, no sign-up.',
    body: `<h1>Is it the right price?</h1>
      <p>Sahi Daam shows the fair price of everyday things in all 14 districts of Kerala (${esc(districts)}), using live market prices from VFPCK and Agmarknet and what people actually paid. Type the price you're quoted and it tells you if it's a good deal, fair, a bit high or overpriced.</p>
      <p><a href="/rates">Today's gold rate, petrol, diesel, LPG and farm prices in Kerala</a> · <a href="/auto">Auto fare calculator</a> · <a href="/pulse">Prices by district</a></p>
      ${CATEGORIES.map(c => `<h2>${esc(c.label)}</h2><ul>${itemLinks(c.id)}</ul>`).join('')}`,
  },
  {
    path: '/rates',
    title: 'Gold rate, petrol, diesel, LPG, rubber and pepper price today in Kerala | Sahi Daam',
    description: 'Today\'s 22K and 24K gold rate per gram and per pavan, silver, petrol, diesel and LPG cylinder prices for every Kerala district, and farm prices: rubber RSS-4, pepper, cardamom, coconut, copra and more. Updated through the day.',
    body: `<h1>Today's rates in Kerala</h1>
      <p>Gold (22 carat and 24 carat, per gram and per pavan), silver, petrol, diesel and the LPG cylinder price for your district, checked every 15 minutes to every hour.</p>
      <h2>Farm prices</h2>
      <p>Rubber RSS-4, RSS-5, ISNR-20 and latex from the Rubber Board, Kottayam. Pepper, small cardamom, nutmeg, mace and clove from the Spices Board, Kochi. Coconut, copra, arecanut, coffee, cocoa, cashew, paddy and tapioca from Agmarknet.</p>`,
  },
  {
    path: '/pulse',
    title: 'Kerala vegetable prices by district this week | Sahi Daam',
    description: 'Compare vegetable prices across all 14 Kerala districts: which district is cheapest for tomato, onion, shallots and potato this week, rising and falling prices, and the weekly kitchen basket.',
    body: `<h1>Prices across Kerala this week</h1><p>Which of the 14 districts (${esc(districts)}) is cheapest for tomato, onion, shallots and potato, which prices are rising or falling, and what a weekly kitchen basket costs.</p>`,
  },
  {
    path: '/auto',
    title: 'Kerala auto fare calculator: meter fare from your location | Sahi Daam',
    description: 'Work out the Kerala auto rickshaw meter fare for any trip: start from your location, search any place in Kerala, and get the fare on the real road distance, with night charges and a big screen to show the driver.',
    body: `<h1>Kerala auto fare calculator</h1><p>The meter fare for any trip in Kerala on the real road distance: ₹30 minimum for the first 1.5 km, then ₹1.50 for every 100 m (₹15 a km), and 50% extra on top of the meter from 10 pm to 5 am. Start from your location or search any place.</p>`,
  },
  ...ITEMS.map(i => ({
    path: `/item/${i.id}`,
    title: `${i.name} price today in Kerala (${i.ml}): fair price by district | Sahi Daam`,
    description: `Is it a fair price? Today's fair price for ${i.name.toLowerCase()} (${i.ml}) in all 14 Kerala districts, ${LIVE_CATS.has(i.cat) ? 'from live VFPCK and Agmarknet market prices' : 'from what people actually paid'}. Check a quote before you pay. Free, no sign-up.`,
    body: `<h1>${esc(i.name)} price today in Kerala <span lang="ml">${esc(i.ml)}</span></h1>
      <p>The fair price of ${esc(i.name.toLowerCase())} in every Kerala district: ${esc(districts)}. ${LIVE_CATS.has(i.cat)
        ? 'Prices come live from VFPCK district markets and Agmarknet mandis, updated daily, and from what people pay.'
        : 'Prices come from what people in Kerala actually paid.'} Type the price you're quoted to see whether it's fair.</p>
      <p><a href="/">All prices</a> · <a href="/rates">Today's gold, fuel and farm rates</a></p>`,
  })),
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Sahi Daam',
  url: `${SITE}/`,
  description: ROUTES[0].description,
  applicationCategory: 'ShoppingApplication',
  operatingSystem: 'Any',
  inLanguage: ['en', 'ml'],
  areaServed: { '@type': 'State', name: 'Kerala', containedInPlace: { '@type': 'Country', name: 'India' } },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
};

for (const r of ROUTES) {
  const url = `${SITE}${r.path === '/' ? '/' : r.path}`;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(r.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(r.description)}"`)
    .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${esc(r.title)}"`)
    .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${esc(r.description)}"`)
    .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`)
    .replace('</head>', `    <link rel="canonical" href="${url}" />\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><main class="page seo">${r.body}</main></div>`);
  const dir = r.path === '/' ? dist : new URL(`.${r.path}/`, dist);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('index.html', dir), html);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(new URL('sitemap.xml', dist), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map(r => `  <url><loc>${SITE}${r.path}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>${r.path === '/' ? '1.0' : r.path.startsWith('/item/') ? '0.7' : '0.9'}</priority></url>`).join('\n')}
</urlset>
`);
writeFileSync(new URL('robots.txt', dist), `User-agent: *\nAllow: /\nDisallow: /me\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`seo: ${ROUTES.length} pages, sitemap.xml, robots.txt`);
