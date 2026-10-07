# Sahi Daam: launch kit (Kerala)

Everything here is in `marketing/`. The images are rendered from the HTML in `marketing/src/`, using the app screenshots in `marketing/screens/`. To change an image, edit its HTML and screenshot it again at the size given in the file.

| File | Size | Use it for |
|---|---|---|
| `post-1600x900.png` | 1600×900 | Main image for X and Reddit posts |
| `post-square-1080.png` | 1080×1080 | Instagram, WhatsApp status, square Reddit thumbnails |
| `twitter-header-1500x500.png` | 1500×500 | X profile header (the text avoids the profile-photo corner) |
| `logo-1024.png`, `logo.svg` | 1024² | Profile picture |
| `logo-wordmark-light.png`, `logo-wordmark-dark.png` | 1600×600 | The logo with the name |
| `screens/1-home.png` … `7-dark-tomato.png` | 1170×2532 | Phone screenshots: home, tomato check, today's rates, auto, pulse (light), rates and tomato (dark) |
| `../public/og.png` | 1200×630 | The preview card that appears when the link is shared (set up in `index.html`) |

**Before you post:**
- Check the auto meter rate with a driver or the RTO. The app uses Kerala's May 2022 rate (₹30 for the first 1.5 km, then ₹15/km, 50% extra at night), and I couldn't find a newer notification.
- Open the link on your phone, pick your district, and add one real price, so the first visitors see that it works.

---

## X (Twitter): a 4-post thread

Attach `post-1600x900.png` to the first post. Each post is under 280 characters.

**1/**
> Ever wondered if you're paying too much for vegetables, an auto, or even gold in Kerala?
>
> I built Sahi Daam: type the price you're quoted and it tells you if it's fair, using live market prices for all 14 districts.
>
> Free, no sign-up.
> sahi-daam-lime.vercel.app

**2/** (attach `screens/2-tomato-check.png`)
> Vegetable prices come in every day from VFPCK's district markets (Kerala's Vegetable & Fruit Promotion Council) and Agmarknet.
>
> Tomato is ₹45/kg in Thrissur today, so if someone asks ₹70 it says Overpriced (56% above usual) and what to offer.

**3/** (attach `screens/3-rates.png`)
> The Rates tab: today's 22K gold per gram and per pavan, silver, and your district's petrol, diesel and LPG cylinder, with what changed since yesterday.

**4/** (attach `screens/4-auto.png`)
> Auto fares: start from where you are, search any place in Kerala, and it works out the meter fare on the real road distance. There's a big-text "Show the driver" screen in Malayalam too.
>
> Add what you paid after you shop. It's anonymous and helps the next person.

**A single post, if you'd rather not do a thread** (attach `post-1600x900.png`):
> Paying too much in Kerala? Sahi Daam tells you if a price is fair before you pay: live vegetable prices for all 14 districts, today's gold, petrol and gas rates, and auto meter fares. Free, no sign-up 👇
> sahi-daam-lime.vercel.app

**Optional Malayalam line** (have a native speaker check it first):
> വാങ്ങുന്നതിന് മുൻപ് ശരിയായ വില അറിയൂ. (Know the right price before you buy.)

---

## Reddit

Post from your own account and say you built it. Most Kerala subreddits allow that, but check each one's rules and flair first. Don't post the same text to several subreddits on the same day, or Reddit's spam filter may hide it. Start with r/Kerala, then a district subreddit (r/Kochi, r/Thrissur, r/Trivandrum, r/Kozhikode) a few days later.

### r/Kerala

**Title:** I made a free app to check if you're being overcharged anywhere in Kerala: vegetables, auto fares, gold and fuel

**Body:**
> I kept wondering whether I was paying too much at the vegetable shop and for autos, so I built **Sahi Daam** ("the right price"): **sahi-daam-lime.vercel.app**
>
> **What it does**
> - Pick your district, or let it find it. Search an item (English, Malayalam or Manglish: *thakkali*, *mathi*) and see the fair price range. Type what the shop is asking and it tells you *Good deal*, *Fair*, *A bit high* or *Overpriced*, and what to offer.
> - Vegetable prices update every day from VFPCK's district markets (Alappuzha, Kottayam, Ernakulam, Thrissur, Palakkad, Manjeri, Thalassery), and Agmarknet mandi prices for the other districts.
> - **Rates tab:** today's gold (22K per gram and per pavan), silver, and your district's petrol, diesel and gas cylinder price.
> - **Auto fare:** start from your location, search any place, and see the Kerala meter fare on the real road distance, with a big "Show the driver" screen.
> - It shows which districts are cheaper this week. Tomato ranges from ₹38 in Manjeri to ₹56 in Alappuzha right now.
>
> **Honest limitations**
> - Fish, meat, eggs, milk and services (haircut, meals, ironing) have no public price source, so they show **sample** data, clearly marked, until people add real prices. That's where your help matters most.
> - Districts without a VFPCK market use Agmarknet estimates or the Kerala average, and the app says so.
> - It's new, so there are only a few real reports so far.
>
> **Privacy:** no sign-up, no name, no phone number. Prices you add are shared with only the district. Your location stays on your phone.
>
> If you buy something this week, adding what you paid takes about five seconds and helps the next person. Feedback and item requests are welcome. What should I add next?

### District subreddits (r/Kochi, r/Thrissur, r/Trivandrum, …), shorter

**Title:** Free app to check fair prices in [district] before you pay: veg, auto fares, gold and fuel

**Body:**
> Built a small app, **Sahi Daam**: sahi-daam-lime.vercel.app
>
> Type the price you're quoted and it tells you if it's fair. Vegetable prices come in daily from VFPCK and Agmarknet for [district], the Rates tab has today's gold, petrol and gas rates, and auto fares use the Kerala meter rate on the real road distance. No sign-up.
>
> Fish and meat are still sample data, so if you add what you paid at the market, it becomes real for everyone here.

### r/developersIndia or r/SideProject (the technical angle, good for a portfolio)

**Title:** Built a crowd-sourced fair-price app for Kerala: live government price feeds for 14 districts, robust outlier filtering, anonymous auth with RLS

**Body:**
> **Sahi Daam** tells you whether a quoted price is fair, anywhere in Kerala: sahi-daam-lime.vercel.app
>
> **Stack:** React 19 + Vite PWA, Supabase (Postgres, anonymous auth, Edge Functions, pg_cron), Vercel.
>
> **Interesting bits**
> - **Live data:** an Edge Function pulls VFPCK's daily retail lists for 7 district markets, Agmarknet 2.0 mandi prices for all 14 districts, and fuel, gold, silver and LPG rates, twice a day. Agmarknet's Ernakulam figures sat 0.7–1.4× VFPCK's retail prices, so VFPCK is the primary source, and districts are only ever compared within one source.
> - **Fair range:** MAD-based modified z-score (|z| > 3.5) to drop tourist prices and typos, then P25–P75. The same maths exists in JS (offline) and SQL, and a script checks they agree on 579 pools.
> - **Abuse resistance without accounts:** anonymous sign-in, row-level security, 30 reports a day per account, a 10-minute delay before a new account's prices count, and server-set timestamps. Reads go through security-definer functions that never return user ids.
> - **Scale:** incremental sync (only rows visible since your last fetch), keyset pagination, and an IndexedDB cache. Load test with 60k reports: return visits take about 25 ms at p95 with 1,000 users in 20 s, and there were no errors.
>
> Happy to answer questions. Code review and feedback welcome.

---

## Alt text for the images

- **post-1600x900.png:** "Sahi Daam: Is it the right price? Three phone screens show the home screen for Thrissur, tomato's fair price at Thrissur market (₹41–52 a kilo) with ₹70 marked as overpriced, and today's rates with 22K gold at ₹13,710 a gram."
- **post-square-1080.png:** "Sahi Daam: Is it the right price? Phone screens show tomato's fair price in Thrissur with ₹70 marked overpriced, and today's gold, petrol and diesel rates."
- **twitter-header-1500x500.png:** "Sahi Daam: Is it the right price? Check before you pay, anywhere in Kerala."
