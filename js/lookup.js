// Looking a food up outside the app. These are the only calls the app makes to anyone but its
// own database, and only when a lookup button is tapped. What is sent is the search words or the
// barcode, never anything about you.
//
// A food that comes back is turned into the app's own shape, per 100 g. A number the source does
// not give stays null: it is shown as unknown and never guessed.

const round1 = (n) => Math.round(n * 10) / 10;
const known = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
// Sugar, saturated fat and salt are kept when the source has them. They are shown, not counted.
const extras = (e) => {
  const out = Object.fromEntries(Object.entries(e).filter(([, v]) => v != null));
  return Object.keys(out).length ? { extra: out } : {};
};

// ----- USDA FoodData Central -----

// Nutrient ids in a search result. Newer entries give energy under 2048 or 2047 instead of 1008.
const USDA = { kcal: [1008, 2048, 2047], protein: [1003], carbs: [1005], fat: [1004], fibre: [1079], sugar: [2000], satFat: [1258], sodiumMg: [1093] };

// One search result as a food, or null if it has no calories (it could not be logged).
export function fromUsda(item, today) {
  const get = (ids) => {
    for (const id of ids) {
      const v = known(item.foodNutrients?.find((n) => n.nutrientId === id)?.value);
      if (v !== null) return v;
    }
    return null;
  };
  const kcal = get(USDA.kcal);
  if (!item?.fdcId || !item.description || kcal === null) return null;
  const sodium = get(USDA.sodiumMg);
  const r = (v) => (v === null ? null : round1(v));
  return {
    id: `usda-${item.fdcId}`, name: String(item.description).slice(0, 80), serving: '100 g',
    byGrams: true, grams: 100, amount: 100,
    kcal: Math.round(kcal), protein: r(get(USDA.protein)), carbs: r(get(USDA.carbs)), fat: r(get(USDA.fat)), fibre: r(get(USDA.fibre)),
    source: 'usda', sourceId: String(item.fdcId), fetched: today,
    ...extras({ sugar: r(get(USDA.sugar)), satFat: r(get(USDA.satFat)), salt: sodium === null ? null : Math.round(sodium * 2.5) / 1000 }),
  };
}

// Plain foods only (the lab-measured sets), not the branded American products.
// Throws an Error whose message is a sentence that can be shown.
export async function searchUsda(query, key, today) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy&pageSize=15`;
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('No connection. A lookup needs the internet.');
  }
  if (res.status === 403) throw new Error('USDA did not accept the key. Check it in Settings.');
  if (res.status === 429) throw new Error('Too many lookups for now. Try again in an hour.');
  if (!res.ok) throw new Error('USDA did not answer. Try again in a minute.');
  const data = await res.json();
  return (data.foods ?? []).map((f) => fromUsda(f, today)).filter(Boolean);
}

// ----- Open Food Facts: packaged foods by barcode -----
// A free, volunteer-run list. No key. Entries can be missing or wrong, so check the label.

export const isBarcode = (code) => /^\d{8,14}$/.test(code);

// A product as a food per 100 g. kcal is null when the entry has no energy figure:
// the caller then asks for the numbers from the label instead.
export function fromOff(product, code, today) {
  const n = product?.nutriments ?? {};
  const r = (v) => (known(v) === null ? null : round1(v));
  const kj = known(n['energy_100g']);
  const kcal = known(n['energy-kcal_100g']) ?? (kj === null ? null : kj / 4.184);
  const brand = String(product?.brands ?? '').split(',')[0].trim();
  const name = String(product?.product_name ?? '').trim();
  const serving = known(Number(product?.serving_quantity));
  return {
    id: `off-${code}`, barcode: code, name: (name ? `${name}${brand && !name.includes(brand) ? ` (${brand})` : ''}` : `Product ${code}`).slice(0, 80),
    serving: /\d\s*(ml|cl|l)\b/i.test(String(product?.quantity ?? '')) ? '100 ml' : '100 g',
    byGrams: true, grams: 100, amount: serving && serving <= 1000 ? serving : 100,
    kcal: kcal === null ? null : Math.round(kcal), protein: r(n.proteins_100g), carbs: r(n.carbohydrates_100g), fat: r(n.fat_100g), fibre: r(n.fiber_100g),
    source: 'off', sourceId: code, fetched: today,
    ...extras({ sugar: r(n.sugars_100g), satFat: r(n['saturated-fat_100g']), salt: known(n.salt_100g) === null ? null : Math.round(n.salt_100g * 100) / 100 }),
  };
}

// Returns the food, or null when Open Food Facts does not have the barcode.
// Throws an Error whose message is a sentence that can be shown.
export async function findBarcode(code, today) {
  let res;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,brands,quantity,serving_quantity,nutriments`);
  } catch {
    throw new Error('No connection. A lookup needs the internet.');
  }
  if (res.status === 404) return null;
  if (res.status === 429) throw new Error('Too many lookups for now. Try again in a minute.');
  if (!res.ok) throw new Error('Open Food Facts did not answer. Try again in a minute.');
  const data = await res.json();
  return data.status === 1 && data.product ? fromOff(data.product, code, today) : null;
}

// ----- Reading a nutrition label from a photo -----
// The photo goes to Google's Gemini service, with a key kept in your private data. What comes
// back only fills in the form: nothing is saved until the numbers have been checked and Save tapped.

const NUM = { type: 'NUMBER', nullable: true };
const LABEL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', nullable: true }, per: NUM, energyKcal: NUM, energyKj: NUM, fat: NUM, satFat: NUM,
    carbs: NUM, sugar: NUM, fibre: NUM, protein: NUM, salt: NUM, sodiumMg: NUM,
  },
};
const LABEL_PROMPT = `This is a photo of the nutrition table on a food pack. Read it and return the numbers.
Rules:
- Use the "per 100 g" or "per 100 ml" column when there is one, and set "per" to 100.
- If the table only has a per serving column, use that and set "per" to the serving weight in grams.
- Copy each number exactly as printed. Do not estimate, convert or calculate anything.
- Use null for anything that is not printed or that you cannot read with confidence.
- energyKcal is the energy in kcal (also printed as Cal or Calories). energyKj is the energy in kJ.
- salt is in grams. sodiumMg is sodium in milligrams. Fill only the one that is printed.
- name is the product name if it can be seen in the photo, otherwise null.
- The table may be in Arabic, English or both.`;

// What the reader returned, as values for the form. Anything that is not a sane number is dropped.
export function fromLabel(raw) {
  const n = (v, max) => (known(v) !== null && v <= max ? v : null);
  const per = n(raw?.per, 2000) || 100;
  const kcal = n(raw?.energyKcal, 10000);
  const kj = n(raw?.energyKj, 42000);
  const sodium = n(raw?.sodiumMg, 100000);
  const out = {
    name: typeof raw?.name === 'string' ? raw.name.trim().slice(0, 80) : '',
    per, energy: kcal ?? kj, energyUnit: kcal === null && kj !== null ? 'kj' : 'kcal',
    fat: n(raw?.fat, per), satFat: n(raw?.satFat, per), carbs: n(raw?.carbs, per), sugar: n(raw?.sugar, per),
    fibre: n(raw?.fibre, per), protein: n(raw?.protein, per),
    salt: n(raw?.salt, per) ?? (sodium === null ? null : Math.round(sodium * 2.5) / 1000),
  };
  out.found = ['energy', 'fat', 'carbs', 'protein'].filter((k) => out[k] !== null).length;
  return out;
}

let model = 'gemini-flash-latest'; // swapped for a listed one if Google stops using this name
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

// base64: the photo as JPEG. Throws an Error whose message is a sentence that can be shown.
export async function readLabel(base64, key) {
  const body = JSON.stringify({
    contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: base64 } }, { text: LABEL_PROMPT }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: LABEL_SCHEMA },
  });
  const call = () => fetch(`${GEMINI}/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body });
  let res;
  try {
    res = await call();
    if (res.status === 404) {
      // The model name has been retired. Ask which ones this key can use and take a fast one.
      const list = await (await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })).json();
      const pick = (list.models ?? []).map((m) => m.name.replace('models/', ''))
        .filter((m, i) => m.includes('flash') && !/image|tts|audio|live|embed/.test(m) && list.models[i].supportedGenerationMethods?.includes('generateContent'));
      if (!pick.length) throw new Error('none');
      model = pick.find((m) => m.endsWith('-latest')) ?? pick.at(-1);
      res = await call();
    }
  } catch {
    throw new Error('No connection. Reading a label needs the internet.');
  }
  if (res.status === 400 || res.status === 403) throw new Error('Google did not accept the key. Check it in Settings.');
  if (res.status === 429) throw new Error('The free limit is used up for now. Type the numbers this time, or try again later.');
  if (!res.ok) throw new Error('The label reader did not answer. Type the numbers this time, or try again.');
  try {
    const data = await res.json();
    return fromLabel(JSON.parse(data.candidates[0].content.parts.map((p) => p.text ?? '').join('')));
  } catch {
    throw new Error('The label could not be read from that photo. Try again closer, flatter and in better light.');
  }
}
