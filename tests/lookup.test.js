import test from 'node:test';
import assert from 'node:assert/strict';
import { fromUsda } from '../js/lookup.js';

const n = (nutrientId, value) => ({ nutrientId, value });

test('fromUsda: a search result becomes a food per 100 g', () => {
  const f = fromUsda({
    fdcId: 171999, description: 'Fish, salmon, chinook, cooked, dry heat',
    foodNutrients: [n(1008, 231), n(1003, 25.7), n(1004, 13.4), n(1005, 0), n(1079, 0), n(1093, 60), n(1258, 3.21)],
  }, '2026-10-10');
  assert.deepEqual(f, {
    id: 'usda-171999', name: 'Fish, salmon, chinook, cooked, dry heat', serving: '100 g', byGrams: true, grams: 100, amount: 100,
    kcal: 231, protein: 25.7, carbs: 0, fat: 13.4, fibre: 0, source: 'usda', sourceId: '171999', fetched: '2026-10-10',
    extra: { satFat: 3.2, salt: 0.15 },
  });
});

test('fromUsda: missing numbers stay unknown, and no calories means no food', () => {
  const f = fromUsda({ fdcId: 1, description: 'Odd entry', foodNutrients: [n(2047, 100), n(1003, 'lots'), n(1004, -3)] }, '2026-10-10');
  assert.deepEqual([f.kcal, f.protein, f.carbs, f.fat, f.fibre, 'extra' in f], [100, null, null, null, null, false]);
  assert.equal(fromUsda({ fdcId: 2, description: 'No energy', foodNutrients: [n(1003, 5)] }, '2026-10-10'), null);
  assert.equal(fromUsda({ description: 'No id', foodNutrients: [n(1008, 5)] }, '2026-10-10'), null);
  assert.equal(fromUsda({}, '2026-10-10'), null);
});

import { fromOff, isBarcode } from '../js/lookup.js';

test('fromOff: a product becomes a food per 100 g, with its barcode', () => {
  const f = fromOff({
    product_name: 'Nutella', brands: 'Nutella, Ferrero', quantity: '400 g',
    nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: 0, sugars_100g: 56.3, 'saturated-fat_100g': 10.6, salt_100g: 0.107 },
  }, '3017620422003', '2026-10-10');
  assert.deepEqual(f, {
    id: 'off-3017620422003', barcode: '3017620422003', name: 'Nutella', serving: '100 g', byGrams: true, grams: 100, amount: 100,
    kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fibre: 0, source: 'off', sourceId: '3017620422003', fetched: '2026-10-10',
    extra: { sugar: 56.3, satFat: 10.6, salt: 0.11 },
  });
});

test('fromOff: kilojoules are converted, drinks are per 100 ml, gaps stay unknown', () => {
  const f = fromOff({ product_name: 'Laban', brands: 'Farm', quantity: '1 L', serving_quantity: '250', nutriments: { energy_100g: 259, proteins_100g: 3 } }, '12345678', '2026-10-10');
  assert.deepEqual([f.name, f.serving, f.amount, f.kcal, f.protein, f.carbs, f.fat], ['Laban (Farm)', '100 ml', 250, 62, 3, null, null]);
  const empty = fromOff({}, '12345678', '2026-10-10');
  assert.deepEqual([empty.name, empty.kcal], ['Product 12345678', null]);
});

test('isBarcode: 8 to 14 digits only', () => {
  assert.deepEqual(['3017620422003', '12345678', '1234567', 'abc12345678', ''].map(isBarcode), [true, true, false, false, false]);
});

import { fromLabel } from '../js/lookup.js';

test('fromLabel: a read label becomes values for the form', () => {
  const v = fromLabel({ name: ' Crisps ', per: 100, energyKcal: 502, energyKj: 2100, fat: 30, satFat: 3, carbs: 55, sugar: 2, fibre: 4, protein: 6, salt: null, sodiumMg: 480 });
  assert.deepEqual(v, { name: 'Crisps', per: 100, energy: 502, energyUnit: 'kcal', fat: 30, satFat: 3, carbs: 55, sugar: 2, fibre: 4, protein: 6, salt: 1.2, found: 4 });
});

test('fromLabel: kJ only, gaps stay empty, nonsense is dropped', () => {
  const v = fromLabel({ per: null, energyKcal: null, energyKj: 2100, fat: 'lots', carbs: 900, protein: -1 });
  assert.deepEqual([v.per, v.energy, v.energyUnit, v.fat, v.carbs, v.protein, v.salt, v.name, v.found], [100, 2100, 'kj', null, null, null, null, '', 1]);
  assert.equal(fromLabel(null).found, 0);
  assert.equal(fromLabel({ per: 30, fat: 31 }).fat, null); // more fat than the serving weighs
});

test('fromOff: a whole pack typed in as one serving is not believed, a can of drink is', () => {
  // As Open Food Facts really has it: a pack of chapati with "1 chapati (450 g)" as the serving.
  const chapati = fromOff({ product_name: 'Chapati', brands: 'Sara Cake', serving_quantity: 450, serving_quantity_unit: 'g', nutriments: { 'energy-kcal_100g': 92.6 } }, '6271026201175', '2026-10-10');
  assert.deepEqual([chapati.amount, chapati.serving], [100, '100 g']);
  const cola = fromOff({ product_name: 'Cola', quantity: '330 ml', product_quantity_unit: 'ml', serving_quantity: 330, serving_quantity_unit: 'ml', nutriments: { 'energy-kcal_100g': 42 } }, '5449000000996', '2026-10-10');
  assert.deepEqual([cola.amount, cola.serving], [330, '100 ml']);
  // The units alone are enough to know a drink, and a two-litre bottle is not one serving either.
  const big = fromOff({ product_name: 'Juice', serving_quantity: 2000, serving_quantity_unit: 'ml', nutriments: { 'energy-kcal_100g': 45 } }, '12345678', '2026-10-10');
  assert.deepEqual([big.amount, big.serving], [100, '100 ml']);
  const bar = fromOff({ product_name: 'Bar', quantity: '45 g', serving_quantity: '45', nutriments: { 'energy-kcal_100g': 500 } }, '12345678', '2026-10-10');
  assert.equal(bar.amount, 45);
});
