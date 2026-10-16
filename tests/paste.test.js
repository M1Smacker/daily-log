import test from 'node:test';
import assert from 'node:assert/strict';
import { readNutrition, ASK_FORMAT } from '../js/paste.js';

const main = (r) => ({ kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, fibre: r.fibre });

test('paste: the exact block ChatGPT gives for logging', () => {
  const r = readNutrition(`Meal: Air-fried seasoned chicken with Kuwaiti khubus
Calories: 1100 kcal
Protein: 100 g
Carbohydrates: 100 g
Fat: 30 g
Fiber: 5 g
Edible serving weight: 625 g`);
  assert.equal(r.name, 'Air-fried seasoned chicken with Kuwaiti khubus');
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: 5 });
  assert.equal(r.grams, 625);
  assert.equal(r.per100, false);
  assert.equal(r.found, 5);
  assert.deepEqual(r.notes, []);
});

test('paste: the format the app asks ChatGPT for, filled in, reads back whole', () => {
  const filled = ASK_FORMAT.split('\n').slice(1, 8).map((l, i) => l.replace(/\(.*\)/, ['Chicken and rice', '850', '62', '90', '22', '6', '540'][i])).join('\n');
  const r = readNutrition(filled);
  assert.equal(r.name, 'Chicken and rice');
  assert.deepEqual(main(r), { kcal: 850, protein: 62, carbs: 90, fat: 22, fibre: 6 });
  assert.equal(r.grams, 540);
});

test('paste: markdown bold, bullets, tildes and "about"', () => {
  const r = readNutrition(`**Estimated nutrition (whole plate, ~625 g):**
- **Calories:** ~1,100 kcal
- **Protein:** about 100 g
- **Carbs:** approx. 100g
- **Fat:** ≈30 g
- **Fibre:** 5 g`);
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: 5 });
  assert.equal(r.grams, 625);
  assert.equal(r.name, null); // "Estimated nutrition" names nothing
});

test('paste: a whole chat reply with paragraphs around the numbers', () => {
  const r = readNutrition(`Sure! Here is a breakdown of your meal. I estimated the chicken at about 300 g cooked and two pieces of khubus.

Nutrition (copy for logging):
Calories: 1100 kcal
Protein: 100 g
Carbohydrates: 100 g
Fat: 30 g

Let me know if you want it per 100 g as well. Enjoy your meal!`);
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
});

test('paste: one line, numbers first, split by pipes', () => {
  const r = readNutrition('≈1,100 kcal | 100 g protein | 100 g carbs | 30 g fat | 5 g fibre');
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: 5 });
});

test('paste: one line, labels first, split by commas', () => {
  const r = readNutrition('Calories: 1100 kcal, Protein: 100 g, Carbs: 100 g, Fat: 30 g, Fiber: 5 g');
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: 5 });
});

test('paste: a markdown table with nutrients down the side', () => {
  const r = readNutrition(`| Nutrient | Amount |
|---|---|
| Calories | 1100 kcal |
| Protein | 100 g |
| Carbohydrates | 100 g |
| Fat | 30 g |
| Fiber | 5 g |`);
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: 5 });
});

test('paste: a table copied from the ChatGPT screen comes as tabs', () => {
  const r = readNutrition('Nutrient\tAmount\nCalories\t1100 kcal\nProtein\t100 g\nCarbs\t100 g\nFat\t30 g');
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
});

test('paste: a table with a per serving and a per 100 g column takes the serving one', () => {
  const r = readNutrition(`| Nutrient | Per serving (625 g) | Per 100 g |
|---|---|---|
| Energy | 1100 kcal | 176 kcal |
| Protein | 100 g | 16 g |
| Carbohydrate | 100 g | 16 g |
| Fat | 30 g | 4.8 g |`);
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
  assert.equal(r.grams, 625);
  assert.equal(r.per100, false);
});

test('paste: a table of several foods with a total row uses the total', () => {
  const r = readNutrition(`| Item | Calories | Protein | Carbs | Fat |
|---|---|---|---|---|
| Chicken (300 g) | 600 | 90 | 0 | 24 |
| Khubus (2 pieces) | 500 | 10 | 100 | 6 |
| **Total** | **1100** | **100** | **100** | **30** |`);
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
  assert.ok(r.notes.some((n) => /total row/.test(n)));
});

test('paste: a table of several foods with no total is added up, and says so', () => {
  const r = readNutrition(`| Food | Calories | Protein | Carbs | Fat |
|---|---|---|---|---|
| Chicken | 600 | 90 | 0 | 24 |
| Khubus | 500 | 10 | 100 | 6 |`);
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
  assert.deepEqual(r.parts, ['Chicken', 'Khubus']);
  assert.ok(r.notes.some((n) => /Added up from 2 parts/.test(n)));
});

test('paste: lines for parts of a meal are added up, weights too', () => {
  const r = readNutrition(`Chicken (300 g): 600 kcal, 90 g protein, 0 g carbs, 24 g fat
Khubus (325 g): 500 kcal, 10 g protein, 100 g carbs, 6 g fat`);
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
  assert.equal(r.grams, 625);
});

test('paste: blocks under headings for each part are added up', () => {
  const r = readNutrition(`Chicken:
- Calories: 600
- Protein: 90 g
Khubus:
- Calories: 500
- Protein: 10 g`);
  assert.equal(r.kcal, 1100);
  assert.equal(r.protein, 100);
  assert.equal(r.carbs, null);
});

test('paste: a part with no figure leaves the meal with none, never a partial sum', () => {
  const r = readNutrition(`Chicken: 600 kcal, 90 g protein, 24 g fat
Khubus: 500 kcal, 100 g carbs, 6 g fat`);
  assert.equal(r.kcal, 1100);
  assert.equal(r.fat, 30);
  assert.equal(r.protein, null); // khubus had no protein figure
  assert.equal(r.carbs, null);
  assert.ok(r.notes.some((n) => /Protein was missing for some parts/.test(n)));
});

test('paste: "Total:" in plain text wins over the parts', () => {
  const r = readNutrition(`Chicken: 600 kcal, 90 g protein
Khubus: 500 kcal, 10 g protein
Total: 1100 kcal, 100 g protein, 100 g carbs, 30 g fat`);
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
});

test('paste: "Total fat" is fat, not a total row', () => {
  const r = readNutrition('Calories: 500\nTotal fat: 20 g\nTotal carbohydrate: 50 g\nProtein: 30 g');
  assert.deepEqual(main(r), { kcal: 500, protein: 30, carbs: 50, fat: 20, fibre: null });
  assert.deepEqual(r.notes, []);
});

test('paste: per 100 g numbers are marked, never scaled by guesswork', () => {
  const r = readNutrition(`Nutrition per 100 g:
Calories: 176 kcal
Protein: 16 g
Carbs: 16 g
Fat: 4.8 g
Serving weight: 625 g`);
  assert.equal(r.per100, true);
  assert.deepEqual(main(r), { kcal: 176, protein: 16, carbs: 16, fat: 4.8, fibre: null });
  assert.equal(r.grams, 625);
});

test('paste: per 100 g said on each line', () => {
  const r = readNutrition('Calories: 176 kcal per 100 g\nProtein: 16 g per 100 g');
  assert.equal(r.per100, true);
  assert.equal(r.kcal, 176);
});

test('paste: per serving and per 100 g sections, the serving one is used', () => {
  const r = readNutrition(`Per serving (625 g):
Calories: 1100
Protein: 100 g
Per 100 g:
Calories: 176
Protein: 16 g`);
  assert.equal(r.per100, false);
  assert.equal(r.kcal, 1100);
  assert.equal(r.protein, 100);
  assert.equal(r.grams, 625);
  assert.ok(r.notes.some((n) => /per serving ones are used/.test(n)));
});

test('paste: a range is used at its middle and said out loud', () => {
  const r = readNutrition('Calories: 1000-1200 kcal\nProtein: 90 to 110 g\nFat: 25–35 g');
  assert.equal(r.kcal, 1100);
  assert.equal(r.protein, 100);
  assert.equal(r.fat, 30);
  assert.ok(r.notes.some((n) => /Calories was given as 1000 to 1200/.test(n)));
  assert.ok(r.notes.some((n) => /Fat was given as 25 to 35/.test(n)));
});

test('paste: "unknown" stays unknown, never zero', () => {
  const r = readNutrition('Calories: 1100\nProtein: 100 g\nFiber: unknown\nFat: N/A');
  assert.equal(r.fibre, null);
  assert.equal(r.fat, null);
  assert.equal(r.found, 2);
});

test('paste: kJ is turned into kcal, and kcal wins when both are given', () => {
  assert.equal(readNutrition('Energy: 4602 kJ').kcal, 1100);
  assert.ok(readNutrition('Energy: 4602 kJ').notes.some((n) => /kJ/.test(n)));
  assert.equal(readNutrition('Energy: 4602 kJ / 1100 kcal').kcal, 1100);
  assert.equal(readNutrition('Energy (kcal): 1100').kcal, 1100);
  assert.equal(readNutrition('Energy: 1100 kcal (4602 kJ)').kcal, 1100);
});

test('paste: US and UK spellings and label words', () => {
  const r = readNutrition('Energy: 500 kcal\nCarbohydrate: 60 g\nof which sugars: 12 g\nFat: 10 g\nof which saturates: 3 g\nFibre: 4 g\nProtein: 30 g\nSalt: 1.2 g');
  assert.deepEqual(main(r), { kcal: 500, protein: 30, carbs: 60, fat: 10, fibre: 4 });
  assert.deepEqual(r.extra, { sugar: 12, satFat: 3, salt: 1.2 });
});

test('paste: saturated fat is never read as fat', () => {
  const r = readNutrition('Calories: 500\nSaturated fat: 8 g\nProtein: 30 g');
  assert.equal(r.fat, null);
  assert.equal(r.extra.satFat, 8);
});

test('paste: sodium in mg becomes salt in g', () => {
  const r = readNutrition('Calories: 500\nSodium: 800 mg');
  assert.equal(r.extra.salt, 2);
  assert.ok(r.notes.some((n) => /sodium/.test(n)));
});

test('paste: net carbs only when that is all there is', () => {
  assert.equal(readNutrition('Calories: 500\nNet carbs: 40 g').carbs, 40);
  assert.equal(readNutrition('Calories: 500\nTotal carbs: 50 g\nNet carbs: 40 g').carbs, 50);
});

test('paste: "Protein: 400 kcal (100 g)" is grams of protein, not calories', () => {
  assert.equal(readNutrition('Calories: 1100\nProtein: 400 kcal (100 g)').protein, 100);
  assert.equal(readNutrition('Calories: 1100\nProtein: 400 kcal').protein, null);
});

test('paste: percentages are not grams', () => {
  const r = readNutrition('Calories: 1100\nProtein: 36%\nFat: 30 g (25%)');
  assert.equal(r.protein, null);
  assert.equal(r.fat, 30);
});

test('paste: the serving weight in other words and units', () => {
  assert.equal(readNutrition('Calories: 500\nServing size: 1 plate (450 g)').grams, 450);
  assert.equal(readNutrition('Calories: 500\nServing: 1 plate').grams, null); // a plate is not a weight
  assert.equal(readNutrition('Calories: 500\nWeight: 450').grams, 450);
  assert.equal(readNutrition('Calories: 500\nPortion: 12 oz').grams, 340.2);
  const drink = readNutrition('Drink: mango lassi\nCalories: 300\nServing: 330 ml');
  assert.equal(drink.grams, 330);
  assert.equal(drink.drink, true);
});

test('paste: a name with commas stays whole', () => {
  assert.equal(readNutrition('Meal: chicken, rice and salad\nCalories: 900').name, 'chicken, rice and salad');
});

test('paste: a heading on its own line names the meal when nothing else does', () => {
  assert.equal(readNutrition('Chicken shawarma plate\nCalories: 900\nProtein: 50 g').name, 'Chicken shawarma plate');
  assert.equal(readNutrition('Nutrition summary:\nCalories: 900').name, null);
});

test('paste: the same thing given twice with different numbers says which was used', () => {
  const r = readNutrition('Calories: 1100\nProtein: 100 g\nProtein: 16 g');
  assert.equal(r.protein, 100);
  assert.ok(r.notes.some((n) => /Protein was given more than once/.test(n)));
});

test('paste: the same thing given twice with the same number is no fuss', () => {
  const r = readNutrition('Calories: 1100\nProtein: 100 g\n\nSummary: 1100 kcal | 100 g protein');
  assert.equal(r.kcal, 1100);
  assert.equal(r.protein, 100);
});

test('paste: decimals with a dot or a comma, and big numbers with a thousands comma', () => {
  assert.equal(readNutrition('Fat: 4.8 g').fat, 4.8);
  assert.equal(readNutrition('Fat: 4,8 g').fat, 4.8);
  assert.equal(readNutrition('Calories: 1,100').kcal, 1100);
  assert.equal(readNutrition('Calories: 1 100').kcal, 1); // a space is not a thousands mark: the first number is used
});

test('paste: Arabic-Indic digits', () => {
  assert.equal(readNutrition('Calories: ١١٠٠\nProtein: ١٠٠ g').kcal, 1100);
});

test('paste: emoji in front of the labels', () => {
  const r = readNutrition('🔥 Calories: 1100 kcal\n💪 Protein: 100 g\n🍞 Carbs: 100 g\n🥑 Fat: 30 g');
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
});

test('paste: numbers inside words are not read', () => {
  const r = readNutrition('Vitamin B12: 2 mcg\nOmega-3: 1 g\nCalories: 500');
  assert.deepEqual(main(r), { kcal: 500, protein: null, carbs: null, fat: null, fibre: null });
});

test('paste: nothing usable gives an empty reading, not an error', () => {
  for (const junk of ['', '   ', 'hello there', '123', '|||', '\t\t', null, undefined, 'Calories:', 'Protein: lots']) {
    const r = readNutrition(junk);
    assert.equal(r.found, 0, String(junk));
    assert.equal(r.kcal, null);
  }
});

test('paste: random text never throws and never gives a negative or broken number', () => {
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
  const bits = ['Calories', 'Protein', 'Fat', 'Carbs', 'Fiber', ':', '|', '\t', '\n', ' ', '-', 'to', ',', '.', 'g', 'kcal', 'kJ', 'mg', '%',
    '100', '1,100', '4.8', '0', '(', ')', 'per 100 g', 'Total', '**', '~', 'unknown', 'Meal', 'Serving', 'ml', 'oz', '١٠', '🔥', '---'];
  for (let i = 0; i < 3000; i++) {
    const text = Array.from({ length: 1 + Math.floor(rand() * 40) }, () => bits[Math.floor(rand() * bits.length)]).join(rand() < 0.5 ? ' ' : '');
    const r = readNutrition(text);
    for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'grams']) {
      assert.ok(r[k] === null || (Number.isFinite(r[k]) && r[k] >= 0), `${k}=${r[k]} from ${JSON.stringify(text)}`);
    }
    assert.ok(Array.isArray(r.notes) && Array.isArray(r.parts));
    assert.equal(typeof r.per100, 'boolean');
  }
});

test('paste: a very long paste is read without hanging', () => {
  const started = Date.now();
  readNutrition('Calories: 100\n'.repeat(5000) + 'x'.repeat(50000));
  assert.ok(Date.now() - started < 2000);
});

test('paste: a summary that repeats only some numbers keeps the rest from the meal', () => {
  const r = readNutrition('Calories: 1100\nProtein: 100 g\nCarbs: 100 g\nFat: 30 g\n\nSummary: 1100 kcal | 100 g protein');
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
  assert.deepEqual(r.parts, []);
});

test('paste: labelled things split by pipes are a line, not a table', () => {
  const r = readNutrition('Calories: 1100 kcal | Protein: 100 g | Carbs: 100 g | Fat: 30 g');
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: 100, fat: 30, fibre: null });
});

test('paste: a real two-column table still reads as a table', () => {
  const r = readNutrition('| Calories | 1100 kcal |\n| Protein | 100 g |\n| Fat | 30 g |');
  assert.deepEqual(main(r), { kcal: 1100, protein: 100, carbs: null, fat: 30, fibre: null });
});
