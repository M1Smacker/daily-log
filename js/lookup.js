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
