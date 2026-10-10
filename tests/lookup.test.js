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
