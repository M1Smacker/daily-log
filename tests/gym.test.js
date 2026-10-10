import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../js/rules.js';
import { plan } from '../js/plan.js';
import { sessions, withSwaps, altKind, KINDS } from '../js/exercises.js';

test('readDumbbells: sorts, drops repeats, refuses anything that is not a weight', () => {
  assert.deepEqual(r.readDumbbells('10, 5 7.5;7.5'), [5, 7.5, 10]);
  assert.equal(r.readDumbbells('5'), null);
  assert.equal(r.readDumbbells('5, heavy'), null);
  assert.equal(r.readDumbbells('5, -2'), null);
  assert.equal(r.readDumbbells(''), null);
});

test('finishKcal: keeps the deficit as the weight falls, never under the floor', () => {
  assert.equal(r.finishKcal(2100, 90, 80), 1960);
  assert.equal(r.finishKcal(2100, 90, 92), 2100); // heavier than the start: no change
  assert.equal(r.finishKcal(2100, 110, 80), r.KCAL_FLOOR);
  assert.equal(r.finishKcal(1700, 90, 80), 1700); // already under the floor: never pushed lower
});

test('afterBreak: only the phase that follows the diet break', () => {
  assert.equal(r.afterBreak('2027-02-01', plan.phases), false);
  assert.equal(r.afterBreak('2027-02-11', plan.phases), true);
  assert.equal(r.afterBreak('2026-11-01', plan.phases), false);
});

test('withSwaps: a swapped lift keeps its place and sets, with a new id and kind', () => {
  const list = withSwaps(sessions.upperA, { 'lat-pulldown': { name: 'Pull-ups', kind: 'body' } });
  assert.equal(list.length, sessions.upperA.length);
  assert.deepEqual([list[0].id, list[0].base, list[0].kind, list[0].sets], ['lat-pulldown~pull-ups', 'lat-pulldown', 'body', 3]);
  assert.equal(list[1], sessions.upperA[1]);
  // A swap with a kind the app does not know is ignored, not trusted.
  assert.equal(withSwaps(sessions.upperA, { 'lat-pulldown': { name: 'X', kind: 'rocket' } })[0].id, 'lat-pulldown');
});

test('altKind: every listed alternative gets a known kind', () => {
  for (const ex of Object.values(sessions).flat()) if (ex.alt) assert.ok(KINDS[altKind(ex.alt)], ex.alt);
  assert.equal(altKind('Smith machine bent-over row'), 'barbell');
  assert.equal(altKind('Leg press calf raise, knees straight'), 'machine');
  assert.equal(altKind('Side plank'), 'body');
});
