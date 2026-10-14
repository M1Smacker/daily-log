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

test('schedule: a logged workout fixes which session a day was, and the cycle carries on from it', () => {
  // Upper A was logged on Saturday. Later, the missed Thursday is marked done after all.
  const log = { '2026-10-08': { type: 'done' }, '2026-10-10': { type: 'done', id: 'upperA' } };
  const days = sched('2026-10-11', log);
  assert.equal(on(days, '2026-10-10').session, 'upperA'); // still what was actually done
  assert.equal(on(days, '2026-10-11').session, 'lowerA'); // and next follows it
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

test('progression: a shared lift is judged by the range it was done under', () => {
  const curlB = { kind: 'machine', reps: [10, 15] }; // today's session asks for 15
  const last = { sets: [{ kg: 40, reps: 12 }, { kg: 40, reps: 12 }], planned: 2, top: 12 }; // done under 10 to 12
  assert.deepEqual(r.progression(curlB, last, DB), { type: 'jump', kg: 40, to: 45 });
  assert.equal(r.progression(curlB, { ...last, top: undefined }, DB).type, 'hold');
});

test('wentBackwards: two drops in a row', () => {
  const s = (kg, reps) => r.bestSet([{ kg, reps }]);
  assert.equal(r.wentBackwards([s(40, 10), s(40, 9), s(40, 8)]), true);
  assert.equal(r.wentBackwards([s(40, 10), s(40, 9), s(40, 10)]), false);
  assert.equal(r.wentBackwards([s(40, 9), s(40, 8)]), false); // needs three sessions
});

// Builds a run of daily weigh-ins: weights('2026-10-08', [89.5, 89.2, ...])
const weights = (from, list) => Object.fromEntries(list.map((w, i) => [r.addDays(from, i), w ? { weightKg: w } : {}]));

test('weightAverage: needs three weigh-ins in the last seven days', () => {
  const days = weights('2026-10-08', [89.5, 0, 89.1, 0, 0, 88.9, 0]);
  assert.equal(r.weightAverage(days, '2026-10-14'), 89.2);
  assert.equal(r.weightAverage(days, '2026-10-09'), null); // one weigh-in so far
  assert.equal(r.weightAverage({}, '2026-10-14'), null);
});

test('planWeight: straight line to the goal, flat through the diet break', () => {
  const at = (k) => r.planWeight(k, plan, 90, 76);
  assert.equal(at('2026-10-08'), 90);
  assert.equal(at(plan.end), 76);
  assert.equal(at('2027-06-01'), 76); // never below the goal
  assert.equal(at('2027-01-27'), at('2027-02-10')); // flat across the break
  assert.ok(at('2027-02-11') < at('2027-02-10'));
  const perWeek = at('2026-11-01') - at('2026-11-08');
  assert.ok(perWeek > 0.6 && perWeek < 0.8, `loses ${perWeek} kg a week`);
});

test('stallCheck: needs data, on track, too fast, stalled, recomposing', () => {
  const run = (list, extra = {}) => ({ ...weights('2026-10-08', list), ...extra });
  const week = (w) => Array(7).fill(w);
  const end = '2026-10-28'; // three full weeks from the start
  assert.equal(r.stallCheck(run(week(89)), '2026-10-14', plan.start).status, 'need-data');
  assert.equal(r.stallCheck(run([...week(89), ...week(88.4), ...week(87.7)]), end, plan.start).status, 'ok');
  assert.equal(r.stallCheck(run([...week(89), ...week(88.4), ...week(87.2)]), end, plan.start).status, 'fast');
  // a big first-week drop is water, not a warning
  assert.equal(r.stallCheck(run([...week(89), ...week(87.6)]), '2026-10-21', plan.start).status, 'need-data');
  const flat = [...week(88), ...week(88), ...week(88)];
  assert.deepEqual(r.stallCheck(run(flat), end, plan.start), { status: 'stall', drop: 0, waistKnown: false });
  const waistSame = { '2026-10-11': { weightKg: 88, waistCm: 96 }, '2026-10-25': { weightKg: 88, waistCm: 96 } };
  assert.equal(r.stallCheck(run(flat, waistSame), end, plan.start).status, 'stall');
  const waistDown = { '2026-10-11': { weightKg: 88, waistCm: 96 }, '2026-10-25': { weightKg: 88, waistCm: 95 } };
  assert.equal(r.stallCheck(run(flat, waistDown), end, plan.start).status, 'recomp');
});

test('nextPhotoDay: 22 October, then every two weeks', () => {
  assert.equal(r.nextPhotoDay('2026-10-10', plan.photos), '2026-10-22');
  assert.equal(r.nextPhotoDay('2026-10-22', plan.photos), '2026-10-22');
  assert.equal(r.nextPhotoDay('2026-10-23', plan.photos), '2026-11-05');
});

test('csvLine: quotes only what needs it', () => {
  assert.equal(r.csvLine(['2026-10-10', 89.5, '', 'Roti, 2', 'say "hi"', null]), '2026-10-10,89.5,,"Roti, 2","say ""hi""",');
});

test('portion: by weight and by serving', () => {
  const strips = { byGrams: true, grams: 100, kcal: 200, protein: 16, carbs: 12, fat: 9, fibre: 0.8 };
  assert.deepEqual(r.portion(strips, 150), { kcal: 300, protein: 24, carbs: 18, fat: 13.5, fibre: 1.2 });
  const roti = { kcal: 110, protein: 3, carbs: 22, fat: 1.5 }; // no fibre given
  assert.deepEqual(r.portion(roti, 2), { kcal: 220, protein: 6, carbs: 44, fat: 3, fibre: null });
  assert.deepEqual(r.portion(roti, 0.5), { kcal: 55, protein: 1.5, carbs: 11, fat: 0.8, fibre: null });
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

test('profileProblem: catches numbers that cannot be right', () => {
  const ok = { heightCm: 175, startKg: 85, goalKg: 78, targets: { kcal: 2000, protein: 150, carbs: 200, fat: 70, fibre: 30, waterMl: 2500 } };
  assert.equal(r.profileProblem(ok), null);
  assert.match(r.profileProblem({ ...ok, heightCm: 1.75 }), /Height/);
  assert.match(r.profileProblem({ ...ok, startKg: 8.5 }), /Starting weight/);
  assert.match(r.profileProblem({ ...ok, targets: { ...ok.targets, kcal: 20000 } }), /Calories/);
  assert.match(r.profileProblem({ ...ok, targets: { ...ok.targets, waterMl: 3 } }), /Water/);
  assert.match(r.profileProblem({ ...ok, targets: { ...ok.targets, protein: null } }), /Protein/);
});

test('paceWarnings: warns when the dates ask for more than 1 kg a week', () => {
  assert.deepEqual(r.paceWarnings(90, 76, plan), []); // about 0.65 kg a week
  assert.equal(r.paceWarnings(90, 60, plan).length, 1); // about 1.4 kg a week
  assert.match(r.paceWarnings(80, 80, plan)[0], /not below/);
});

test('oddWeight: flags a weigh-in far from the last one', () => {
  const days = { '2026-10-10': { weightKg: 89 }, '2026-10-12': {} };
  assert.equal(r.oddWeight(days, '2026-10-13', 88.4), null);
  assert.equal(r.oddWeight(days, '2026-10-13', 98), 9); // typed 98 for 89
  assert.equal(r.oddWeight(days, '2026-11-20', 80), null); // nothing recent to compare with
  assert.equal(r.oddWeight({}, '2026-10-13', 89), null);
});

test('biggestGap: the macro furthest behind, or null', () => {
  const targets = { protein: 150, carbs: 200, fat: 70 };
  assert.equal(r.biggestGap(targets, { protein: 60, carbs: 130, fat: 45 }), 'protein');
  assert.equal(r.biggestGap(targets, { protein: 150, carbs: 210, fat: 70 }), null);
});

test('stallCheck: a flat scale in or just after the diet break is not a stall', () => {
  const week = (w) => Array(7).fill(w);
  const flat = (end) => weights(r.addDays(end, -20), [...week(82), ...week(82), ...week(82)]);
  const at = (end, phases) => r.stallCheck(flat(end), end, plan.start, phases).status;
  assert.equal(at('2027-02-10', plan.phases), 'break'); // the last day of the break
  assert.equal(at('2027-02-10'), 'stall'); // the same scale with no break is a stall
  assert.equal(at('2027-02-24', plan.phases), 'break'); // the averages still reach into the break
  assert.equal(at('2027-03-03', plan.phases), 'stall'); // three weeks clear of it
  assert.equal(at('2026-12-20', plan.phases), 'stall'); // nowhere near it
});

test('stallCheck: the fast drop after the diet break is water, like the first two weeks', () => {
  const week = (w) => Array(7).fill(w);
  const drop = (end) => weights(r.addDays(end, -20), [...week(83), ...week(83), ...week(81.7)]);
  assert.notEqual(r.stallCheck(drop('2027-02-17'), '2027-02-17', plan.start, plan.phases).status, 'fast');
  assert.equal(r.stallCheck(drop('2027-03-03'), '2027-03-03', plan.start, plan.phases).status, 'fast');
  // Losing that fast during the break itself still counts: that is eating too little.
  assert.equal(r.stallCheck(drop('2027-02-08'), '2027-02-08', plan.start, plan.phases).status, 'fast');
});

test('weeks: one line per plan week, newest first, nothing before the plan started', () => {
  const food = (kcal, protein) => ({ food: [{ kcal, protein }] });
  const days = {
    ...weights('2026-10-08', [90, 90, 90, 0, 0, 0, 0, 89, 89, 89]),
  };
  Object.assign(days['2026-10-08'], food(2000, 150));
  Object.assign(days['2026-10-09'], food(2200, 160));
  Object.assign(days['2026-10-15'], food(1900, 140));
  const today = '2026-10-17'; // a Saturday, in the second week
  const out = r.weeks(days, sched(today, { '2026-10-08': { type: 'done' }, '2026-10-10': { type: 'min' } }), today, plan.weekStartDow, plan.start);
  assert.deepEqual(out, [
    { first: '2026-10-15', last: '2026-10-21', running: true, foodDays: 1, kcal: 1900, protein: 140, done: 0, planned: 4, weight: 89, change: -1 },
    { first: '2026-10-08', last: '2026-10-14', running: false, foodDays: 2, kcal: 2100, protein: 155, done: 2, planned: 4, weight: 90, change: null },
  ]);
  assert.deepEqual(r.weeks({}, sched('2026-10-01'), '2026-10-01', plan.weekStartDow, plan.start), []); // before the plan
  assert.equal(r.weeks({}, sched('2027-03-01'), '2027-03-01', plan.weekStartDow, plan.start).length, 6); // capped
});

test('typedNumber: dots, decimal commas, and thousands the way the app shows them', () => {
  assert.deepEqual(['82.4', '82,4', '6,400', '12,345,678', '6400', ' 7 ', '0'].map(r.typedNumber), [82.4, 82.4, 6400, 12345678, 6400, 7, 0]);
  assert.deepEqual(['', '  ', 'abc', '-5', '1,2,3', null, undefined].map(r.typedNumber), [null, null, null, null, null, null, null]);
});

test('editEntry: an entry with no amount of its own keeps its numbers', () => {
  const e = { id: 'a', name: 'Odd', meal: 'lunch', amount: 0, unit: 'serving', kcal: 200, protein: 10, carbs: 20, fat: 5, fibre: null };
  const out = r.editEntry(e, 2, { kcal: 200, protein: 10, carbs: 20, fat: 5 }, 'lunch');
  assert.deepEqual([out.kcal, out.protein, out.amount], [200, 10, 2]);
});

// ----- From the October 2026 audit -----

test('unknownIn: names the nutrients some entry has no number for, so a total can say "at least"', () => {
  const e = (protein, fat) => ({ kcal: 100, protein, carbs: 10, fat, fibre: null });
  assert.deepEqual(r.unknownIn([e(10, 5), e(20, 5)]), ['fibre']);
  assert.deepEqual(r.unknownIn([e(10, 5), e(null, 5)]).sort(), ['fibre', 'protein']);
  assert.deepEqual(r.unknownIn([]), []);
});

test('weeks: with a judge, half-logged days and the open day are left out of the food average', () => {
  const full = [{ meal: 'lunch', kcal: 1000, protein: 60 }, { meal: 'dinner', kcal: 1000, protein: 60 }];
  const half = [{ meal: 'breakfast', kcal: 300, protein: 10 }];
  const noProtein = [{ meal: 'lunch', kcal: 1000, protein: null }, { meal: 'dinner', kcal: 1000, protein: 50 }];
  const days = {
    '2026-10-15': { food: full }, '2026-10-16': { food: full }, '2026-10-17': { food: half },
    '2026-10-18': { food: noProtein }, '2026-10-19': { food: half }, // the 19th is "today", still open
  };
  const judge = (food) => food.reduce((a, e) => a + e.kcal, 0) >= 1200 && new Set(food.map((e) => e.meal)).size >= 2;
  const [w] = r.weeks(days, [], '2026-10-19', 4, '2026-10-08', 1, judge);
  assert.equal(w.foodDays, 3); // two full days and the one with a missing protein number
  assert.equal(w.kcal, 2000);
  assert.equal(w.protein, 120); // only from the two days where every protein number is known
  // Without a judge it counts every day with food, as it always did.
  assert.equal(r.weeks(days, [], '2026-10-19', 4, '2026-10-08', 1)[0].foodDays, 5);
});

test('withTargetDate: stamps the day the calorie target changed, and a same-day change back is not a change', () => {
  const p = (kcal, extra = {}) => ({ startKg: 90, targets: { kcal }, ...extra });
  assert.equal(r.withTargetDate(null, p(2200), '2026-11-01').targetChangedOn, undefined); // a first profile
  const changed = r.withTargetDate(p(2200), p(2050), '2026-11-03');
  assert.deepEqual([changed.targetChangedOn, changed.targetWas], ['2026-11-03', 2200]);
  // Another field saved later keeps the date.
  assert.equal(r.withTargetDate(changed, p(2050), '2026-11-09').targetChangedOn, '2026-11-03');
  // A slip corrected the same day: 2200 to 2050 and straight back.
  const back = r.withTargetDate(changed, p(2200), '2026-11-03');
  assert.equal(back.targetChangedOn, undefined);
  assert.equal(back.targetWas, undefined);
  // Two changes in one day still remember what the day started at.
  const twice = r.withTargetDate(changed, p(2000), '2026-11-03');
  assert.deepEqual([twice.targetChangedOn, twice.targetWas], ['2026-11-03', 2200]);
});

test('planFrom: a saved dumbbell list is put in order, because the next weight up is found by walking it', () => {
  const saved = r.planFrom(plan, { dumbbells: [20, 5, 12.5, 10] });
  assert.deepEqual(saved.dumbbells, [5, 10, 12.5, 20]);
  assert.equal(r.nextWeight('dumbbell', 10, saved.dumbbells), 12.5);
});

// ----- A missed session, said out loud -----

test('carriedOver: a missed gym day names the session and the day it lands on', () => {
  // Tuesday 13 Oct was Lower B and nothing was logged. Today is Wednesday, a rest day.
  const log = { '2026-10-08': { type: 'done', id: 'upperA' }, '2026-10-10': { type: 'done', id: 'lowerA' }, '2026-10-11': { type: 'done', id: 'upperB' } };
  const days = sched('2026-10-14', log);
  assert.deepEqual(r.carriedOver(days, '2026-10-14'), { session: 'lowerB', missedKeys: ['2026-10-13'], to: '2026-10-15' });
  // Gym days and rest days keep their weekdays. Only the names slide along.
  assert.deepEqual(
    ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'].map((k) => [on(days, k).state, on(days, k).session]),
    [['planned', 'lowerB'], ['rest', null], ['planned', 'upperA'], ['planned', 'lowerA'], ['rest', null], ['planned', 'upperB']],
  );
});

test('carriedOver: nothing waiting when the last gym day was done, or when nothing has been missed', () => {
  const log = { '2026-10-08': { type: 'done', id: 'upperA' } };
  assert.equal(r.carriedOver(sched('2026-10-09', log), '2026-10-09'), null);
  const done = { ...log, '2026-10-10': { type: 'min', id: 'lowerA' } };
  assert.equal(r.carriedOver(sched('2026-10-11', done), '2026-10-11'), null);
});

test('carriedOver: a day marked missed today moves on at once, and clearing the mark brings it back', () => {
  const log = { '2026-10-08': { type: 'done', id: 'upperA' }, '2026-10-10': { type: 'missed' } };
  const days = sched('2026-10-10', log);
  assert.deepEqual(r.carriedOver(days, '2026-10-10'), { session: 'lowerA', missedKeys: ['2026-10-10'], to: '2026-10-11' });
  assert.equal(r.carriedOver(sched('2026-10-10', { '2026-10-08': log['2026-10-08'] }), '2026-10-10'), null);
});

test('carriedOver: two in a row are both named, and it is still one session', () => {
  const days = sched('2026-10-12', { '2026-10-08': { type: 'done', id: 'upperA' } });
  assert.deepEqual(r.carriedOver(days, '2026-10-12'), { session: 'lowerA', missedKeys: ['2026-10-10', '2026-10-11'], to: '2026-10-13' });
});

test('unfinishedDays: lifts logged on a day that was never marked are found, nothing else is', () => {
  const lift = { sets: [{ kg: 40, reps: 10 }] };
  const days = {
    '2026-10-13': { workout: { session: 'lowerB', lifts: { a: lift, b: lift, c: { sets: [{ kg: 40, reps: 0 }] } } } },
    '2026-10-12': { workout: { session: 'upperB', lifts: { a: lift } } }, // marked done below
    '2026-10-11': { workout: { session: 'upperB', lifts: {} } }, // opened, nothing logged
    '2026-10-14': { workout: { session: 'lowerB', lifts: { a: lift } } }, // today is still going
  };
  const log = { '2026-10-12': { type: 'done' } };
  assert.deepEqual(r.unfinishedDays(days, log, '2026-10-14'), [{ key: '2026-10-13', lifts: 2, session: 'lowerB' }]);
  assert.deepEqual(r.unfinishedDays(days, { ...log, '2026-10-13': { type: 'missed' } }, '2026-10-14'), []); // an answer is an answer
  assert.deepEqual(r.unfinishedDays({ '2026-10-13': { workout: { lifts: 'junk' } }, '2026-10-12': null }, {}, '2026-10-14'), []);
});

test('weighInsThisWeek: counts mornings with a weight since Thursday, today included', () => {
  const days = { '2026-10-08': { weightKg: 90 }, '2026-10-10': { weightKg: 89.6 }, '2026-10-13': { weightKg: 0 }, '2026-10-14': { weightKg: 89.1 }, '2026-10-15': { weightKg: 88.9 } };
  assert.equal(r.weighInsThisWeek(days, '2026-10-14', 4), 3); // Thu 8 to Wed 14: three real weights
  assert.equal(r.weighInsThisWeek(days, '2026-10-15', 4), 1); // a new week begins on Thursday
});

// ----- The pace the plan asks for, worked out, not written in by hand -----

test('planPace: the weekly loss the start, goal and dates add up to, over the days that are not a break', () => {
  // 92 to 77.5 kg is 14.5 kg. The plan's loss days leave out the diet break.
  const pace = r.planPace(92, 77.5, plan);
  assert.ok(pace.perWeek > 0.5 && pace.perWeek < 0.8, `got ${pace.perWeek}`);
  assert.equal(pace.text, `about ${pace.perWeek} kg a week`);
  // A goal at or above the start has no pace to name, and never divides by zero.
  assert.equal(r.planPace(92, 92, plan), null);
  assert.equal(r.planPace(92, 95, plan), null);
  assert.equal(r.planPace(null, 77.5, plan), null);
});

test('planPace: a pace over 1 kg a week is said as the plan asking too much', () => {
  const soon = { ...plan, end: r.addDays(plan.start, 60) };
  const pace = r.planPace(92, 77.5, soon);
  assert.ok(pace.perWeek > 1);
  assert.equal(pace.fast, true);
});
