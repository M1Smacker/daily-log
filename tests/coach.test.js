// The Coach. Tests assert the rule code, the level and the numbers, never the sentence,
// except in the voice tests that read the wording itself.
// Targets here are made-up numbers, not anyone's real ones.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as c from '../js/coach.js';
import * as r from '../js/rules.js';
import { plan } from '../js/plan.js';
import { WORDS, say } from '../js/coach-words.js';
import { RAILS, withinRails } from '../js/coach-constants.js';
import { sessions, MUSCLE, muscleOf } from '../js/exercises.js';

const DB = [5, 7, 7.5, 8, 10, 12.5, 15, 17.5, 20];
const s = (kg, reps) => ({ kg, reps });
const T = 2200; // a made-up calorie target
const P = 160; // a made-up protein target

// Every sentence the tests cause must be well formed.
const WORDS_CTX = { T, dayName: 'Saturday' };
function said(list) {
  return list.map((x) => {
    const text = say(x, WORDS_CTX);
    assert.ok(text.length > 0, `no sentence for ${x.code}`);
    assert.ok(!/undefined|NaN|\[object|null/.test(text), `${x.code} says: ${text}`);
    return text;
  });
}
const codes = (list) => list.map((x) => x.code);
const lift = (over) => c.liftCheck({ lo: 8, hi: 12, kind: 'dumbbell', dumbbells: DB, planned: 3, ...over });

// ----- Lift check -----

test('L1: 16 reps on an 8 to 12 dumbbell lift is well above the range, and the jump rule agrees', () => {
  const out = lift({ sets: [s(16, 16), s(16, 14), s(16, 12)], firstTime: true });
  assert.deepEqual(codes(out), ['L1']);
  assert.equal(out[0].level, 'note');
  assert.equal(out[0].n.F, 16);
  assert.equal(out[0].n.next, 17.5); // 16 is not on the list, so the next one up is 17.5
  assert.equal(out[0].n.jump, 'jump');
  assert.equal(out[0].n.first, true);
  assert.match(said(out)[0], /next time is 17\.5 kg/);
});

test('L1: set 1 was high but the other sets were not, so no jump is promised', () => {
  const out = lift({ sets: [s(15, 16), s(15, 9)], planned: 2 });
  assert.equal(out[0].code, 'L1');
  assert.equal(out[0].n.jump, 'hold');
  assert.doesNotMatch(said(out)[0], /next time is/);
  // 15 kg to 17.5 kg is a 16.7% step, so the jump rule wants 15 reps on every set, not 12.
  assert.equal(out[0].n.goal, 15);
  assert.match(said(out)[0], /big one, so the weight goes up once every set gets to 15/);
});

test('L1: a big jump asks for the extra reps first, and says so', () => {
  const out = lift({ sets: [s(10, 16), s(10, 12)], planned: 2 }); // 10 to 12.5 is a 25% jump
  assert.equal(out[0].code, 'L1');
  assert.equal(out[0].n.jump, 'extra');
  assert.equal(out[0].n.need, 15);
  assert.match(said(out)[0], /gets to 15/);
});

test('L3: the same 16 reps on lateral raise at 12 to 20 is right in the range', () => {
  const out = lift({ lo: 12, hi: 20, sets: [s(16, 16), s(16, 15), s(16, 14)] });
  assert.equal(out[0].code, 'L3');
  assert.equal(out[0].level, 'good');
});

test('L5: 5 reps on an 8 to 12 lift is too heavy, and the step down is the next lighter dumbbell', () => {
  const out = lift({ sets: [s(12, 5), s(12, 4), s(12, 4)] });
  assert.equal(out[0].code, 'L5');
  assert.equal(out[0].level, 'watch');
  assert.equal(out[0].n.prev, 10);
});

test('L6a: top of the range on the heaviest dumbbell, and it wins over L3', () => {
  const out = lift({ sets: [s(20, 12), s(20, 12), s(20, 11)] });
  assert.equal(out[0].code, 'L6a');
  assert.equal(out[0].level, 'good');
});

test('L6b: well over the range on the heaviest dumbbell, the wording follows whether there is an alternative', () => {
  const sets = [s(20, 15), s(20, 14)];
  const withAlt = lift({ sets, hasAlt: true, planned: 2 });
  const without = lift({ sets, hasAlt: false, planned: 2 });
  assert.equal(withAlt[0].code, 'L6b');
  assert.match(said(withAlt)[0], /alternative listed/);
  assert.match(said(without)[0], /slow the lowering/);
});

test('mixed weights: the working weight is the one most sets used, and set 1 is judged at its own weight', () => {
  const out = c.liftCheck({ lo: 8, hi: 12, kind: 'machine', planned: 3, sets: [s(40, 8), s(35, 12), s(35, 12)] });
  assert.equal(out[0].code, 'L3');
  assert.equal(out[0].n.kg, 35);
  assert.equal(out[0].n.F, 8);
});

test('the edges of every band', () => {
  const at = (reps) => lift({ sets: [s(15, reps)], planned: 1 })[0];
  const expect = { 15: 'L1', 14: 'L2', 13: 'L2', 12: 'L3', 8: 'L3', 7: 'L4', 6: 'L4', 5: 'L5', 1: 'L5' };
  for (const [reps, code] of Object.entries(expect)) assert.equal(at(Number(reps)).code, code, `${reps} reps`);
});

test('a warm-up set is ignored, and it never becomes set 1', () => {
  const out = c.liftCheck({ lo: 8, hi: 12, kind: 'machine', planned: 2, sets: [s(20, 15), s(40, 10), s(40, 10)] });
  assert.equal(out[0].n.F, 10);
  assert.equal(out[0].n.kg, 40);
});

test('bodyweight lifts: L7 on reps alone, no weights in it', () => {
  const out = c.liftCheck({ lo: 6, hi: 12, kind: 'body', planned: 2, sets: [{ reps: 15 }, { reps: 12 }] });
  assert.equal(out[0].code, 'L7');
  assert.equal(out[0].n.band, 'above');
  assert.equal(out[0].n.next, undefined);
  assert.doesNotMatch(said(out)[0], /kg/);
});

test('silent when there is nothing to judge: no sets, no weight, no range, or the alternative was done', () => {
  assert.deepEqual(lift({ sets: [] }), []);
  assert.deepEqual(lift({ sets: [s(0, 10)] }), []);
  assert.deepEqual(lift({ sets: [s(12, 10)], lo: 0 }), []);
  assert.deepEqual(lift({ sets: [s(12, 10)], alt: true }), []);
});

test('L9: the effort line is added to L2 and L3 only', () => {
  const effort = [2, 3];
  assert.deepEqual(codes(lift({ sets: [s(15, 10)], planned: 1, effort })), ['L3', 'L9']);
  assert.deepEqual(codes(lift({ sets: [s(15, 13)], planned: 1, effort })), ['L2', 'L9']);
  assert.deepEqual(codes(lift({ sets: [s(15, 5)], planned: 1, effort })), ['L5']);
  assert.match(said(lift({ sets: [s(15, 10)], planned: 1, effort }))[1], /2 to 3 reps/);
});

test('L8: two sessions of going down in a row', () => {
  assert.equal(c.liftBackwards([90, 85, 80]).code, 'L8');
  assert.equal(c.liftBackwards([80, 85, 90]), null);
  assert.equal(c.liftBackwards([90, 80]), null);
});

// ----- Sets check -----

test('S2 and S3: the Foundation phase eases in', () => {
  const sets = (n) => Array.from({ length: n }, () => s(40, 10));
  assert.deepEqual(codes(c.setsCheck({ sets: sets(3), planned: 2, load: 'ramp' })), ['S2']);
  assert.deepEqual(codes(c.setsCheck({ sets: sets(4), planned: 2, load: 'ramp' })), ['S3']);
  assert.equal(c.setsCheck({ sets: sets(3), planned: 2, load: 'ramp' })[0].level, 'good');
});

test('S4 and S5: Build and Push', () => {
  const sets = (n) => Array.from({ length: n }, () => s(40, 10));
  assert.deepEqual(codes(c.setsCheck({ sets: sets(4), planned: 3, load: 'full' })), ['S4']);
  assert.deepEqual(codes(c.setsCheck({ sets: sets(5), planned: 3, load: 'full' })), ['S5']);
});

test('S7 and S8: a deload keeps its sets and its weights', () => {
  const sets = [s(45, 10), s(45, 10), s(45, 10)];
  assert.deepEqual(codes(c.setsCheck({ sets, planned: 2, load: 'half', lastKg: 40 })), ['S7', 'S8']);
  assert.deepEqual(codes(c.setsCheck({ sets, planned: 3, load: 'half', lastKg: 45 })), []);
});

test('S9: fewer than planned says one short or how many', () => {
  const out1 = c.setsCheck({ sets: [s(40, 10), s(40, 10)], planned: 3, load: 'full' });
  const out2 = c.setsCheck({ sets: [s(40, 10)], planned: 3, load: 'full' });
  assert.deepEqual([out1[0].code, out1[0].n.short], ['S9', 1]);
  assert.deepEqual([out2[0].code, out2[0].n.short], ['S9', 2]);
  assert.match(said(out2)[0], /2 sets short/);
});

test('sets: equal is silent, warm-ups do not count, and a Minimum session is judged against its own 2', () => {
  assert.deepEqual(c.setsCheck({ sets: [s(40, 10), s(40, 10)], planned: 2, load: 'full' }), []);
  assert.deepEqual(c.setsCheck({ sets: [s(20, 15), s(40, 10), s(40, 10)], planned: 2, load: 'full' }), []);
  assert.deepEqual(c.setsCheck({ sets: [], planned: 2, load: 'full' }), []);
});

test('S10 and S11: a Full session that looks like a Minimum one, or has empty lifts', () => {
  assert.equal(c.sessionCheck({ finished: true, counts: [3, 3, 3, 0, 0, 0, 0, 0] }).code, 'S10');
  const empty = c.sessionCheck({ finished: true, counts: [3, 0, 0, 0, 3, 3, 3, 3] });
  assert.deepEqual([empty.code, empty.n.n], ['S11', 3]);
  assert.equal(c.sessionCheck({ finished: true, counts: [2, 2, 2, 2, 2, 2, 2, 0] }), null);
  assert.equal(c.sessionCheck({ finished: true, minimum: true, counts: [2, 2, 2, 0, 0, 0, 0, 0] }), null);
  assert.equal(c.sessionCheck({ finished: false, counts: [3, 3, 3, 0, 0, 0, 0, 0] }), null);
});

test('S6: more than 20 direct sets for one muscle in a week', () => {
  const day = (lifts) => ({ workout: { session: 'upperB', lifts } });
  const sets = (n) => ({ sets: Array.from({ length: n }, () => s(40, 10)), planned: n, top: 12 });
  const days = {
    '2026-11-05': day({ 'incline-db-press': sets(5), 'chest-press': sets(5) }),
    '2026-11-08': day({ 'pec-deck': sets(4), 'smith-incline-press': sets(4), 'dip-machine': sets(3), 'lat-pulldown': sets(9) }),
  };
  const counts = c.weeklySets({ days, from: '2026-11-05', to: '2026-11-11', muscleOf });
  assert.equal(counts.chest, 21);
  const out = c.ceilingCheck(counts);
  assert.deepEqual([out.code, out.level, out.n.muscle, out.n.n], ['S6', 'watch', 'chest', 21]);
  days['2026-11-08'].workout.lifts['dip-machine'] = sets(2);
  assert.equal(c.ceilingCheck(c.weeklySets({ days, from: '2026-11-05', to: '2026-11-11', muscleOf })), null);
});

test('the muscle map covers every lift in the plan, and a swapped lift keeps its muscle', () => {
  const ids = new Set(Object.values(sessions).flat().map((e) => e.id));
  assert.deepEqual([...ids].filter((id) => !MUSCLE[id]), []);
  assert.equal(muscleOf('lateral-raise~cable-lateral-raise'), 'side delts');
});

// ----- Day check -----

const meal = (name, kcal, extra = {}) => ({ id: `${name}-${kcal}`, meal: name, kcal, protein: 40, fat: 20, fibre: 8, ...extra });
const day = (kcal, over = {}, extra = {}) => c.dayCheck({
  entries: [meal('breakfast', kcal / 3, extra), meal('lunch', kcal / 3, extra), meal('dinner', kcal / 3, extra)],
  kcalTarget: T, proteinTarget: P, ...over,
});
const withProtein = (kcal, protein) => c.dayCheck({
  entries: [meal('breakfast', kcal / 3, { protein: protein / 3 }), meal('lunch', kcal / 3, { protein: protein / 3 }), meal('dinner', kcal / 3, { protein: protein / 3 })],
  kcalTarget: T, proteinTarget: P,
});

test('D4 and D6: over target by 300 with good protein is two lines', () => {
  const out = withProtein(T + 300, 160);
  assert.equal(out.judgeable, true);
  assert.deepEqual(codes(out.lines), ['D4', 'D6']);
  assert.deepEqual(out.lines.map((l) => l.level), ['note', 'good']);
  assert.equal(out.lines[0].n.over, 300);
  assert.equal(out.lines[0].n.fatKg, 0.04);
  said(out.lines);
});

test('D0: not enough logged to judge, and not counted', () => {
  const out = c.dayCheck({ entries: [meal('breakfast', 600), meal('lunch', 500)], kcalTarget: T, proteinTarget: P });
  assert.equal(out.judgeable, false);
  assert.deepEqual(out.lines.map((l) => [l.code, l.level]), [['D0', 'none']]);
  assert.match(said(out.lines)[0], /Not enough logged to judge Saturday \(1,100 kcal, 2 meals\)/);
  const none = c.dayCheck({ entries: [], kcalTarget: T, proteinTarget: P });
  assert.match(said(none.lines)[0], /Nothing was logged for Saturday/);
  // Plenty of kcal but one meal, or a short log with several meals: both unjudged.
  assert.equal(c.dayCheck({ entries: [meal('lunch', 2000)], kcalTarget: T, proteinTarget: P }).judgeable, false);
});

test('D3 and D6: under the floor with low protein, both watches', () => {
  const out = withProtein(1500, 100);
  assert.deepEqual(out.lines.map((l) => [l.code, l.level]), [['D3', 'watch'], ['D6', 'watch']]);
});

test('the calorie bands and their edges', () => {
  const at = (kcal) => day(kcal).lines[0].code;
  assert.equal(at(1199), 'D0'); // 3 meals but under 1,200
  assert.equal(at(1200), 'D3');
  assert.equal(at(1799), 'D3');
  assert.equal(at(1800), 'D2');
  assert.equal(at(T - 251), 'D2');
  assert.equal(at(T - 250), 'D1');
  assert.equal(at(T), 'D1');
  assert.equal(at(T + 150), 'D1');
  assert.equal(at(T + 151), 'D4');
  assert.equal(at(T + 400), 'D4');
  assert.equal(at(T + 401), 'D5');
});

test('D6: protein bands follow the target, not fixed numbers', () => {
  const protein = (g) => withProtein(T, g).lines[1];
  assert.deepEqual([protein(P).code, protein(P).level], ['D6', 'good']);
  assert.equal(protein(P - 15).level, 'good');
  assert.equal(protein(P - 16).level, 'note');
  assert.equal(protein(P - 45).level, 'note');
  assert.equal(protein(P - 46).level, 'watch');
});

test('D6u: unknown protein stays unknown and says "at least"', () => {
  const entries = [meal('breakfast', 700, { protein: 60 }), meal('lunch', 700, { protein: null }), meal('dinner', 800, { protein: 40 })];
  const out = c.dayCheck({ entries, kcalTarget: T, proteinTarget: P });
  const line = out.lines[1];
  assert.deepEqual([line.code, line.level, line.n.atLeast], ['D6u', 'note', 100]);
  assert.match(said(out.lines)[1], /At least 100 g/);
  entries[0].protein = 150;
  assert.equal(c.dayCheck({ entries, kcalTarget: T, proteinTarget: P }).lines[1].level, 'good');
});

test('D7: low fat is mentioned when protein is fine, and an unknown fat is not guessed', () => {
  assert.equal(day(T, {}, { fat: 10, protein: 55 }).lines[1].code, 'D7'); // 30 g of fat, protein in range
  assert.equal(day(T, {}, { fat: null, protein: 55 }).lines[1].code, 'D6');
  assert.equal(day(T, {}, { fat: 10 }).lines[1].code, 'D6'); // protein is short, so that comes first
});

test('D8: the step tick, with no negative message', () => {
  assert.equal(day(T, { steps: 7000, stepGoal: 6000 }).tick, true);
  assert.equal(day(T, { steps: 3000, stepGoal: 6000 }).tick, false);
  assert.equal(day(T, { steps: null, stepGoal: 6000 }).tick, false);
});

test('D9: one protein reminder from 7 pm, never when the calories are used up', () => {
  const open = (entries, hour) => c.dayCheck({ entries, kcalTarget: T, proteinTarget: P, open: true, hour });
  const few = [meal('breakfast', 400, { protein: 30 }), meal('lunch', 500, { protein: 20 })];
  assert.deepEqual([open(few, 20).evening.code, open(few, 20).evening.n.g], ['D9', 110]);
  assert.equal(open(few, 18).evening, null);
  assert.equal(open([meal('lunch', 2300, { protein: 20 })], 21).evening, null); // nothing left to eat
  assert.deepEqual(open(few, 20).lines, []); // the open day is not judged
});

test('the diet break: the deficit target is not the aim, the floor still is', () => {
  assert.deepEqual(day(T + 600, { maintenance: true }).lines[0], { code: 'DB', level: 'good', n: { kcal: T + 600, T } });
  assert.equal(day(T - 100, { maintenance: true }).lines[0].level, 'note');
  assert.equal(day(1500, { maintenance: true }).lines[0].code, 'D3');
});

// ----- Week check -----

const E0 = '2026-11-11'; // a Wednesday, the end of the latest finished week
const E1 = '2026-11-04';
const E2 = '2026-10-28';
const KEY = '2026-11-12'; // the Thursday after
const put = (days, key, patch) => { days[key] = { ...(days[key] ?? {}), ...patch }; };

function foodFor(kcal, protein = 150) {
  return [meal('breakfast', kcal / 3, { protein: protein / 3 }), meal('lunch', kcal / 3, { protein: protein / 3 }), meal('dinner', kcal / 3, { protein: protein / 3 })];
}
function weekDays(to, { avg = null, weighIns = 5, kcal = 2150, foodDays = 6, sessions = 4, protein = 150, steps = null, water = null } = {}) {
  const out = {};
  for (let i = 0; i < 7; i++) {
    const d = {};
    if (avg !== null && i < weighIns) d.weightKg = avg;
    if (i < foodDays) d.food = foodFor(kcal, protein);
    if (i < sessions) d.session = { type: 'done' };
    if (steps && i < 5) d.steps = steps;
    if (water && i < 5) d.waterMl = water;
    out[r.addDays(to, i - 6)] = d;
  }
  return out;
}
const three = (avgs, latest = {}, older = {}) => ({
  ...weekDays(E2, { avg: avgs[0], ...older }), ...weekDays(E1, { avg: avgs[1], ...older }), ...weekDays(E0, { avg: avgs[2], ...latest }),
});
const run = (days, over = {}) => c.weekCheck({
  key: KEY, days, T, P, targets: { fibre: 30, waterMl: 3000 }, plan: { ...plan, sessionsPerWeek: 4 }, ...over,
});
const line = (out, code) => out.lines.find((l) => l.code === code);

test('on pace: 3 usable weeks, down about 0.87% a week, nothing to change', () => {
  const out = run(three([88.0, 87.2, 86.5], { kcal: 2150 }));
  assert.deepEqual([out.verdict.code, out.verdict.level], ['W11', 'good']);
  assert.equal(out.verdict.n.rate, 0.87);
  assert.deepEqual(out.actions, []);
  assert.deepEqual(out.week, { from: '2026-11-05', to: E0 });
  said([out.verdict, ...out.lines]);
});

test('stalled: flat for 2 weeks with food on target, one choice offered', () => {
  const days = three([86.5, 86.4, 86.5], { kcal: 2170 });
  put(days, E0, { waistCm: 90.0 });
  put(days, E2, { waistCm: 90.2 });
  const out = run(days);
  assert.deepEqual([out.verdict.code, out.verdict.level], ['W8', 'watch']);
  assert.equal(out.verdict.n.rate, 0);
  assert.equal(out.actions[0].code, 'A2');
  assert.equal(out.actions[0].type, 'stall-choice');
  assert.deepEqual(out.actions[0].cut, { kcal: 150, newKcalTarget: T - 150, from: ['carbs', 'fat'] });
  assert.match(said(out.actions)[0], /Pick one: cut 150 kcal from carbs or fat, or add 2,000 steps a day/);
});

test('stalled with a target near the floor: only the steps, never a cut under 1,800', () => {
  const out = run(three([86.5, 86.4, 86.5], { kcal: 1900 }), { T: 1900 });
  assert.equal(out.verdict.code, 'W8');
  assert.equal(out.actions[0].cut, null);
  assert.match(said(out.actions)[0], /^Add 2,000 steps a day/);
});

test('eating above target comes before slow: aim for the target first', () => {
  const out = run(three([88.0, 87.8, 87.3], { kcal: 2550 }));
  assert.deepEqual([out.verdict.code, out.verdict.level], ['W7', 'note']);
  assert.equal(out.verdict.n.rate, 0.4);
  assert.equal(out.verdict.n.kcal, 2550);
});

test('too fast: down 1.66% a week, add 150 kcal from carbs', () => {
  const out = run(three([90.0, 88.6, 87.1]));
  assert.deepEqual([out.verdict.code, out.verdict.level], ['W2', 'watch']);
  assert.equal(out.verdict.n.rate, 1.66);
  assert.deepEqual([out.actions[0].type, out.actions[0].kcal, out.actions[0].from], ['add-kcal', 150, 'carbs']);
  assert.equal(out.actions[0].newKcalTarget, T + 150);
});

test('too fast needs only two weeks, because it is a safety check', () => {
  const days = { ...weekDays(E1, { avg: 90.0 }), ...weekDays(E0, { avg: 88.6 }) };
  const out = run(days);
  assert.equal(out.verdict.code, 'W2');
});

test('the first fortnight: no weight verdict, but food, sessions and lifts still run', () => {
  const days = { ...weekDays('2026-10-14', { avg: 88.5, kcal: 2150 }) };
  const out = run(days, { key: '2026-10-21' });
  assert.deepEqual([out.verdict.code, out.verdict.level, out.verdict.n.why], ['W4', 'note', 'start']);
  assert.equal(out.verdict.n.until, '2026-11-12');
  assert.ok(line(out, 'F2'));
  assert.ok(line(out, 'F7'));
  assert.equal(line(out, 'F1'), undefined);
});

test('before the first full week ends, it says when the first check comes', () => {
  const out = run({}, { key: '2026-10-12' });
  assert.deepEqual([out.verdict.code, out.verdict.n.first], ['W0', '2026-10-14']);
});

test('not enough weigh-ins names what it has, oldest week first', () => {
  const days = { ...weekDays(E2, { avg: 88, weighIns: 3 }), ...weekDays(E1, { avg: 87.5, weighIns: 5 }), ...weekDays(E0, { avg: 87, weighIns: 2 }) };
  const out = run(days);
  assert.deepEqual([out.verdict.code, out.verdict.n.counts], ['W5', [3, 5, 2]]);
  assert.match(said([out.verdict])[0], /I have 3, 5 and 2/);
});

test('a diet break week at maintenance is good, below it is a note', () => {
  const brk = (kcal) => run({ ...weekDays('2027-02-03', { avg: 82, kcal }) }, { key: '2027-02-04' });
  assert.deepEqual([brk(T + 500).verdict.code, brk(T + 500).verdict.level], ['W3', 'good']);
  assert.deepEqual([brk(T).verdict.code, brk(T).verdict.level], ['W3', 'note']);
});

test('recomposing: flat scale, waist down 1.5 cm, 6 of 9 lifts up', () => {
  const days = three([86.5, 86.5, 86.4]);
  put(days, E0, { waistCm: 88.5 });
  put(days, E2, { waistCm: 90.0 });
  const workout = (kg) => ({ session: 'upperA', finished: true, lifts: Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [`lift-${i}`, { sets: [s(i < 6 ? kg : 40, 10), s(i < 6 ? kg : 40, 10)], planned: 2, top: 12 }])) });
  put(days, '2026-10-31', { workout: workout(40) });
  put(days, '2026-11-09', { workout: workout(42.5) });
  const out = run(days);
  assert.deepEqual([out.verdict.code, out.verdict.level], ['W6', 'good']);
  assert.deepEqual([out.verdict.n.up, out.verdict.n.total], [6, 9]);
  assert.equal(line(out, 'F9').level, 'good');
});

test('flat with no waist reading goes to the food rules, not to recomposing', () => {
  assert.equal(run(three([86.5, 86.5, 86.4], { kcal: 2150 })).verdict.code, 'W8');
});

test('three days under 1,800 kcal is the first verdict, and its action is the floor', () => {
  const days = three([88.0, 87.5, 87.0]);
  for (const k of ['2026-11-05', '2026-11-06', '2026-11-07']) put(days, k, { food: foodFor(1500) });
  const out = run(days);
  assert.deepEqual([out.verdict.code, out.verdict.level, out.verdict.n.days], ['W1', 'watch', 3]);
  assert.equal(out.actions[0].type, 'eat-to-floor');
  assert.match(said(out.actions)[0], /at least 1,800 kcal. Your target is 2,200/);
});

test('flat after changing the target: give it time, do not cut again', () => {
  const out = run(three([86.5, 86.4, 86.5], { kcal: 2170 }), { targetChangedOn: '2026-11-03' });
  assert.deepEqual([out.verdict.code, out.verdict.n.until], ['W8c', '2026-11-26']);
  assert.equal(run(three([86.5, 86.4, 86.5], { kcal: 2170 }), { targetChangedOn: '2026-10-20' }).verdict.code, 'W8');
});

test('flat with too few food days, or food well under target: it says it cannot tell', () => {
  assert.equal(run(three([86.5, 86.4, 86.5], { foodDays: 3 })).verdict.code, 'W8a');
  assert.equal(run(three([86.5, 86.4, 86.5], { kcal: 1850 })).verdict.code, 'W8b');
});

test('rising and slow', () => {
  assert.deepEqual([run(three([86.0, 86.4, 87.0], { kcal: 2150 })).verdict.code], ['W9']);
  assert.equal(run(three([88.0, 87.8, 87.4], { kcal: 2150 })).verdict.code, 'W10');
});

test('creatine: no weight verdict for 10 days after the first tick, and it says when it returns', () => {
  const days = three([88.0, 87.2, 86.5]);
  put(days, '2026-11-01', { creatine: true });
  const out = run(days);
  assert.deepEqual([out.verdict.code, out.verdict.n.why, out.verdict.n.until], ['W4', 'creatine', '2026-12-03']);
});

test('actions: at most two, a watch puts its own action first, and food logging is asked for', () => {
  const days = three([86.5, 86.4, 86.5], { kcal: 2170, foodDays: 6, sessions: 1, protein: 90 });
  const out = run(days);
  assert.equal(out.verdict.code, 'W8');
  assert.deepEqual(out.actions.map((a) => a.code), ['A2', 'A4']);
  const sparse = run(three([88.0, 87.2, 86.5], { kcal: 2150, foodDays: 3 }));
  assert.equal(sparse.verdict.code, 'W11');
  assert.equal(sparse.actions[0].code, 'A1');
  assert.equal(line(sparse, 'F2').level, 'none');
});

test('the lines under the verdict, at both of their thresholds', () => {
  const lvl = (out, code) => line(out, code)?.level;
  const base = (over) => run(three([88.0, 87.2, 86.5], over));
  assert.equal(lvl(base({ protein: P - 15 }), 'F3'), 'good');
  assert.equal(lvl(base({ protein: P - 16 }), 'F3'), 'note');
  assert.equal(lvl(base({ protein: P - 46 }), 'F3'), 'watch');
  assert.equal(lvl(base({ kcal: T + 150 }), 'F2'), 'good');
  assert.equal(lvl(base({ kcal: T + 151 }), 'F2'), 'note');
  assert.equal(lvl(base({ kcal: T + 301 }), 'F2'), 'watch');
  assert.equal(lvl(base({ sessions: 3 }), 'F7'), 'good');
  assert.equal(lvl(base({ sessions: 2 }), 'F7'), 'note');
  assert.equal(lvl(base({ sessions: 1 }), 'F7'), 'watch');
  const goal = r.stepTarget(E0, plan.start, plan.steps);
  assert.equal(lvl(base({ steps: goal }), 'F6'), 'good');
  assert.equal(lvl(base({ steps: goal - 1 }), 'F6'), 'note');
  assert.equal(lvl(base({ water: 3000 }), 'F5'), 'good');
  assert.equal(lvl(base({ water: 2900 }), 'F5'), 'note');
  assert.equal(line(base({}), 'F5'), undefined); // not logged on 4 days: no line
  // The plan line: within 1.0 kg good, above it a note, ahead by more than 1.5 kg a note.
  const plan1 = (planLine) => lvl(run(three([88.0, 87.2, 86.5]), { planLine }), 'F10');
  assert.equal(plan1(86.5), 'good');
  assert.equal(plan1(87.6), 'good');
  assert.equal(plan1(85.4), 'note'); // 1.1 above the line
  assert.equal(plan1(88.1), 'note'); // 1.6 ahead of it: check it is not too fast
});

test('F8: a lift down twice running is a watch even on its own', () => {
  const days = three([88.0, 87.2, 86.5]);
  const one = (kg) => ({ session: 'upperA', finished: true, lifts: { 'lat-pulldown': { sets: [s(kg, 10), s(kg, 10)], planned: 2, top: 12 } } });
  put(days, '2026-10-30', { workout: one(50) });
  put(days, '2026-11-02', { workout: one(47.5) });
  put(days, '2026-11-09', { workout: one(45) });
  const f8 = line(run(days), 'F8');
  assert.deepEqual([f8.level, f8.n.down, f8.n.downTwice], ['watch', 1, 1]);
});

// ----- Always true -----

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
}

test('the same input gives the same output, and the input is never changed', () => {
  const days = deepFreeze(three([88.0, 87.2, 86.5], { kcal: 2150 }));
  const input = { key: KEY, days, T, P, targets: { fibre: 30, waterMl: 3000 }, plan: deepFreeze({ ...plan, sessionsPerWeek: 4 }) };
  assert.deepEqual(c.weekCheck(input), c.weekCheck(input));
  const sets = deepFreeze([s(16, 16), s(16, 14), s(16, 12)]);
  assert.deepEqual(c.liftCheck({ sets, lo: 8, hi: 12, kind: 'dumbbell', dumbbells: DB }), c.liftCheck({ sets, lo: 8, hi: 12, kind: 'dumbbell', dumbbells: DB }));
  const entries = deepFreeze(foodFor(2000));
  assert.deepEqual(c.dayCheck({ entries, kcalTarget: T, proteinTarget: P }), c.dayCheck({ entries, kcalTarget: T, proteinTarget: P }));
});

test('safety rails: the constants are the app rules, and an action that breaks one is refused', () => {
  assert.equal(RAILS.kcalFloor, r.KCAL_FLOOR);
  assert.equal(RAILS.kcalFloor, 1800);
  assert.equal(RAILS.fatFloorG, r.FAT_FLOOR);
  assert.equal(RAILS.maxLossKgPerWeek, 1);
  assert.equal(withinRails({ newKcalTarget: 1799 }), false);
  assert.equal(withinRails({ newKcalTarget: 1800 }), true);
  assert.equal(withinRails({ lossKgPerWeek: 1.01 }), false);
  assert.equal(withinRails({ cuts: ['carbs', 'protein'] }), false);
  assert.equal(withinRails({ cuts: ['carbs', 'fat'] }), true);
  assert.equal(withinRails({ newFatG: 49 }), false);
  assert.equal(withinRails(null), true);
});

test('safety rails: no week check, over many made-up weeks, returns an action that breaks one', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let checked = 0;
  for (let i = 0; i < 400; i++) {
    const target = 1700 + Math.round(rnd() * 1000);
    const w = 70 + rnd() * 25;
    const step = (rnd() - 0.6) * 2;
    const days = three([w + step * 2, w + step, w], { kcal: 1300 + rnd() * 1800, foodDays: Math.floor(rnd() * 8), protein: rnd() * 220, sessions: Math.floor(rnd() * 5) });
    const out = run(days, { T: target, targetChangedOn: rnd() > 0.7 ? '2026-11-01' : null });
    for (const a of out.actions) {
      assert.equal(withinRails(a), true, JSON.stringify(a));
      if (a.cut) assert.ok(a.cut.newKcalTarget >= 1800);
      if (a.newKcalTarget !== undefined) assert.ok(a.newKcalTarget >= 1800, `${a.type} to ${a.newKcalTarget}`);
      assert.ok(out.actions.length <= 2);
      checked++;
    }
    assert.ok(codes(out.lines).every((code) => code in WORDS));
    said([out.verdict, ...out.lines, ...out.actions]);
  }
  assert.ok(checked > 50, 'the fuzz should have produced actions to check');
});

test('wording: a sentence exists for every code the Coach can return, and for no other', () => {
  assert.deepEqual([...c.ALL_CODES].sort(), Object.keys(WORDS).sort());
});

test('voice: no banned words, no dashes, British spelling', () => {
  const source = readFileSync(new URL('../js/coach-words.js', import.meta.url), 'utf8')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  for (const banned of ['should', 'must', 'failed', 'lazy', 'cheated', 'bad', 'behind', 'you need to']) {
    assert.doesNotMatch(source, new RegExp(`\\b${banned}\\b`, 'i'), `"${banned}" is in the wording`);
  }
  assert.doesNotMatch(source, /[–—]/, 'a dash is in the wording');
  assert.doesNotMatch(source, /\b(color|center|program|gray|fiber|meter)\b/i, 'an American spelling is in the wording');
});
