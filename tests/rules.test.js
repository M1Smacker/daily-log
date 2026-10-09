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

test('biggestGap: the macro furthest behind, or null', () => {
  const targets = { protein: 150, carbs: 200, fat: 70 };
  assert.equal(r.biggestGap(targets, { protein: 60, carbs: 130, fat: 45 }), 'protein');
  assert.equal(r.biggestGap(targets, { protein: 150, carbs: 210, fat: 70 }), null);
});
