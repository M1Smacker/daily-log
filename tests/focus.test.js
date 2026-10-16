// The easy fortnight: two weeks asking for a morning weigh-in and every meal logged, nothing more.
// Made-up numbers only.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../js/rules.js';
import * as c from '../js/coach.js';
import { briefing } from '../js/briefing.js';
import { tidy } from '../js/store.js';
import { plan as basePlan } from '../js/plan.js';

const focus = { from: '2026-10-17', to: '2026-10-30' };

test('focusFor: the day of the fortnight, the days left, and when it is over', () => {
  const plan = { focus };
  assert.equal(r.focusFor({}, '2026-10-20'), null);
  assert.equal(r.focusFor(plan, '2026-10-16'), null); // not started yet
  assert.deepEqual(r.focusFor(plan, '2026-10-17'), { from: focus.from, to: focus.to, day: 1, left: 13, over: false });
  assert.deepEqual(r.focusFor(plan, '2026-10-30'), { from: focus.from, to: focus.to, day: 14, left: 0, over: false });
  assert.deepEqual(r.focusFor(plan, '2026-11-05'), { from: focus.from, to: focus.to, day: 14, left: 0, over: true });
  assert.equal(r.focusFor({ focus: { ...focus, closed: true } }, '2026-10-20'), null);
  assert.equal(r.focusFor({ focus: { from: 'junk', to: focus.to } }, '2026-10-20'), null);
});

test('mealsOf: something logged wins over a skip mark, and a day is accounted only when every meal is', () => {
  const day = { food: [{ meal: 'lunch', kcal: 500 }], noMeal: ['lunch', 'snack'] };
  assert.deepEqual(r.mealsOf(day), { breakfast: null, lunch: 'logged', snack: 'skipped', dinner: null });
  assert.equal(r.dayAccounted(day), false);
  assert.equal(r.dayAccounted({ ...day, food: [...day.food, { meal: 'breakfast', kcal: 300 }, { meal: 'dinner', kcal: 600 }] }), true);
  assert.equal(r.dayAccounted(undefined), false);
  assert.equal(r.dayAccounted({ food: 'junk', noMeal: 'junk' }), false);
});

test('focusTally: today counts only once something is done, so an unfinished morning is never a miss', () => {
  const all = (d) => ({ ...d, food: [{ meal: 'breakfast', kcal: 1 }, { meal: 'lunch', kcal: 1 }, { meal: 'dinner', kcal: 1 }], noMeal: ['snack'] });
  const days = {
    '2026-10-17': all({ weightKg: 90 }),
    '2026-10-18': { weightKg: 89.8 },
    '2026-10-19': all({}),
  };
  assert.deepEqual(r.focusTally(days, focus, '2026-10-19'), { days: 3, weighed: 2, full: 2 });
  assert.deepEqual(r.focusTally(days, focus, '2026-10-20'), { days: 3, weighed: 2, full: 2 }); // the 20th, nothing yet
  assert.deepEqual(r.focusTally({ ...days, '2026-10-20': { weightKg: 89.7 } }, focus, '2026-10-20'), { days: 4, weighed: 3, full: 2 });
  // After the end, only the fourteen days count.
  assert.equal(r.focusTally(days, focus, '2026-12-01').days, 14);
});

test('sessionsIn14: done and minimum sessions in the last fourteen days, today included', () => {
  const log = { '2026-10-03': { type: 'done' }, '2026-10-04': { type: 'done' }, '2026-10-10': { type: 'min' }, '2026-10-12': { type: 'missed' }, '2026-10-17': { type: 'done' } };
  assert.equal(r.sessionsIn14(log, '2026-10-17'), 3); // the 3rd is 15 days back
});

test('planFrom: a sound fortnight is kept, anything else is dropped', () => {
  assert.deepEqual(r.planFrom(basePlan, { focus }).focus, focus);
  assert.deepEqual(r.planFrom(basePlan, { focus: { ...focus, closed: true } }).focus, { ...focus, closed: true });
  for (const bad of [{ from: '2026-10-30', to: '2026-10-17' }, { from: '2026-08-01', to: '2026-12-01' }, { from: 'x', to: 'y' }, 'junk', null, []]) {
    assert.equal(r.planFrom(basePlan, { focus: bad }).focus, undefined, JSON.stringify(bad));
  }
  assert.equal(r.planFrom(basePlan, { focusAsked: true }).focusAsked, true);
  assert.equal(r.planFrom(basePlan, { focusAsked: 'yes' }).focusAsked, undefined);
});

test('tidy: skip marks keep only real meals, once each', () => {
  const t = tidy({ days: { '2026-10-17': { noMeal: ['lunch', 'lunch', 'brunch', 3, null, 'snack'] }, '2026-10-18': { noMeal: 'lunch' }, '2026-10-19': { noMeal: [] } } });
  assert.deepEqual(t.days['2026-10-17'].noMeal, ['lunch', 'snack']);
  assert.equal('noMeal' in t.days['2026-10-18'], false);
  assert.equal('noMeal' in t.days['2026-10-19'], false);
});

// ----- The Coach in the fortnight -----

const T = 2200;
const P = 170;
// A week where sessions and steps are low but food is logged: normally A6 (sessions) and A5 (steps).
function lowWeek() {
  const days = {};
  for (let i = 0; i < 35; i++) {
    const k = r.addDays('2026-10-15', i);
    days[k] = { weightKg: 90, steps: 2000, food: ['breakfast', 'lunch', 'dinner'].map((m) => ({ meal: m, kcal: 700, protein: 55, fat: 20, fibre: 8 })) };
  }
  return days;
}
const check = (days, key, focusOn) => c.weekCheck({
  key, days, T, P, targets: { fibre: 30, waterMl: 3000 },
  plan: { ...basePlan, sessionsPerWeek: 4, ...(focusOn ? { focus } : {}) }, startKg: 92,
});

test('weekCheck: outside the fortnight, low sessions and steps are pressed', () => {
  const w = check(lowWeek(), '2026-11-05', false);
  assert.ok(w.actions.some((a) => ['A5', 'A6'].includes(a.code)), JSON.stringify(w.actions.map((a) => a.code)));
});

test('weekCheck: a week that touches the fortnight never presses sessions, lifts, protein or steps', () => {
  for (const key of ['2026-10-22', '2026-10-29', '2026-11-05']) {
    const w = check(lowWeek(), key, true);
    const codes = w.actions.map((a) => a.code);
    // The week read on the 5th is 29 Oct to 4 Nov, which touches the fortnight's last day.
    assert.ok(!codes.some((x) => ['A3', 'A4', 'A5', 'A6'].includes(x)), `${key}: ${codes}`);
  }
  // A week fully after it is pressed again: 5 to 11 November does not touch the fortnight.
  const after = check(lowWeek(), '2026-11-12', true).actions.map((a) => a.code);
  assert.ok(after.some((x) => ['A5', 'A6'].includes(x)), String(after));
});

test('weekCheck: the fortnight never hides a safety action', () => {
  const days = lowWeek();
  for (const k of Object.keys(days)) days[k].food = days[k].food.map((e) => ({ ...e, kcal: 450 })); // 1,350 a day, under the floor
  const w = check(days, '2026-10-29', true);
  const codes = w.actions.map((a) => a.code);
  assert.ok(codes.includes('A2') || codes.includes('A0') || codes.includes('A1'), String(codes));
  assert.ok(w.actions.some((a) => a.code === 'A2' && a.type === 'eat-to-floor') || codes.includes('A1'), String(codes));
});

test('briefing: in the fortnight the fix is still the weekly card\'s first action', () => {
  const days = lowWeek();
  const plan = { ...basePlan, focus, sessionsPerWeek: 4 };
  for (const key of ['2026-10-22', '2026-10-25', '2026-10-29', '2026-11-02']) {
    const sel = briefing({ key, days, T, P, targets: { fibre: 30, waterMl: 3000 }, plan, targetChangedOn: null, startKg: 92, goalKg: 77.5 });
    const fix = sel.parts.fix[0]?.id;
    assert.ok(!['X12', 'X13', 'X14', 'X11'].includes(fix), `${key}: fix ${fix} presses something the fortnight drops`);
  }
});

test('focusAgain: straight after, the same run carries on; much later, a new one starts', () => {
  assert.deepEqual(r.focusAgain(focus, '2026-10-31'), { from: '2026-10-17', to: '2026-11-13' });
  assert.deepEqual(r.focusAgain(focus, '2026-11-06'), { from: '2026-10-17', to: '2026-11-19' }); // 7 days after the end
  assert.deepEqual(r.focusAgain(focus, '2026-11-07'), { from: '2026-11-07', to: '2026-11-20' }); // 8 days after
  assert.deepEqual(r.focusAgain(null, '2026-11-07'), { from: '2026-11-07', to: '2026-11-20' });
  // A carried-on run is still a sound plan setting, so it is not dropped on the next load.
  assert.deepEqual(r.planFrom(basePlan, { focus: r.focusAgain(focus, '2026-10-31') }).focus, { from: '2026-10-17', to: '2026-11-13' });
  // Never past three months in one run.
  const long = { from: '2026-08-01', to: '2026-10-25' };
  assert.equal(r.focusAgain(long, '2026-10-26').from, '2026-10-26');
});

test('focusFor and focusTally on a carried-on run count the whole run', () => {
  const run = { from: '2026-10-17', to: '2026-11-13' };
  assert.equal(r.focusFor({ focus: run }, '2026-11-01').day, 16);
  assert.equal(r.focusTally({}, run, '2026-12-01').days, 28);
});

// ----- "Ate nothing", stored as a skip entry in the food list -----

test('skipEntry and mealsOf: a skip is a zero entry, and real food in the meal wins', () => {
  const s = r.skipEntry('lunch');
  assert.deepEqual([s.meal, s.none, s.kcal, s.protein, s.carbs, s.fat, s.fibre], ['lunch', true, 0, 0, 0, 0, 0]);
  assert.deepEqual(r.mealsOf({ food: [s] }).lunch, 'skipped');
  assert.deepEqual(r.mealsOf({ food: [s, { meal: 'lunch', kcal: 500 }] }).lunch, 'logged');
  assert.equal(r.dayAccounted({ food: ['breakfast', 'lunch', 'snack', 'dinner'].map(r.skipEntry) }), true);
});

test('dayFacts: a skip is not a meal eaten, but a fully accounted day is complete', () => {
  const meal = (m, kcal) => ({ meal: m, kcal, protein: 30, fat: 20, fibre: 5 });
  // One real meal and one skip: still a half-logged day, not judged.
  const half = c.dayFacts([meal('lunch', 1500), r.skipEntry('snack')]);
  assert.equal(half.meals, 1);
  assert.equal(c.isJudgeable(half), false);
  // One real meal and the other three marked: complete, judged even though it is one meal.
  const full = c.dayFacts([meal('dinner', 1500), r.skipEntry('breakfast'), r.skipEntry('lunch'), r.skipEntry('snack')]);
  assert.equal(full.meals, 1);
  assert.equal(full.accounted, true);
  assert.equal(c.isJudgeable(full), true);
  // Skip marks never stand in for the calorie minimum: a short log is still a short log.
  assert.equal(c.isJudgeable(c.dayFacts([meal('lunch', 700), r.skipEntry('breakfast'), r.skipEntry('snack'), r.skipEntry('dinner')])), false);
  // A day of nothing but skip marks is not judged: there is no food to judge.
  assert.equal(c.isJudgeable(c.dayFacts(['breakfast', 'lunch', 'snack', 'dinner'].map(r.skipEntry))), false);
  // Ordinary days are judged exactly as before.
  assert.equal(c.isJudgeable(c.dayFacts([meal('lunch', 800), meal('dinner', 600)])), true);
  assert.equal(c.isJudgeable(c.dayFacts([meal('lunch', 1500)])), false);
});

test('pastMeals: a skipped meal is never offered as an earlier meal to add again', () => {
  const days = { '2026-10-16': { food: [r.skipEntry('lunch')] }, '2026-10-15': { food: [{ meal: 'lunch', name: 'Rice', kcal: 600, amount: 1 }] } };
  const past = r.pastMeals(days, '2026-10-17', 'lunch');
  assert.equal(past.length, 1);
  assert.equal(past[0].key, '2026-10-15');
});

test('tidy keeps skip entries: they are valid food entries with numbers', () => {
  const t = tidy({ days: { '2026-10-17': { food: [r.skipEntry('snack')] } } });
  assert.equal(t.days['2026-10-17'].food.length, 1);
});
