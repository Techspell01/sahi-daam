// Farm prices for Kerala's growers, shown on the Rates tab. All are rupees per
// kg, fetched by the refresh-prices Edge Function (FARM_KINDS in its sources.ts
// must match these kinds; there's a test).
export const FARM_SOURCES = {
  rubberboard: 'Rubber Board, Kottayam',
  spicesboard: 'Spices Board, Kochi',
  agmarknet: 'Agmarknet, Kerala mandis',
};

const crop = (kind, name, ml, source, note = '') => ({ kind, name, ml, source, note });

export const FARM_GROUPS = [
  ['Rubber', [
    crop('rubber_rss4', 'RSS-4', 'റബ്ബർ', 'rubberboard'),
    crop('rubber_rss5', 'RSS-5', '', 'rubberboard'),
    crop('rubber_isnr20', 'ISNR-20', '', 'rubberboard'),
    crop('rubber_latex', 'Latex (60%)', 'ലാറ്റക്സ്', 'rubberboard'),
  ]],
  ['Spices', [
    crop('pepper', 'Pepper', 'കുരുമുളക്', 'spicesboard', 'ungarbled'),
    crop('pepper_garbled', 'Pepper', '', 'spicesboard', 'garbled'),
    crop('cardamom', 'Small cardamom', 'ഏലം', 'spicesboard', 'e-auction average'),
    crop('nutmeg', 'Nutmeg', 'ജാതിക്ക', 'spicesboard', 'without shell'),
    crop('mace', 'Mace', 'ജാതിപത്രി', 'spicesboard', 'red'),
    crop('clove', 'Clove', 'ഗ്രാമ്പൂ', 'spicesboard'),
  ]],
  ['Coconut, coffee and others', [
    crop('coconut', 'Coconut', 'തേങ്ങ', 'agmarknet', 'by weight'),
    crop('copra', 'Copra', 'കൊപ്ര', 'agmarknet'),
    crop('arecanut', 'Arecanut', 'അടയ്ക്ക', 'agmarknet'),
    crop('coffee', 'Coffee', 'കാപ്പി', 'agmarknet'),
    crop('cocoa', 'Cocoa', 'കൊക്കോ', 'agmarknet'),
    crop('cashew', 'Cashew nuts', 'കശുവണ്ടി', 'agmarknet', 'raw'),
    crop('paddy', 'Paddy', 'നെല്ല്', 'agmarknet'),
    crop('tapioca', 'Tapioca', 'കപ്പ', 'agmarknet'),
  ]],
];

export const FARM = FARM_GROUPS.flatMap(([, crops]) => crops);
