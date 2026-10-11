// Regression tests from the audit of the Coach (October 2026). Each one was written to fail
// first, against the bug it describes. Numbers are made up.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../js/coach.js';
import * as r from '../js/rules.js';
import { plan } from '../js/plan.js';
import { say } from '../js/coach-words.js';

const DB = [5, 7, 7.5, 8, 10, 12.5, 15, 17.5, 20];
const s = (kg, reps) => ({ kg, reps });
const T = 2200;
const P = 160;
const text = (x, ctx = { T, dayName: 'Saturday' }) => say(x, ctx);

// ----- The lift check against the jump rule -----

test('a big step up needs extra reps, and the Coach never says "top of the range is enough" for it', () => {
  // Lateral raise, 5 kg to 7 kg is a 40% step: the jump rule wants 23 on every set, not 20.
  const raise = (sets) => c.liftCheck({ sets, lo: 12, hi: 20, kind: 'dumbbell', dumbbells: DB, planned: 2 });
  const l2 = raise([s(5, 22), s(5, 22)])[0];
  assert.equal(l2.code, 'L2');
  assert.equal(l2.n.goal, 23);
  assert.match(text(l2), /23/);
  assert.doesNotMatch(text(l2), /If every set gets there, the weight goes up next time/);
  // Set 1 well above, set 2 short: the goal named is still 23, not 20.
  const l1 = raise([s(5, 24), s(5, 15)])[0];
  assert.equal(l1.code, 'L1');
  assert.match(text(l1), /gets to 23/);
  // A machine at a light weight: 30 to 35 kg is a 16.7% step, so 18 on a 10 to 15 lift.
  const curl = c.liftCheck({ sets: [s(30, 19)], lo: 10, hi: 15, kind: 'machine', planned: 3 })[0];
  assert.equal(curl.n.goal, 18);
  assert.match(text(curl), /gets to 18/);
});

test('what the Coach says about going up always matches what the next sheet will do', () => {
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  for (let i = 0; i < 3000; i++) {
    const kind = pick(['dumbbell', 'machine', 'barbell']);
    const [lo, hi] = pick([[6, 10], [8, 12], [10, 12], [10, 15], [12, 20], [15, 20]]);
    const planned = pick([1, 2, 3, 4]);
    const kg = kind === 'dumbbell' ? pick(DB) : pick([10, 20, 30, 40, 60, 80, 100]);
    const sets = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => s(rnd() < 0.8 ? kg : pick(kind === 'dumbbell' ? DB : [20, 30, 40]), 1 + Math.floor(rnd() * 26)));
    const out = c.liftCheck({ sets, lo, hi, kind, dumbbells: DB, planned });
    if (!out.length) continue;
    const main = out[0];
    const words = text(main);
    const next = r.progression({ kind, reps: [lo, hi] }, { sets, planned, top: hi }, DB);
    const promises = /next time is [\d.]+ kg/.test(words);
    assert.equal(promises, next.type === 'jump', `${JSON.stringify(sets)} ${lo}-${hi} planned ${planned}: "${words}" but the sheet says ${next.type}`);
    if (promises) assert.ok(words.includes(`${String(next.to).replace(/\.0$/, '')} kg`), `"${words}" names the wrong weight, the sheet says ${next.to}`);
    // "once every set gets to N" has to be the number the jump rule really wants.
    const goal = words.match(/once every set gets to (\d+)/);
    if (goal) assert.equal(Number(goal[1]), r.jumpGoal(kind, main.n.kg, hi, DB).need, words);
    assert.doesNotMatch(words, /undefined|NaN|null/);
  }
});

test('a deload is not judged: fewer reps at the same weight is the point', () => {
  const out = c.liftCheck({ sets: [s(40, 5), s(40, 5)], lo: 8, hi: 12, kind: 'machine', planned: 2, load: 'half', effort: [4, 4] });
  assert.deepEqual(out.map((x) => x.code), ['LD']);
  assert.equal(out[0].level, 'none');
  assert.doesNotMatch(text(out[0]), /heavy|lighter/i);
});

// ----- Warm-ups and back-off sets -----

test('only light sets before the work are warm-ups. A lighter set after it is real work', () => {
  assert.deepEqual(r.workSets([s(20, 15), s(40, 10), s(40, 10)]), [s(40, 10), s(40, 10)]);
  assert.deepEqual(r.workSets([s(16, 10), s(10, 15)]), [s(16, 10), s(10, 15)]); // a back-off set
  assert.deepEqual(r.workSets([s(10, 15), s(16, 10), s(10, 15)]), [s(16, 10), s(10, 15)]);
  assert.deepEqual(r.workSets([{ reps: 10 }, { reps: 8 }]), [{ reps: 10 }, { reps: 8 }]);
  assert.deepEqual(r.workSets([]), []);
  // So the sets check does not call a heavy set then a light set "one set short".
  assert.deepEqual(c.setsCheck({ sets: [s(7.5, 12), s(5, 20)], planned: 2, load: 'full' }), []);
  // And the jump rule does not hold the weight for "too few sets".
  assert.notEqual(r.progression({ kind: 'dumbbell', reps: [12, 20] }, { sets: [s(7.5, 23), s(5, 23)], planned: 2, top: 20 }, DB).type, 'hold');
});

// ----- Sets -----

test('S11 stays silent when no lift has anything yet: the recap simply has not been filled in', () => {
  assert.equal(c.sessionCheck({ finished: true, counts: [0, 0, 0, 0, 0, 0, 0, 0] }), null);
  assert.equal(c.sessionCheck({ finished: true, counts: [2, 0, 0, 0, 2, 2, 2, 2] }).code, 'S11');
});

// ----- Day -----

test('the evening reminder still works after midnight, before the day rolls over', () => {
  const entries = [{ meal: 'lunch', kcal: 500, protein: 20, fat: 10, fibre: 5 }];
  const at = (hour) => c.dayCheck({ entries, kcalTarget: T, proteinTarget: P, open: true, hour }).evening;
  assert.equal(at(25)?.code, 'D9'); // 1 am, the same open day
  assert.equal(at(12), null);
});

// ----- Week -----

const E0 = '2026-11-11';
const E1 = '2026-11-04';
const E2 = '2026-10-28';
const KEY = '2026-11-12';
const meal = (name, kcal, protein) => ({ id: name, meal: name, kcal, protein, fat: 20, fibre: 8 });
const food = (kcal, protein = 150) => ['breakfast', 'lunch', 'dinner'].map((m) => meal(m, kcal / 3, protein / 3));
function weekDays(to, { avg = null, weighIns = 5, kcal = 2150, foodDays = 6, sessions = 4 } = {}) {
  const out = {};
  for (let i = 0; i < 7; i++) {
    const d = {};
    if (avg !== null && i < weighIns) d.weightKg = avg;
    if (i < foodDays) d.food = food(kcal);
    if (i < sessions) d.session = { type: 'done' };
    out[r.addDays(to, i - 6)] = d;
  }
  return out;
}
const three = (avgs, latest = {}) => ({ ...weekDays(E2, { avg: avgs[0] }), ...weekDays(E1, { avg: avgs[1] }), ...weekDays(E0, { avg: avgs[2], ...latest }) });
const run = (days, over = {}) => c.weekCheck({ key: KEY, days, T, P, targets: { fibre: 30, waterMl: 3000 }, plan: { ...plan, sessionsPerWeek: 4 }, ...over });
const put = (days, key, patch) => { days[key] = { ...(days[key] ?? {}), ...patch }; };

test('with too few food days, the verdict never quotes a food average, and never "0 kcal from 0 days"', () => {
  for (const foodDays of [0, 1, 3]) {
    const pace = run(three([88.0, 87.2, 86.5], { foodDays }));
    assert.equal(pace.verdict.code, 'W11');
    assert.equal(pace.verdict.n.kcal, null);
    assert.doesNotMatch(text(pace.verdict), /averaged|0 kcal|from \d days/);
    const slow = run(three([88.0, 87.8, 87.4], { foodDays }));
    assert.equal(slow.verdict.code, 'W10');
    assert.doesNotMatch(text(slow.verdict), /averaged|0 kcal|from \d days/);
  }
  assert.match(text(run(three([88.0, 87.2, 86.5])).verdict), /Food averaged 2,150 kcal from 6 days/);
});

test('the weight line only names a pace when there are three usable weeks', () => {
  const two = run({ ...weekDays(E1, { avg: 88.0 }), ...weekDays(E0, { avg: 87.5 }) });
  const f1 = two.lines.find((l) => l.code === 'F1');
  assert.equal(f1.level, 'none');
  assert.equal(f1.n.band, null);
  assert.doesNotMatch(text(f1), /on pace|slow|flat|rising|too fast/);
  assert.equal(run(three([88.0, 87.2, 86.5])).lines.find((l) => l.code === 'F1').n.band, 'pace');
});

test('when two quiet periods overlap, the date given is when the later one clears', () => {
  const days = { ...weekDays('2026-10-14', { avg: 89 }), ...weekDays('2026-10-21', { avg: 88.5 }), ...weekDays('2026-10-28', { avg: 88 }) };
  put(days, '2026-10-20', { creatine: true }); // its window runs to 30 Oct, past the first fortnight
  const out = run(days, { key: '2026-10-29' });
  assert.deepEqual([out.verdict.code, out.verdict.n.why, out.verdict.n.until], ['W4', 'creatine', '2026-11-26']);
  // The date is when it can speak, not a promise: it still needs the weigh-ins.
  assert.match(text(out.verdict), /4 or more mornings/);
});

test('"give it time" names the day the verdict really comes back, a Thursday', () => {
  const out = run(three([86.5, 86.4, 86.5], { kcal: 2170 }), { targetChangedOn: '2026-11-03' });
  assert.deepEqual([out.verdict.code, out.verdict.n.until], ['W8c', '2026-11-26']);
  assert.equal(r.weekday(out.verdict.n.until), 4);
});

test('after raising the target for "too fast", it does not ask for another 150 the next week', () => {
  const fast = three([90.0, 88.6, 87.1]);
  const before = run(fast);
  assert.equal(before.actions[0].type, 'add-kcal');
  const after = run(fast, { targetChangedOn: '2026-11-12', T: T + 150 });
  assert.equal(after.verdict.code, 'W2');
  assert.equal(after.actions[0].type, 'changed');
  assert.doesNotMatch(text(after.actions[0]), /Add 150/);
});

test('an old waist reading is not used to call a flat scale "recomposing"', () => {
  const days = three([86.5, 86.5, 86.4]);
  put(days, '2026-10-05', { waistCm: 88.5 }); // five weeks before the week's end
  put(days, '2026-09-20', { waistCm: 90.0 });
  const workout = (kg) => ({ session: 'upperA', finished: true, lifts: { a: { sets: [s(kg, 10), s(kg, 10)], planned: 2, top: 12 }, b: { sets: [s(kg, 10), s(kg, 10)], planned: 2, top: 12 } } });
  put(days, '2026-10-31', { workout: workout(40) });
  put(days, '2026-11-09', { workout: workout(42.5) });
  const out = run(days);
  assert.notEqual(out.verdict.code, 'W6');
  assert.equal(out.lines.find((l) => l.code === 'F9'), undefined);
});

test('the stall choice says to give it two weeks, so a second change is not stacked on the first', () => {
  const out = run(three([86.5, 86.4, 86.5], { kcal: 2170 }));
  assert.equal(out.verdict.code, 'W8');
  assert.match(text(out.actions[0]), /2 weeks/);
});

test('sentences about the finished week do not say "this week" or "so far"', () => {
  const days = three([88.0, 87.5, 87.0], { foodDays: 2 });
  const out = run(days);
  assert.doesNotMatch(text(out.lines.find((l) => l.code === 'F2')), /so far|this week/);
  const low = three([88.0, 87.5, 87.0]);
  for (const k of ['2026-11-05', '2026-11-06', '2026-11-07']) put(low, k, { food: food(1500) });
  assert.doesNotMatch(text(run(low).verdict), /this week/);
});

// ----- A heavy first set -----

test('a heavier set only counts as done if it reached the bottom of the range', () => {
  const press = { kind: 'dumbbell', reps: [8, 12] };
  const at = (sets) => r.progression(press, { sets, planned: sets.length, top: 12 }, DB).type;
  assert.equal(at([s(17.5, 1), s(15, 15)]), 'hold'); // one rep at 17.5 is not "done"
  assert.equal(at([s(17.5, 7), s(15, 15)]), 'hold');
  assert.equal(at([s(17.5, 8), s(15, 15)]), 'jump'); // 8 is the bottom of 8 to 12
  assert.equal(at([s(17.5, 8), s(15, 12)]), 'extra'); // a big step still needs the extra reps
});

test('a heavy first set is judged at its own weight, and the advice is about that set, not a lighter dumbbell', () => {
  const lift = (sets) => c.liftCheck({ sets, lo: 8, hi: 12, kind: 'dumbbell', dumbbells: DB, planned: 2 });
  const far = lift([s(17.5, 4), s(15, 12)])[0];
  assert.deepEqual([far.code, far.n.at, far.n.kg, far.n.opener], ['L5', 17.5, 15, true]);
  assert.match(text(far), /17\.5 kg/);
  assert.match(text(far), /15 kg/);
  assert.doesNotMatch(text(far), /12\.5 kg/); // never "go lighter than the weight most sets used"
  const near = lift([s(17.5, 7), s(15, 12)])[0];
  assert.equal(near.code, 'L4');
  assert.doesNotMatch(text(near), /Keep this weight/);
  // No heavy opener: the old advice stands.
  assert.match(text(lift([s(15, 4), s(15, 4)])[0]), /Use 12\.5 kg next time/);
});

// ----- Damaged data -----

test('a damaged target date or an impossible day does not crash the week check', () => {
  for (const targetChangedOn of ['zzz', '2026-13-45', 20261103, {}, '']) {
    const flat = run(three([86.5, 86.4, 86.5], { kcal: 2170 }), { targetChangedOn });
    assert.equal(flat.verdict.code, 'W8', `target date ${JSON.stringify(targetChangedOn)} was believed`);
    const fast = run(three([90.0, 88.6, 87.1]), { targetChangedOn });
    assert.equal(fast.actions[0].type, 'add-kcal');
  }
  const days = three([88.0, 87.2, 86.5]);
  days['2026-13-45'] = { creatine: true };
  assert.equal(run(days).verdict.code, 'W11');
});

// ----- The 1,800 floor, when your own target is set under it -----

test('a calorie target set under 1,800 is never something the Coach tells you to aim for', () => {
  const low = 1700;
  // Eating above a too-low target: the advice is the floor, and it says the target is under it.
  const above = run(three([88.0, 87.8, 87.4], { kcal: 2400 }), { T: low });
  const words = [above.verdict, ...above.actions, ...above.lines].map((x) => text(x, { T: low })).join(' ');
  assert.doesNotMatch(words, /Aim for 1,700|target is 1,700\.|against 1,700/);
  const f0 = above.lines.find((l) => l.code === 'F0');
  assert.deepEqual([f0.level, f0.n.T, f0.n.floor], ['watch', 1700, 1800]);
  assert.match(text(f0), /1,700.*under.*1,800/);
  // A normal target has no such line.
  assert.equal(run(three([88.0, 87.2, 86.5])).lines.find((l) => l.code === 'F0'), undefined);
  // The day check measures against the floor too: 1,750 on a 1,700 target is under the floor, not "on target".
  const day = c.dayCheck({ entries: food(1750), kcalTarget: low, proteinTarget: P });
  assert.equal(day.lines[0].code, 'D3');
  const ok = c.dayCheck({ entries: food(1850), kcalTarget: low, proteinTarget: P });
  assert.equal(ok.lines[0].code, 'D1');
  assert.doesNotMatch(text(ok.lines[0]), /1,700/);
});
