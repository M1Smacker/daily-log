import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../js/rules.js';
import { plan } from '../js/plan.js';

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

test('nextSession: follows the cycle and wraps', () => {
  assert.equal(r.nextSession(plan.cycle, 0), 'upperA');
  assert.equal(r.nextSession(plan.cycle, 1), 'lowerA');
  assert.equal(r.nextSession(plan.cycle, 4), 'upperA');
});

test('nextPlannedDay: today if it is a training day, else the next one', () => {
  assert.equal(r.nextPlannedDay('2026-10-10', plan.weekdays), '2026-10-10'); // Saturday
  assert.equal(r.nextPlannedDay('2026-10-09', plan.weekdays), '2026-10-10'); // Friday
  assert.equal(r.nextPlannedDay('2026-10-14', plan.weekdays), '2026-10-15'); // Wednesday
});

test('weekStrip: Thursday to Wednesday with the right states', () => {
  const strip = r.weekStrip('2026-10-10', plan, { '2026-10-08': 'upperA' });
  assert.deepEqual(strip.map((d) => d.key), [
    '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14',
  ]);
  assert.deepEqual(strip.map((d) => d.state), ['done', 'rest', 'today', 'planned', 'rest', 'planned', 'rest']);
  assert.deepEqual(strip.map((d) => d.session), ['upperA', null, 'lowerA', 'upperB', null, 'lowerB', null]);
});

test('weekStrip: a session done on a rest day gets the tick there', () => {
  const strip = r.weekStrip('2026-10-10', plan, { '2026-10-09': 'upperA' });
  assert.equal(strip[1].state, 'done');
  assert.equal(strip[1].session, 'upperA');
});

test('biggestGap: the macro furthest behind, or null', () => {
  const targets = { protein: 150, carbs: 200, fat: 70 };
  assert.equal(r.biggestGap(targets, { protein: 60, carbs: 130, fat: 45 }), 'protein');
  assert.equal(r.biggestGap(targets, { protein: 150, carbs: 210, fat: 70 }), null);
});
