// Stress tests for the Coach: random and broken input, checked against rules that must always
// hold. Nothing here is a real person's data.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../js/coach.js';
import * as r from '../js/rules.js';
import { plan } from '../js/plan.js';
import { WORDS, say } from '../js/coach-words.js';
import { RAILS, withinRails } from '../js/coach-constants.js';
import { sessions, muscleOf } from '../js/exercises.js';

const DB = [5, 7, 7.5, 8, 10, 12.5, 15, 17.5, 20];
const LEVELS = ['good', 'note', 'watch', 'none'];
const CODES = new Set(c.ALL_CODES);

function rng(seed) {
  let x = seed;
  const next = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
  next.int = (a, b) => a + Math.floor(next() * (b - a + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  return next;
}

// A sentence must be whole: no gaps where a number should be, no banned word, no dash.
function clean(item, ctx = { T: 2200, dayName: 'Saturday' }) {
  const text = say(item, ctx);
  assert.ok(text.length > 3, `no sentence for ${item.code}`);
  assert.doesNotMatch(text, /undefined|NaN|\[object|null|Infinity|\$\{/, `${item.code}: ${text}`);
  assert.doesNotMatch(text, /\b(should|must|failed|lazy|cheated|bad|behind)\b|you need to|[–—]/i, `${item.code}: ${text}`);
  assert.doesNotMatch(text, / {2}|\.\.|,\./, `${item.code}: ${text}`);
  return text;
}
const valid = (v) => {
  assert.ok(CODES.has(v.code), `unknown code ${v.code}`);
  if (!v.code.startsWith('A')) assert.ok(LEVELS.includes(v.level), `${v.code} has level ${v.level}`);
};

const JUNK = [null, undefined, NaN, -1, 0, 1e9, '12', '', 'abc', {}, [], true, Infinity];

test('lift check: random and broken sets never crash it, and every sentence is whole', () => {
  const rnd = rng(101);
  for (let i = 0; i < 6000; i++) {
    const kind = rnd.pick(['dumbbell', 'machine', 'barbell', 'body', 'kettlebell', undefined]);
    const [lo, hi] = rnd.pick([[6, 10], [8, 12], [10, 15], [12, 20], [1, 1], [20, 12], [0, 5], [NaN, 12]]);
    const sets = Array.from({ length: rnd.int(0, 9) }, () => {
      if (rnd.chance(0.1)) return rnd.pick(JUNK);
      return { kg: rnd.chance(0.15) ? rnd.pick(JUNK) : rnd.pick([...DB, 30, 42.5, 60, 100, 0.5]), reps: rnd.chance(0.1) ? rnd.pick(JUNK) : rnd.int(0, 40) };
    });
    const input = {
      sets, lo, hi, kind, dumbbells: rnd.chance(0.1) ? rnd.pick([[], [20], [20, 5, 10]]) : DB,
      planned: rnd.pick([1, 2, 3, 4, 0, undefined]), effort: rnd.pick([null, [1, 3], [4, 4]]),
      firstTime: rnd.chance(0.3), alt: rnd.chance(0.05), hasAlt: rnd.chance(0.5), load: rnd.pick([null, 'ramp', 'full', 'half']),
    };
    const out = c.liftCheck(input);
    assert.ok(Array.isArray(out));
    assert.ok(out.filter((v) => v.code !== 'L9').length <= 1, 'more than one weight verdict for a lift');
    out.forEach((v) => { valid(v); clean(v); });
    assert.deepEqual(c.liftCheck(input), out, 'the same input gave a different answer');
    if (input.alt) assert.deepEqual(out, []);
  }
});

test('lift check: a real set always gets exactly one verdict, and its level fits where the reps landed', () => {
  const rnd = rng(202);
  for (let i = 0; i < 4000; i++) {
    const kind = rnd.pick(['dumbbell', 'machine', 'barbell']);
    const [lo, hi] = rnd.pick([[6, 10], [8, 12], [10, 15], [12, 20]]);
    const kg = kind === 'dumbbell' ? rnd.pick(DB) : rnd.pick([20, 40, 60, 80]);
    const reps = rnd.int(1, 30);
    const main = c.liftCheck({ sets: [{ kg, reps }], lo, hi, kind, dumbbells: DB, planned: 1 })[0];
    assert.ok(main, 'a logged set got no verdict');
    if (reps < lo - 2) assert.equal(main.level, 'watch');
    else if (reps < lo) assert.equal(main.level, 'note');
    else if (reps <= hi + 2) assert.equal(main.level, 'good');
    else assert.equal(main.level, 'note'); // well above: good news, but worth knowing
    // It never tells you to use a weight you do not own, or one that does not exist.
    const text = clean(main);
    for (const m of text.matchAll(/([\d.]+) kg/g)) {
      const w = Number(m[1]);
      assert.ok(w > 0, text);
      if (kind === 'dumbbell') assert.ok(DB.includes(w) || w === kg, `${text} (dumbbells are ${DB})`);
    }
  }
});

test('sets check and session check: broken input never crashes them', () => {
  const rnd = rng(303);
  for (let i = 0; i < 4000; i++) {
    const sets = Array.from({ length: rnd.int(0, 9) }, () => (rnd.chance(0.1) ? rnd.pick(JUNK) : { kg: rnd.pick([...DB, undefined, 40]), reps: rnd.int(0, 25) }));
    const out = c.setsCheck({ sets, planned: rnd.pick([1, 2, 3, 4, 0, undefined, NaN]), load: rnd.pick(['ramp', 'full', 'half', undefined]), lastKg: rnd.pick([null, 10, 40, NaN, undefined]) });
    out.forEach((v) => { valid(v); clean(v); });
    assert.ok(out.length <= 2);
    const counts = Array.from({ length: rnd.int(0, 9) }, () => rnd.int(0, 4));
    const sess = c.sessionCheck({ minimum: rnd.chance(0.3), finished: rnd.chance(0.7), counts });
    if (sess) { valid(sess); clean(sess); }
  }
  assert.deepEqual(c.setsCheck({}), []);
  assert.equal(c.sessionCheck({}), null);
  assert.equal(c.ceilingCheck({}), null);
});

// ----- Day check -----

const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'];
function randomEntries(rnd, { junk = 0.05 } = {}) {
  return Array.from({ length: rnd.int(0, 9) }, () => {
    const num = (max) => (rnd.chance(junk) ? rnd.pick([null, undefined]) : Math.round(rnd() * max * 10) / 10);
    return { meal: rnd.chance(0.05) ? undefined : rnd.pick(MEALS), kcal: Math.round(rnd() * 1200), protein: num(80), carbs: num(150), fat: num(50), fibre: num(15) };
  });
}

test('day check: holds its rules over thousands of random days', () => {
  const rnd = rng(404);
  for (let i = 0; i < 8000; i++) {
    const T = rnd.pick([1700, 1800, 2000, 2200, 2600, 3200]);
    const P = rnd.pick([120, 150, 170, 200]);
    const entries = randomEntries(rnd, { junk: rnd.chance(0.5) ? 0 : 0.2 });
    const open = rnd.chance(0.2);
    const input = { entries, kcalTarget: T, proteinTarget: P, steps: rnd.pick([null, 0, 3000, 9000]), stepGoal: rnd.pick([null, 5000, 8000]), maintenance: rnd.chance(0.1), open, hour: rnd.pick([null, 8, 19, 23, 25]) };
    const out = c.dayCheck(input);
    assert.deepEqual(c.dayCheck(input), out);
    [...out.lines, ...(out.evening ? [out.evening] : [])].forEach((v) => { valid(v); clean(v); });
    assert.ok(out.lines.length <= 2, 'a day card has at most two lines');
    const kcal = entries.reduce((a, e) => a + e.kcal, 0);
    const meals = new Set(entries.map((e) => e.meal ?? 'other')).size;
    if (open) { assert.deepEqual(out.lines, []); continue; }
    assert.equal(out.evening, null, 'a closed day has no evening reminder');
    // A short log is never judged, however it adds up.
    if (kcal < 1200 || meals < 2) {
      assert.deepEqual(out.lines.map((l) => l.code), ['D0']);
      assert.equal(out.judgeable, false);
      continue;
    }
    assert.equal(out.judgeable, true);
    const [energy, second] = out.lines;
    // A day over target is never a watch. Only the floor is.
    if (kcal >= RAILS.kcalFloor) assert.notEqual(energy.level, 'watch', `${kcal} of ${T} gave ${energy.code}`);
    else assert.deepEqual([energy.code, energy.level], ['D3', 'watch']);
    // Unknown protein is never reported as a number that was eaten.
    if (entries.some((e) => e.protein == null)) assert.ok(['D6u', 'D7'].includes(second.code), `unknown protein gave ${second.code}`);
    // No sentence ever says to eat less.
    for (const l of out.lines) assert.doesNotMatch(clean(l), /eat less|cut|skip/i);
  }
});

// ----- Week check -----

// A made-up person's log from the plan start: weight drifting, with gaps and noise.
function randomLog(rnd, { until = '2027-03-20' } = {}) {
  const days = {};
  let kg = 80 + rnd() * 20;
  const drift = (rnd() - 0.7) * 0.3;
  const weighP = rnd.pick([0.2, 0.6, 0.9, 1]);
  const foodP = rnd.pick([0.1, 0.5, 0.9, 1]);
  const kcal = rnd.pick([1500, 1900, 2200, 2500, 3000]);
  const creatineFrom = rnd.chance(0.5) ? r.addDays(plan.start, rnd.int(0, 120)) : null;
  for (let k = plan.start; k <= until; k = r.addDays(k, 1)) {
    kg += drift + (rnd() - 0.5) * 0.4;
    const d = {};
    if (rnd.chance(weighP)) d.weightKg = Math.round(kg * 10) / 10;
    if (rnd.chance(foodP)) {
      d.food = Array.from({ length: rnd.int(1, 5) }, () => ({ meal: rnd.pick(MEALS), kcal: Math.round((kcal / 3) * (0.5 + rnd())), protein: rnd.chance(0.1) ? null : rnd.int(5, 70), fat: rnd.chance(0.1) ? null : rnd.int(2, 40), fibre: rnd.chance(0.4) ? null : rnd.int(0, 15) }));
    }
    if (rnd.chance(0.5)) d.steps = rnd.int(0, 14000);
    if (rnd.chance(0.4)) d.waterMl = rnd.int(0, 4500);
    if (rnd.chance(0.08)) d.waistCm = Math.round((85 + rnd() * 10) * 10) / 10;
    if (creatineFrom && k >= creatineFrom && rnd.chance(0.8)) d.creatine = true;
    if (rnd.chance(0.45)) {
      d.session = { type: rnd.pick(['done', 'done', 'min', 'missed']) };
      if (d.session.type !== 'missed') {
        const id = rnd.pick(Object.keys(sessions));
        d.workout = { session: id, finished: true, minimum: d.session.type === 'min', half: rnd.chance(0.1), lifts: Object.fromEntries(
          sessions[id].filter(() => rnd.chance(0.8)).map((ex) => [ex.id, {
            sets: Array.from({ length: rnd.int(1, 4) }, () => (ex.kind === 'body' ? { reps: rnd.int(3, 20) } : { kg: rnd.pick([10, 20, 30, 40]), reps: rnd.int(3, 20) })),
            planned: ex.sets, top: ex.reps[1], ...(rnd.chance(0.05) ? { alt: true } : {}),
          }])) };
      }
    }
    if (Object.keys(d).length) days[k] = d;
  }
  return days;
}

test('week check: every day of a made-up plan, for many made-up people', () => {
  const rnd = rng(505);
  const seen = new Set();
  for (let person = 0; person < 40; person++) {
    const days = randomLog(rnd);
    const T = rnd.pick([1700, 1850, 1900, 2150, 2400, 3000]);
    const P = rnd.pick([130, 160, 180]);
    const changed = rnd.chance(0.4) ? r.addDays(plan.start, rnd.int(10, 150)) : null;
    const base = { days, T, P, targets: { fibre: 30, waterMl: 3000 }, plan: { ...plan, sessionsPerWeek: 4 }, targetChangedOn: changed };
    let lastWeek = null;
    let lastOut = null;
    for (let key = r.addDays(plan.start, -3); key <= '2027-03-25'; key = r.addDays(key, 1)) {
      const planLine = r.planWeight(c.weekEnd(key, plan.weekStartDow), plan, 92, 80);
      const out = c.weekCheck({ ...base, key, planLine });
      valid(out.verdict);
      seen.add(out.verdict.code);
      const said = [clean(out.verdict, { T }), ...out.lines.map((l) => clean(l, { T })), ...out.actions.map((a) => clean(a, { T }))].join(' ');
      for (const m of said.matchAll(/(?:Aim for|at least|Raise it to|against|measured against) ([\d,]+)(?: kcal| first| or more|\.)/g)) {
        const n = Number(m[1].replace(/,/g, ''));
        if (n >= 1000) assert.ok(n >= RAILS.kcalFloor, `advice under the floor: "${m[0]}" in: ${said}`);
      }
      assert.ok(out.actions.length <= 2, 'more than two actions');
      assert.equal(new Set(out.actions.map((a) => a.code)).size, out.actions.length, 'the same action twice');
      for (const a of out.actions) {
        valid(a);
        const text = clean(a, { T });
        assert.equal(withinRails(a), true);
        if (a.cut) assert.ok(a.cut.newKcalTarget >= RAILS.kcalFloor, `a cut to ${a.cut.newKcalTarget}`);
        if (a.newKcalTarget !== undefined) assert.ok(a.newKcalTarget >= RAILS.kcalFloor);
        assert.doesNotMatch(text, /protein.*cut|cut.*protein/i);
      }
      // When the verdict is a watch with its own action, that action is first.
      // Safety and the stall choice go first: a target under the floor, then the verdict's own
      // urgent action. Anything else waits behind the log.
      if (T < RAILS.kcalFloor) assert.equal(out.actions[0]?.code, 'A0');
      const urgent = out.actions.findIndex((a) => a.urgent);
      if (urgent >= 0) assert.ok(urgent <= (T < RAILS.kcalFloor ? 1 : 0), `an urgent action sat at ${urgent}`);
      if (['W1', 'W2', 'W8'].includes(out.verdict.code)) assert.ok(out.actions.some((a) => a.code === 'A2' && a.urgent) || T < RAILS.kcalFloor);
      const codes = out.lines.map((l) => l.code);
      assert.equal(new Set(codes).size, codes.length, 'the same line twice');
      for (const l of out.lines) {
        valid(l);
        const text = clean(l, { T });
        assert.doesNotMatch(text, /\b0 kcal\b|from 0 days|\b0 g average/, text);
      }
      // A week is judged once: the verdict does not move as the days of the next week go by.
      // The one exception is the day the calorie target is changed: "pick one" becomes "give it time".
      if (out.week && lastWeek === out.week.to && key !== changed) {
        assert.deepEqual([out.verdict, out.actions, out.lines], lastOut, `the verdict for the week to ${out.week.to} changed on ${key}`);
      }
      lastWeek = out.week?.to ?? null;
      lastOut = [out.verdict, out.actions, out.lines];
      // No weight verdict without the weigh-ins to back it.
      if (out.week && ['W2', 'W6', 'W7', 'W8', 'W8a', 'W8b', 'W8c', 'W9', 'W10', 'W11'].includes(out.verdict.code)) {
        const span = (to) => Array.from({ length: 7 }, (_, i) => r.addDays(to, i - 6)).filter((k) => days[k]?.weightKg).length;
        assert.ok(span(out.week.to) >= 4, `${out.verdict.code} on ${key} with ${span(out.week.to)} weigh-ins`);
        assert.ok(span(r.addDays(out.week.to, -7)) >= 4);
      }
      // No food verdict from too few days.
      if (['W7', 'W8', 'W8b'].includes(out.verdict.code)) assert.ok(out.verdict.n.days >= 5);
      // "Cut" is only ever offered when the scale was flat and food was on target.
      if (out.actions.some((a) => a.cut)) assert.equal(out.verdict.code, 'W8');
    }
  }
  // The made-up people should have reached most of the verdicts, or this test proves little.
  for (const code of ['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W7', 'W9', 'W10', 'W11']) assert.ok(seen.has(code), `${code} was never reached`);
});

test('week check: broken data never crashes it', () => {
  const rnd = rng(606);
  for (let i = 0; i < 300; i++) {
    const days = {};
    for (let k = plan.start; k <= '2026-12-20'; k = r.addDays(k, 1)) {
      if (rnd.chance(0.3)) continue;
      days[k] = {
        weightKg: rnd.pick([...JUNK, 80, 81.5]), waistCm: rnd.pick([...JUNK, 90]), steps: rnd.pick([...JUNK, 7000]), waterMl: rnd.pick([...JUNK, 2000]),
        food: rnd.pick([undefined, null, [], 'x', [null], [{}], [{ kcal: 'a' }], [{ meal: 'lunch', kcal: 900 }, { meal: 'dinner', kcal: 900, protein: 'x' }]]),
        session: rnd.pick([undefined, null, {}, { type: 'done' }, { type: 7 }]),
        workout: rnd.pick([undefined, null, {}, { lifts: null }, { lifts: { a: null, b: 'x', c: { sets: 'no' }, d: { sets: [null, { kg: 'x', reps: 5 }] } } }]),
        creatine: rnd.pick([undefined, true, 'yes']),
      };
    }
    const key = r.addDays(plan.start, rnd.int(0, 80));
    const out = c.weekCheck({ key, days, T: rnd.pick([2200, NaN, undefined]), P: rnd.pick([160, NaN, undefined]), targets: {}, plan: { ...plan, sessionsPerWeek: 4 }, planLine: rnd.pick([null, NaN, 85]) });
    valid(out.verdict);
    out.lines.forEach(valid);
    c.liftTrends({ days, from: r.addDays(key, -7), to: key });
    c.weeklySets({ days, from: r.addDays(key, -7), to: key, muscleOf });
    c.waistChange(days, key);
  }
});

test('every code the stress tests reached has a sentence, and every sentence is used by some code', () => {
  assert.deepEqual([...CODES].sort(), Object.keys(WORDS).sort());
});

test('week check: a damaged target date or an impossible day never crashes it', () => {
  const days = { '2026-13-45': { creatine: true, weightKg: 80 }, '2026-02-30': { creatine: true }, '2026-11-10': { weightKg: 80 } };
  for (const targetChangedOn of ['zzz', '2026-13-45', 20261103, {}, '', '2026-11-03']) {
    const out = c.weekCheck({ key: '2026-11-12', days, T: 2200, P: 160, targets: {}, plan: { ...plan, sessionsPerWeek: 4 }, targetChangedOn });
    valid(out.verdict);
    clean(out.verdict);
  }
});
