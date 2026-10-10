import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../js/rules.js';
import { foods } from '../js/foods.js';

const roti = foods.find((f) => f.id === 'roti');

test('portionBy: the same food by pieces or by grams', () => {
  assert.equal(r.portionBy(roti, 2, 'serving').kcal, 220);
  assert.equal(r.portionBy(roti, 80, 'g').kcal, 220);
  assert.equal(r.portion(roti, 2).kcal, 220); // the old call still means servings here
});

test('portionBy: an unknown number stays unknown', () => {
  const haleem = foods.find((f) => f.id === 'haleem');
  const p = r.portionBy(haleem, 250, 'g');
  assert.equal(p.kcal, 320);
  assert.equal(p.protein, null);
  assert.equal(r.totals([p, { kcal: 100, protein: 10 }]).protein, 10);
});

test('recipeServing: divides the pot, and one unknown ingredient makes that macro unknown', () => {
  const items = [{ kcal: 400, protein: 40, carbs: 10, fat: 20, fibre: 2 }, { kcal: 200, protein: 0, carbs: 0, fat: 22, fibre: null }];
  assert.deepEqual(r.recipeServing(items, 4), { kcal: 150, protein: 10, carbs: 2.5, fat: 10.5, fibre: 0.5 });
  assert.equal(r.recipeServing([...items, { kcal: 50, protein: null, carbs: 5, fat: 1 }], 2).protein, null);
});

test('recentFoods: most used first, with the amount used last', () => {
  const days = {
    '2026-10-10': { food: [{ foodId: 'roti', amount: 2, unit: 'serving' }, { foodId: 'dahi', amount: 200, unit: 'g' }, { name: 'Quick add' }] },
    '2026-10-09': { food: [{ foodId: 'roti', amount: 1, unit: 'serving' }] },
    '2026-08-01': { food: [{ foodId: 'old', amount: 1, unit: 'serving' }] },
  };
  const out = r.recentFoods(days, '2026-10-10');
  assert.deepEqual(out.map((x) => x.foodId), ['roti', 'dahi']);
  assert.equal(out[0].amount, 2);
});

test('pastMeals: earlier meals of one kind, not today, the same one listed once', () => {
  const lunch = [{ foodId: 'rice', amount: 158, meal: 'lunch' }];
  const days = {
    '2026-10-10': { food: lunch },
    '2026-10-09': { food: [...lunch, { foodId: 'chai', amount: 1, meal: 'breakfast' }] },
    '2026-10-08': { food: lunch },
    '2026-10-07': { food: [{ foodId: 'pizza', amount: 3, meal: 'lunch' }] },
  };
  const out = r.pastMeals(days, '2026-10-10', 'lunch');
  assert.deepEqual(out.map((m) => m.key), ['2026-10-09', '2026-10-07']);
  assert.equal(out[0].entries.length, 1);
});

test('foods: every food has a name, calories and a usable serving', () => {
  const ids = new Set();
  for (const f of foods) {
    assert.ok(!ids.has(f.id), f.id);
    ids.add(f.id);
    assert.ok(f.name && f.serving && f.kcal > 0, f.id);
    if (f.byGrams) assert.ok(f.grams > 0, f.id);
  }
});
