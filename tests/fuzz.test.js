// Throws thousands of random but repeatable situations at the rules and checks things that
// must always hold. A failure prints the seed, so it can be replayed.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../js/rules.js';
import { plan } from '../js/plan.js';

// Small repeatable random number generator.
const rng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const RUNS = 3000;
const SPAN = r.diffDays(plan.end, plan.start);

// The app only lets a day up to today be marked, so that is what the log holds.
function randomLog(rand, today) {
  const log = {};
  const count = Math.floor(rand() * 120);
  const reach = Math.max(1, r.diffDays(today, plan.start) + 11);
  for (let i = 0; i < count; i++) {
    const key = r.addDays(plan.start, Math.floor(rand() * reach) - 10);
    const type = pick(rand, ['done', 'done', 'min', 'missed']);
    log[key] = { type };
    if (type !== 'missed' && rand() < 0.5) log[key].id = pick(rand, [...plan.cycle, 'nonsense', undefined]);
    if (type === 'missed' && rand() < 0.3) log[key].reason = 'Sick';
  }
  return log;
}

test('schedule: never breaks, and what comes next always follows the cycle', () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const rand = rng(seed);
    const today = r.addDays(plan.start, Math.floor(rand() * (SPAN + 60)) - 20);
    const log = randomLog(rand, today);
    const days = r.schedule(plan, log, today);
    const where = `seed ${seed}, today ${today}`;

    assert.equal(days[0].key, plan.start, where);
    assert.ok(days.at(-1).key >= plan.end && days.at(-1).key >= today, `covers today and the plan end, ${where}`);
    for (const d of days) {
      if (d.state === 'rest') assert.equal(d.session, null, where);
      else assert.ok(plan.cycle.includes(d.session), `${d.key} ${d.state} has session ${d.session}, ${where}`);
      if (d.state === 'missed') assert.ok(d.key <= today, `a miss in the future, ${where}`);
      if (d.state === 'planned') assert.ok(d.key >= today, `a past day still planned, ${where}`);
    }
    // From today on, the planned sessions run through the cycle in order with no skips.
    const ahead = days.filter((d) => d.state === 'planned').map((d) => plan.cycle.indexOf(d.session));
    for (let i = 1; i < ahead.length; i++) {
      assert.equal(ahead[i], (ahead[i - 1] + 1) % plan.cycle.length, `cycle order broken, ${where}`);
    }
    // And the first of them follows the last session actually done.
    const lastDone = days.filter((d) => (d.state === 'done' || d.state === 'min') && d.key < (days.find((x) => x.state === 'planned')?.key ?? '9')).at(-1);
    if (lastDone && ahead.length) {
      assert.equal(ahead[0], (plan.cycle.indexOf(lastDone.session) + 1) % plan.cycle.length, `next does not follow the last done, ${where}`);
    }

    const next = r.nextUp(days, today);
    if (next) assert.ok(next.key >= today, where);
    const run = r.missedRun(days, today);
    assert.ok(run.count >= 0 && Number.isInteger(run.count), where);
    assert.ok(r.weekStrip(days, today, plan.weekStartDow).length <= 7, where);
  }
});

test('schedule: entries dated after today (a changed rollover time, a wrong clock) do not break it', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const rand = rng(seed);
    const log = randomLog(rand, plan.end);
    const today = r.addDays(plan.start, Math.floor(rand() * SPAN));
    const days = r.schedule(plan, log, today);
    for (const d of days) assert.ok(d.state === 'rest' ? d.session === null : plan.cycle.includes(d.session), `seed ${seed}`);
  }
});

test('phases and step target: defined for any date', () => {
  for (let i = -30; i < SPAN + 60; i++) {
    const key = r.addDays(plan.start, i);
    const phase = r.phaseFor(key, plan.phases);
    if (key >= plan.start) assert.ok(phase, `no phase on ${key}`);
    const steps = r.stepTarget(key, plan.start, plan.steps);
    assert.ok(steps >= plan.steps.from && steps <= plan.steps.target, `${steps} steps on ${key}`);
    const moved = r.shiftPhases(plan.phases, key, 7);
    for (let p = 1; p < moved.length; p++) {
      assert.equal(moved[p].start, r.addDays(moved[p - 1].end, 1), `a gap or overlap between phases after a shift on ${key}`);
    }
  }
});

test('plan line: only ever goes down, from the start weight to the goal', () => {
  let before = 90;
  for (let i = -5; i < SPAN + 30; i++) {
    const kg = r.planWeight(r.addDays(plan.start, i), plan, 90, 76);
    assert.ok(kg <= before && kg >= 76 && kg <= 90, `${kg} kg on day ${i}`);
    before = kg;
  }
});

test('food maths: never produces a broken number', () => {
  const rand = rng(7);
  const odd = [0, 0.5, 1, 3, 150, 9999, 1e7];
  for (let i = 0; i < RUNS; i++) {
    const food = { kcal: pick(rand, odd), protein: pick(rand, odd), carbs: pick(rand, odd), fat: pick(rand, odd) };
    if (rand() < 0.5) Object.assign(food, { byGrams: true, grams: pick(rand, [1, 40, 100, 158]) });
    const p = r.portion(food, pick(rand, odd));
    const t = r.totals([p, p, {}]);
    for (const v of [...Object.values(p), ...Object.values(t)]) assert.ok(Number.isFinite(v) && v >= 0, `got ${v}`);
  }
});

test('stall check and weight average: cope with any pattern of weigh-ins', () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const rand = rng(seed);
    const days = {};
    let kg = 80 + rand() * 20;
    for (let i = 0; i < 60; i++) {
      kg += (rand() - 0.6) * 0.8;
      const d = {};
      if (rand() < 0.6) d.weightKg = Math.round(kg * 10) / 10;
      if (rand() < 0.12) d.waistCm = 90 + Math.round(rand() * 10);
      if (Object.keys(d).length) days[r.addDays(plan.start, i)] = d;
    }
    const key = r.addDays(plan.start, Math.floor(rand() * 70));
    const s = r.stallCheck(days, key, plan.start);
    assert.ok(['need-data', 'ok', 'fast', 'stall', 'recomp'].includes(s.status), `seed ${seed}: ${s.status}`);
    const avg = r.weightAverage(days, key);
    assert.ok(avg === null || (avg > 50 && avg < 130), `seed ${seed}: average ${avg}`);
  }
});

test('jump rule: every answer is one it is allowed to give, and never a lighter weight', () => {
  const rand = rng(11);
  const kinds = ['barbell', 'machine', 'dumbbell', 'body'];
  for (let i = 0; i < RUNS; i++) {
    const ex = { kind: pick(rand, kinds), reps: pick(rand, [[6, 10], [8, 12], [12, 20]]) };
    const kg = pick(rand, [0, 2.5, 5, 7.5, 20, 22.5, 60, 140, undefined]);
    const reps = Math.floor(rand() * 30);
    const last = rand() < 0.1 ? null : {
      sets: Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({ kg, reps })),
      planned: 1 + Math.floor(rand() * 3), top: rand() < 0.5 ? ex.reps[1] : undefined, rirLo: pick(rand, [0, 1, 2, 3]),
    };
    const p = r.progression(ex, last, plan.dumbbells);
    assert.ok(['start', 'body', 'hold', 'jump', 'extra', 'cap'].includes(p.type), `got ${p.type}`);
    if (p.to != null) assert.ok(p.to > p.kg, `jump from ${p.kg} to ${p.to}`);
    if (p.type === 'jump' || p.type === 'cap' || p.type === 'extra') assert.ok(reps >= (last.top ?? ex.reps[1]), 'a jump without top reps');
  }
});
