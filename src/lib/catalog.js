// What Sahi Daam knows about: items people buy, the Kerala districts prices are
// grouped by, and Kochi landmarks for auto fares (elsewhere, places come from
// map search).
//
// `base` is only used to generate the demo data (see demo.js): a believable
// retail price per unit, not an official or verified price.
// `vol` is daily price volatility, `trend` the drift over 30 days, `pop` how many
// reports a day one area gets.

export const STATE = { id: 'kerala', name: 'Kerala', ml: 'കേരളം' };

export const CATEGORIES = [
  { id: 'veg', label: 'Vegetables' },
  { id: 'fruit', label: 'Fruits' },
  { id: 'fish', label: 'Fish & meat' },
  { id: 'grocery', label: 'Groceries' },
  { id: 'service', label: 'Food & services' },
];

// Each unit family lists the quantities people usually buy in; `f` converts that
// quantity to the base unit, so every report is stored as a price per base unit.
export const UNITS = {
  kg: { per: 'kg', qty: [['250g', '250 g', 0.25], ['500g', '500 g', 0.5], ['1kg', '1 kg', 1], ['2kg', '2 kg', 2]], def: '1kg' },
  piece: { per: 'piece', qty: [['1', '1 pc', 1], ['2', '2 pcs', 2], ['3', '3 pcs', 3], ['5', '5 pcs', 5], ['10', '10 pcs', 10]], def: '1' },
  dozen: { per: 'dozen', qty: [['6', '6 eggs', 0.5], ['12', '12 eggs', 1], ['30', '30 eggs', 2.5]], def: '12' },
  litre: { per: 'litre', qty: [['500ml', '500 ml', 0.5], ['1l', '1 L', 1], ['2l', '2 L', 2]], def: '1l' },
  cup: { per: 'cup', qty: [['1', '1 cup', 1], ['2', '2 cups', 2], ['3', '3 cups', 3]], def: '1' },
  plate: { per: 'plate', qty: [['1', '1 plate', 1], ['2', '2 plates', 2]], def: '1' },
  visit: { per: 'visit', qty: [['1', '1 visit', 1]], def: '1' },
  job: { per: 'job', qty: [['1', '1 job', 1]], def: '1' },
};

const item = (id, cat, unit, name, ml, hi, aka, base, vol, trend, pop) =>
  ({ id, cat, unit, name, ml, hi, aka, base, vol, trend, pop });

export const ITEMS = [
  item('tomato', 'veg', 'kg', 'Tomato', 'തക്കാളി', 'टमाटर', ['thakkali', 'tamatar'], 38, 0.025, 0.45, 1.4),
  item('onion', 'veg', 'kg', 'Onion', 'സവാള', 'प्याज', ['savala', 'pyaz', 'big onion'], 44, 0.012, -0.05, 1.4),
  item('shallots', 'veg', 'kg', 'Shallots', 'ചുവന്നുള്ളി', 'छोटा प्याज', ['chuvannulli', 'small onion', 'ulli'], 72, 0.02, -0.18, 1.1),
  item('potato', 'veg', 'kg', 'Potato', 'ഉരുളക്കിഴങ്ങ്', 'आलू', ['urulakizhangu', 'aloo'], 38, 0.008, 0, 1.2),
  item('carrot', 'veg', 'kg', 'Carrot', 'കാരറ്റ്', 'गाजर', ['gajar'], 62, 0.015, 0.06, 0.9),
  item('beans', 'veg', 'kg', 'Beans', 'ബീൻസ്', 'बीन्स', [], 74, 0.02, 0.12, 0.8),
  item('cabbage', 'veg', 'kg', 'Cabbage', 'കാബേജ്', 'पत्ता गोभी', ['patta gobhi'], 34, 0.012, -0.04, 0.8),
  item('okra', 'veg', 'kg', 'Okra', 'വെണ്ടയ്ക്ക', 'भिंडी', ['vendakka', 'ladies finger', 'bhindi'], 52, 0.018, 0, 0.8),
  item('brinjal', 'veg', 'kg', 'Brinjal', 'വഴുതനങ്ങ', 'बैंगन', ['vazhuthananga', 'eggplant', 'baingan'], 48, 0.015, -0.03, 0.7),
  item('green-chilli', 'veg', 'kg', 'Green chilli', 'പച്ചമുളക്', 'हरी मिर्च', ['pachamulaku', 'mulaku', 'hari mirch'], 84, 0.03, 0.15, 1),
  item('ginger', 'veg', 'kg', 'Ginger', 'ഇഞ്ചി', 'अदरक', ['inchi', 'adrak'], 130, 0.015, 0.04, 0.8),
  item('garlic', 'veg', 'kg', 'Garlic', 'വെളുത്തുള്ളി', 'लहसुन', ['veluthulli', 'lehsun'], 210, 0.012, -0.08, 0.7),
  item('drumstick', 'veg', 'kg', 'Drumstick', 'മുരിങ്ങക്കായ', 'सहजन', ['muringakkaya', 'moringa'], 95, 0.03, 0.2, 0.6),
  item('beetroot', 'veg', 'kg', 'Beetroot', 'ബീറ്റ്റൂട്ട്', 'चुकंदर', ['beet'], 50, 0.012, 0, 0.6),
  item('cucumber', 'veg', 'kg', 'Cucumber', 'വെള്ളരിക്ക', 'खीरा', ['vellarikka', 'kheera'], 42, 0.015, 0, 0.6),
  item('bitter-gourd', 'veg', 'kg', 'Bitter gourd', 'പാവയ്ക്ക', 'करेला', ['pavakka', 'karela'], 62, 0.015, 0.03, 0.6),
  item('pumpkin', 'veg', 'kg', 'Pumpkin', 'മത്തങ്ങ', 'कद्दू', ['mathanga', 'kaddu'], 32, 0.012, -0.02, 0.5),
  item('raw-banana', 'veg', 'kg', 'Raw banana', 'ഏത്തക്കായ', 'कच्चा केला', ['ethakkaya', 'kaya', 'plantain'], 56, 0.015, 0.05, 0.8),
  item('coconut', 'veg', 'piece', 'Coconut', 'തേങ്ങ', 'नारियल', ['thenga', 'nariyal'], 48, 0.01, 0.08, 1.2),

  item('nendran', 'fruit', 'kg', 'Nendran banana', 'ഏത്തപ്പഴം', 'नेंद्रन केला', ['ethappazham', 'banana', 'pazham', 'kela'], 72, 0.015, 0.05, 1),
  item('apple', 'fruit', 'kg', 'Apple', 'ആപ്പിൾ', 'सेब', ['seb'], 190, 0.01, 0.03, 0.7),
  item('orange', 'fruit', 'kg', 'Orange', 'ഓറഞ്ച്', 'संतरा', ['santra'], 110, 0.012, -0.06, 0.6),
  item('pomegranate', 'fruit', 'kg', 'Pomegranate', 'മാതളനാരങ്ങ', 'अनार', ['mathalam', 'anar'], 185, 0.012, 0, 0.5),
  item('grapes', 'fruit', 'kg', 'Grapes', 'മുന്തിരി', 'अंगूर', ['munthiri', 'angoor'], 105, 0.018, 0.08, 0.5),
  item('papaya', 'fruit', 'kg', 'Papaya', 'പപ്പായ', 'पपीता', ['kappalanga', 'papita'], 42, 0.012, 0, 0.5),
  item('pineapple', 'fruit', 'kg', 'Pineapple', 'കൈതച്ചക്ക', 'अनानास', ['kaithachakka', 'ananas'], 58, 0.015, -0.1, 0.6),

  item('mathi', 'fish', 'kg', 'Sardine', 'മത്തി', 'सार्डिन', ['mathi', 'chaala', 'fish'], 210, 0.045, -0.2, 1.2),
  item('ayala', 'fish', 'kg', 'Mackerel', 'അയല', 'बांगड़ा', ['ayala', 'bangda', 'fish'], 270, 0.04, 0.1, 0.9),
  item('chicken', 'fish', 'kg', 'Chicken', 'ചിക്കൻ', 'चिकन', ['kozhi', 'murgi', 'broiler'], 185, 0.02, 0.06, 1.1),
  item('eggs', 'fish', 'dozen', 'Eggs', 'മുട്ട', 'अंडे', ['mutta', 'egg', 'ande'], 84, 0.008, 0.05, 1),

  item('milk', 'grocery', 'litre', 'Milk', 'പാൽ', 'दूध', ['paal', 'doodh'], 56, 0.002, 0, 1),
  item('matta-rice', 'grocery', 'kg', 'Matta rice', 'മട്ട അരി', 'मट्टा चावल', ['ari', 'rice', 'chawal'], 62, 0.004, 0.02, 0.8),
  item('coconut-oil', 'grocery', 'litre', 'Coconut oil', 'വെളിച്ചെണ്ണ', 'नारियल तेल', ['velichenna', 'oil'], 420, 0.01, 0.04, 0.6),

  item('tea', 'service', 'cup', 'Tea', 'ചായ', 'चाय', ['chaya', 'chai'], 12, 0, 0, 1),
  item('meals', 'service', 'plate', 'Meals (lunch)', 'ഊണ്', 'थाली', ['oonu', 'thali', 'lunch'], 90, 0, 0, 0.7),
  item('haircut', 'service', 'visit', "Men's haircut", 'മുടിവെട്ട്', 'बाल कटाई', ['mudivettu', 'salon', 'barber'], 160, 0, 0, 0.5),
  item('ironing', 'service', 'piece', 'Ironing', 'ഇസ്തിരി', 'इस्त्री', ['isthiri', 'press', 'laundry'], 14, 0, 0, 0.6),
  item('puncture', 'service', 'job', 'Bike puncture fix', 'പഞ്ചർ', 'पंक्चर', ['puncture', 'tyre'], 120, 0, 0, 0.4),
];

export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// Areas are Kerala's 14 districts. `lat`/`lng` is roughly the district's
// middle, used to find your district from GPS; `town` is its main town, where
// auto trips start by default; `market` is its VFPCK market, if it has one
// (prices fetched by supabase/functions/refresh-prices). `factor` only shapes sample data.
const district = (id, name, ml, lat, lng, town, factor, market = null) => ({ id, name, ml, lat, lng, town, factor, market });
export const AREAS = [
  district('thiruvananthapuram', 'Thiruvananthapuram', 'തിരുവനന്തപുരം', 8.6, 77.0, { name: 'Thampanoor', lat: 8.4875, lng: 76.9525 }, 1.04),
  district('kollam', 'Kollam', 'കൊല്ലം', 8.95, 76.8, { name: 'Kollam town', lat: 8.8853, lng: 76.5864 }, 1),
  district('pathanamthitta', 'Pathanamthitta', 'പത്തനംതിട്ട', 9.3, 76.95, { name: 'Pathanamthitta town', lat: 9.2648, lng: 76.787 }, 1.02),
  district('alappuzha', 'Alappuzha', 'ആലപ്പുഴ', 9.4, 76.42, { name: 'Alappuzha town', lat: 9.4981, lng: 76.3388 }, 0.98, 'Alappuzha'),
  district('kottayam', 'Kottayam', 'കോട്ടയം', 9.6, 76.62, { name: 'Kottayam town', lat: 9.5916, lng: 76.5222 }, 1.02, 'Kottayam'),
  district('idukki', 'Idukki', 'ഇടുക്കി', 9.9, 77.05, { name: 'Thodupuzha', lat: 9.8959, lng: 76.7184 }, 1.05),
  district('ernakulam', 'Ernakulam', 'എറണാകുളം', 10.02, 76.45, { name: 'Kakkanad', lat: 10.0159, lng: 76.3419 }, 1.06, 'Ernakulam'),
  district('thrissur', 'Thrissur', 'തൃശ്ശൂർ', 10.5, 76.25, { name: 'Thrissur Round', lat: 10.5276, lng: 76.2144 }, 1, 'Thrissur'),
  district('palakkad', 'Palakkad', 'പാലക്കാട്', 10.8, 76.6, { name: 'Palakkad town', lat: 10.7867, lng: 76.6548 }, 0.95, 'Palakkad'),
  district('malappuram', 'Malappuram', 'മലപ്പുറം', 11.05, 76.15, { name: 'Malappuram town', lat: 11.051, lng: 76.0711 }, 0.97, 'Manjeri'),
  district('kozhikode', 'Kozhikode', 'കോഴിക്കോട്', 11.4, 75.85, { name: 'Mananchira', lat: 11.2588, lng: 75.7804 }, 1),
  district('wayanad', 'Wayanad', 'വയനാട്', 11.7, 76.1, { name: 'Kalpetta', lat: 11.6085, lng: 76.083 }, 1.03),
  district('kannur', 'Kannur', 'കണ്ണൂർ', 12.0, 75.5, { name: 'Kannur town', lat: 11.8745, lng: 75.3704 }, 0.99, 'Thalassery'),
  district('kasaragod', 'Kasaragod', 'കാസർഗോഡ്', 12.4, 75.1, { name: 'Kasaragod town', lat: 12.4996, lng: 74.9869 }, 0.98),
];

// Older versions grouped Kochi by neighbourhood; all of those are in Ernakulam.
export const areaId = id => (AREA_IDS.has(id) ? id : 'ernakulam');

export const AREA = Object.fromEntries(AREAS.map(a => [a.id, a]));
const AREA_IDS = new Set(AREAS.map(a => a.id));

// Kochi landmarks for auto fares (approximate coordinates), shown to people in
// Ernakulam. Everywhere else, places come from map search.
export const PLACES = [
  { id: 'kakkanad', name: 'Kakkanad', ml: 'കാക്കനാട്', lat: 10.0159, lng: 76.3419 },
  { id: 'infopark', name: 'Infopark', ml: 'ഇൻഫോപാർക്ക്', lat: 10.0106, lng: 76.3651 },
  { id: 'edappally', name: 'Edappally', ml: 'ഇടപ്പള്ളി', lat: 10.0236, lng: 76.308 },
  { id: 'lulu', name: 'Lulu Mall', ml: 'ലുലു മാൾ', lat: 10.0271, lng: 76.308 },
  { id: 'palarivattom', name: 'Palarivattom', ml: 'പാലാരിവട്ടം', lat: 10.0047, lng: 76.3089 },
  { id: 'kaloor', name: 'Kaloor', ml: 'കലൂർ', lat: 9.9973, lng: 76.2996 },
  { id: 'ekm-north', name: 'Ernakulam North station', ml: 'എറണാകുളം നോർത്ത്', lat: 9.9911, lng: 76.288 },
  { id: 'ekm-south', name: 'Ernakulam South station', ml: 'എറണാകുളം സൗത്ത്', lat: 9.9686, lng: 76.2892 },
  { id: 'mg-road', name: 'MG Road', ml: 'എം.ജി. റോഡ്', lat: 9.9776, lng: 76.2826 },
  { id: 'marine-drive', name: 'Marine Drive', ml: 'മറൈൻ ഡ്രൈവ്', lat: 9.9817, lng: 76.2771 },
  { id: 'high-court', name: 'High Court', ml: 'ഹൈക്കോടതി', lat: 9.984, lng: 76.2747 },
  { id: 'kadavanthra', name: 'Kadavanthra', ml: 'കടവന്ത്ര', lat: 9.9667, lng: 76.2992 },
  { id: 'vyttila', name: 'Vyttila Hub', ml: 'വൈറ്റില ഹബ്', lat: 9.9675, lng: 76.3216 },
  { id: 'thrippunithura', name: 'Thrippunithura', ml: 'തൃപ്പൂണിത്തുറ', lat: 9.9466, lng: 76.3463 },
  { id: 'fort-kochi', name: 'Fort Kochi', ml: 'ഫോർട്ട് കൊച്ചി', lat: 9.9653, lng: 76.2422 },
  { id: 'kalamassery', name: 'Kalamassery', ml: 'കളമശ്ശേരി', lat: 10.0515, lng: 76.3151 },
  { id: 'amrita', name: 'Amrita Hospital', ml: 'അമൃത ആശുപത്രി', lat: 10.0329, lng: 76.2933 },
  { id: 'aluva', name: 'Aluva', ml: 'ആലുവ', lat: 10.1076, lng: 76.3516 },
  { id: 'airport', name: 'Cochin Airport', ml: 'വിമാനത്താവളം', lat: 10.152, lng: 76.3919 },
];

export const PLACE = Object.fromEntries(PLACES.map(p => [p.id, p]));

export const SHOPS = [
  { id: 'street', label: 'Street' },
  { id: 'shop', label: 'Shop' },
  { id: 'super', label: 'Supermarket' },
  { id: 'online', label: 'Online' },
];

// A small family's weekly kitchen basket, used for the price pulse index.
export const BASKET = [
  ['tomato', 1], ['onion', 1], ['shallots', 0.5], ['potato', 1], ['green-chilli', 0.25],
  ['coconut', 3], ['nendran', 1], ['eggs', 1], ['milk', 7], ['matta-rice', 3], ['mathi', 1],
];

export function unitOf(item) { return UNITS[item.unit]; }

// Search across English, Malayalam, Hindi and transliterations ("thakkali").
export function searchItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  for (const it of ITEMS) {
    const names = [it.name.toLowerCase(), it.ml, it.hi, ...it.aka];
    let score = 0;
    for (const n of names) {
      if (n === q) score = Math.max(score, 3);
      else if (n.startsWith(q)) score = Math.max(score, 2);
      else if (n.includes(q)) score = Math.max(score, 1);
    }
    if (score) hits.push([score, it]);
  }
  return hits.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).map(h => h[1]);
}
