import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../js/rules.js';
import { plan } from '../js/plan.js';

const sched = (today, log = {}) => r.schedule(plan, log, today);
const on = (days, key) => days.find((d) => d.key === key);

test('dayKey: before 4 am Kuwait time is still yesterday', () => {
  assert.equal(r.dayKey(new Date('2026-10-10T22:00:00Z')), '2026-10-10'); // 1 am on the 11th
  assert.equal(r.dayKey(new Date('2026-10-11T00:59:00Z')), '2026-10-10'); // 3:59 am
  assert.equal(r.dayKey(new Date('2026-10-11T01:00:00Z')), '2026-10-11'); // 4:00 am
});

test('phaseFor: picks the phase by date', () => {
  assert.equal(r.phaseFor('2026-10-07', plan.phases), null);
  assert.equal(r.phaseFor('2026-10-08', plan.phases).name, 'Foundation phase');
  assert.equal(r.phaseFor('2026-10-28', plan.phases).name, 'Foundation phase');
  assert.equal(r.phaseFor('2026-10-29', plan.phases).name, 'Build phase');
  assert.equal(r.phaseFor('2026-12-12', plan.phases).name, 'Deload week');
  assert.equal(r.phaseFor('2027-02-01', plan.phases).name, 'Diet break and deload');
  assert.equal(r.phaseFor('2027-06-01', plan.phases).name, 'Finish phase');
});

test('stepTarget: 5,000 rising 1,000 a week to 8,000', () => {
  const t = (k) => r.stepTarget(k, plan.start, plan.steps);
  assert.equal(t('2026-10-08'), 5000);
  assert.equal(t('2026-10-14'), 5000);
  assert.equal(t('2026-10-15'), 6000);
  assert.equal(t('2026-10-29'), 8000);
  assert.equal(t('2027-01-01'), 8000);
});

test('schedule: on plan, sessions follow the cycle on planned days', () => {
  const days = sched('2026-10-10', { '2026-10-08': { type: 'done' } });
  assert.equal(days[0].key, plan.start);
  assert.equal(days.at(-1).key, plan.end);
  assert.deepEqual(
    ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-13', '2026-10-15'].map((k) => [on(days, k).state, on(days, k).session]),
    [['done', 'upperA'], ['rest', null], ['planned', 'lowerA'], ['planned', 'upperB'], ['planned', 'lowerB'], ['planned', 'upperA']],
  );
  assert.equal(on(days, '2026-10-10').isToday, true);
});

test('schedule: a passed planned day with nothing logged is missed, and the session stays next', () => {
  const days = sched('2026-10-11', { '2026-10-08': { type: 'done' } }); // Saturday passed
  assert.equal(on(days, '2026-10-10').state, 'missed');
  assert.equal(on(days, '2026-10-10').auto, true);
  assert.equal(on(days, '2026-10-10').session, 'lowerA');
  assert.equal(on(days, '2026-10-11').session, 'lowerA'); // lands on the next planned day
  assert.equal(on(days, '2026-10-13').session, 'upperB'); // everything after moves along
  assert.equal(on(days, '2026-10-15').session, 'lowerB');
});

test('schedule: a marked miss keeps its reason, and today can be marked missed', () => {
  const days = sched('2026-10-10', { '2026-10-08': { type: 'missed', reason: 'Sick' }, '2026-10-10': { type: 'missed' } });
  assert.equal(on(days, '2026-10-08').reason, 'Sick');
  assert.equal(on(days, '2026-10-08').auto, false);
  assert.equal(on(days, '2026-10-10').state, 'missed');
  assert.equal(on(days, '2026-10-11').session, 'upperA');
});

test('schedule: training on a rest day takes the next session and re-flows the rest', () => {
  const days = sched('2026-10-10', { '2026-10-08': { type: 'done' }, '2026-10-09': { type: 'min' } });
  assert.deepEqual([on(days, '2026-10-09').state, on(days, '2026-10-09').session], ['min', 'lowerA']);
  assert.equal(on(days, '2026-10-10').session, 'upperB');
});

test('weekStrip: Thursday to Wednesday', () => {
  const strip = r.weekStrip(sched('2026-10-10'), '2026-10-10', plan.weekStartDow);
  assert.deepEqual(strip.map((d) => d.key), [
    '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14',
  ]);
});

test('nextUp: today if still to do, else the next planned day', () => {
  assert.equal(r.nextUp(sched('2026-10-10'), '2026-10-10').key, '2026-10-10');
  assert.equal(r.nextUp(sched('2026-10-09'), '2026-10-09').key, '2026-10-10');
  const doneToday = sched('2026-10-10', { '2026-10-10': { type: 'done' } });
  assert.equal(r.nextUp(doneToday, '2026-10-10').key, '2026-10-11');
});

test('missedRun: counts misses in a row, a done or minimum session ends it', () => {
  assert.deepEqual(r.missedRun(sched('2026-10-16'), '2026-10-16'), { count: 5, firstKey: '2026-10-08' });
  const withMin = sched('2026-10-16', { '2026-10-11': { type: 'min' } });
  assert.deepEqual(r.missedRun(withMin, '2026-10-16'), { count: 2, firstKey: '2026-10-13' });
  assert.equal(r.missedRun(sched('2026-10-08'), '2026-10-08').count, 0);
});

test('shiftPhases: current end and later phases move, finished ones stay', () => {
  const moved = r.shiftPhases(plan.phases, '2026-11-03', 7);
  assert.deepEqual(moved[0], plan.phases[0]); // Foundation is over
  assert.deepEqual([moved[1].start, moved[1].end], ['2026-10-29', '2026-12-16']);
  assert.deepEqual([moved[2].start, moved[2].end], ['2026-12-17', '2026-12-23']);
  assert.deepEqual([moved[5].start, moved[5].end], ['2027-02-18', undefined]);
});

const phase = (name) => plan.phases.find((p) => p.name.startsWith(name));
const DB = plan.dumbbells;

test('setsFor: Foundation ramps in, deload halves, minimum is 2', () => {
  const squat = { sets: 3, main: true };
  const curl = { sets: 3, main: false };
  const f = phase('Foundation');
  assert.equal(r.setsFor(squat, f, '2026-10-10'), 2); // first week: 2 sets of everything
  assert.equal(r.setsFor(squat, f, '2026-10-15'), 3); // after: full sets on main lifts
  assert.equal(r.setsFor(curl, f, '2026-10-15'), 2); // and 2 on isolation work
  assert.equal(r.setsFor(curl, phase('Build'), '2026-11-01'), 3);
  assert.equal(r.setsFor(squat, phase('Deload'), '2026-12-11'), 2); // half of 3, rounded up
  assert.equal(r.setsFor({ sets: 2, main: true }, phase('Deload'), '2026-12-11'), 1);
  assert.equal(r.setsFor(squat, phase('Build'), '2026-11-01', true), 2); // minimum session
});

test('targetRir: follows the phase', () => {
  assert.deepEqual(r.targetRir(phase('Foundation'), '2026-10-10'), [3, 4]);
  assert.deepEqual(r.targetRir(phase('Foundation'), '2026-10-20'), [2, 3]);
  assert.deepEqual(r.targetRir(phase('Build'), '2026-11-01'), [1, 3]);
  assert.deepEqual(r.targetRir(phase('Build'), '2026-11-01', true), [0, 1]); // last isolation set
  assert.deepEqual(r.targetRir(phase('Push'), '2026-12-20', true), [0, 2]);
  assert.deepEqual(r.targetRir(phase('Deload'), '2026-12-11'), [4, 4]);
});

test('nextWeight: barbell 2.5 kg, machine 5 kg, dumbbell the next one up', () => {
  assert.equal(r.nextWeight('barbell', 40, DB), 42.5);
  assert.equal(r.nextWeight('machine', 40, DB), 45);
  assert.equal(r.nextWeight('dumbbell', 7.5, DB), 8);
  assert.equal(r.nextWeight('dumbbell', 20, DB), null);
  assert.equal(r.nextWeight('body', 0, DB), null);
});

test('progression: the jump rule', () => {
  const squat = { kind: 'barbell', reps: [6, 10] };
  const set = (kg, reps, rir) => ({ kg, reps, rir });
  assert.deepEqual(r.progression(squat, null, DB), { type: 'start' });
  // not every set at the top yet
  assert.deepEqual(r.progression(squat, { sets: [set(40, 10, 2), set(40, 10, 2), set(40, 9, 1)], planned: 3, rirLo: 1 }, DB), { type: 'hold', kg: 40 });
  // top of the range on every set, at the asked effort
  assert.deepEqual(r.progression(squat, { sets: [set(40, 10, 2), set(40, 10, 1), set(40, 10, 1)], planned: 3, rirLo: 1 }, DB), { type: 'jump', kg: 40, to: 42.5 });
  // top reps, but ground out harder than the phase asked: not earned
  assert.deepEqual(r.progression(squat, { sets: [set(40, 10, 2), set(40, 10, 1), set(40, 10, 0)], planned: 3, rirLo: 1 }, DB), { type: 'hold', kg: 40 });
  // the same sets in a phase that allows 0 in reserve do earn it
  assert.equal(r.progression(squat, { sets: [set(40, 10, 2), set(40, 10, 1), set(40, 10, 0)], planned: 3, rirLo: 0 }, DB).type, 'jump');
  // fewer sets than planned does not count
  assert.equal(r.progression(squat, { sets: [set(40, 10, 2), set(40, 10, 2)], planned: 3, rirLo: 1 }, DB).type, 'hold');
});

test('progression: big jumps need extra reps, and the heaviest dumbbell points to the alternative', () => {
  const raise = { kind: 'dumbbell', reps: [12, 20] };
  const sets = (kg, reps) => ({ sets: [{ kg, reps, rir: 2 }, { kg, reps, rir: 2 }], planned: 2, rirLo: 1 });
  assert.deepEqual(r.progression(raise, sets(5, 20), DB), { type: 'extra', kg: 5, to: 7, need: 23 }); // 5 to 7 kg is 40%
  assert.deepEqual(r.progression(raise, sets(5, 23), DB), { type: 'jump', kg: 5, to: 7 });
  assert.deepEqual(r.progression(raise, sets(7.5, 20), DB), { type: 'jump', kg: 7.5, to: 8 }); // a small step
  assert.deepEqual(r.progression(raise, sets(20, 20), DB), { type: 'cap', kg: 20 });
  assert.deepEqual(r.progression({ kind: 'body', reps: [6, 12] }, sets(0, 12), DB), { type: 'body' });
});

test('wentBackwards: two drops in a row', () => {
  const s = (kg, reps) => r.bestSet([{ kg, reps }]);
  assert.equal(r.wentBackwards([s(40, 10), s(40, 9), s(40, 8)]), true);
  assert.equal(r.wentBackwards([s(40, 10), s(40, 9), s(40, 10)]), false);
  assert.equal(r.wentBackwards([s(40, 9), s(40, 8)]), false); // needs three sessions
});

test('portion: by weight and by serving', () => {
  const strips = { byGrams: true, grams: 100, kcal: 200, protein: 16, carbs: 12, fat: 9, fibre: 0.8 };
  assert.deepEqual(r.portion(strips, 150), { kcal: 300, protein: 24, carbs: 18, fat: 13.5, fibre: 1.2 });
  const roti = { kcal: 110, protein: 3, carbs: 22, fat: 1.5 }; // no fibre given
  assert.deepEqual(r.portion(roti, 2), { kcal: 220, protein: 6, carbs: 44, fat: 3, fibre: 0 });
  assert.deepEqual(r.portion(roti, 0.5), { kcal: 55, protein: 1.5, carbs: 11, fat: 0.8, fibre: 0 });
});

test('totals: adds entries and copes with an empty day', () => {
  assert.deepEqual(r.totals([]), { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });
  assert.deepEqual(
    r.totals([{ kcal: 300, protein: 24, carbs: 18, fat: 13.5, fibre: 1.2 }, { kcal: 110, protein: 3, carbs: 22, fat: 1.5 }]),
    { kcal: 410, protein: 27, carbs: 40, fat: 15, fibre: 1.2 },
  );
});

test('mealFor and localHour: meal guessed from Kuwait time', () => {
  assert.equal(r.localHour(new Date('2026-10-10T05:30:00Z')), 8);
  assert.equal(r.localHour(new Date('2026-10-10T22:30:00Z')), 1);
  assert.deepEqual([1, 8, 13, 17, 21].map(r.mealFor), ['dinner', 'breakfast', 'lunch', 'snack', 'dinner']);
});

test('targetWarnings: warns under the calorie and fat floors, never blocks', () => {
  assert.equal(r.targetWarnings({ kcal: 2000, fat: 60 }).length, 0);
  assert.equal(r.targetWarnings({ kcal: 1799, fat: 60 }).length, 1);
  assert.equal(r.targetWarnings({ kcal: 1700, fat: 40 }).length, 2);
  assert.equal(r.targetWarnings({ kcal: 1800, fat: 50 }).length, 0);
});

test('biggestGap: the macro furthest behind, or null', () => {
  const targets = { protein: 150, carbs: 200, fat: 70 };
  assert.equal(r.biggestGap(targets, { protein: 60, carbs: 130, fat: 45 }), 'protein');
  assert.equal(r.biggestGap(targets, { protein: 150, carbs: 210, fat: 70 }), null);
});
