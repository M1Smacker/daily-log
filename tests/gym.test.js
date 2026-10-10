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

// ----- Moving the phases -----

const starts = plan.phases.map((p) => p.start);

test('movePhases: the plan as written comes back unchanged, and a moved diet break moves its neighbours', () => {
  assert.deepEqual(r.movePhases(plan.phases, starts), plan.phases);
  const moved = r.movePhases(plan.phases, [...starts.slice(0, 4), '2027-01-14', '2027-01-28']);
  assert.deepEqual([moved[3].end, moved[4].start, moved[4].end, moved[5].start, moved[5].end], ['2027-01-13', '2027-01-14', '2027-01-27', '2027-01-28', undefined]);
  assert.equal(moved[4].maintenance, true); // everything but the dates is kept
  assert.equal(r.phaseFor('2027-01-20', moved).name, 'Diet break and deload');
});

test('phaseDatesProblem: dates must be real, in order, and inside three years', () => {
  assert.equal(r.phaseDatesProblem(plan, starts, plan.end), null);
  const bad = (s, end = plan.end) => typeof r.phaseDatesProblem(plan, s, end);
  assert.equal(bad(starts.slice(1)), 'string'); // one short
  assert.equal(bad(['2026-10-09', ...starts.slice(1)]), 'string'); // the first day is not the plan's
  assert.equal(bad([...starts.slice(0, 5), starts[4]]), 'string'); // two phases on one day
  assert.equal(bad([...starts.slice(0, 5), '2027-02-30']), 'string'); // not a real day
  assert.equal(bad([...starts.slice(0, 5), '']), 'string');
  assert.equal(bad(starts, '2027-02-11'), 'string'); // the goal date on the last phase's first day
  assert.equal(bad(starts, '2031-01-01'), 'string');
  assert.equal(bad(starts, 'soon'), 'string');
});

test('planFrom: saved changes go on top, and anything damaged falls back to the template', () => {
  assert.deepEqual(r.planFrom(plan, {}), plan);
  assert.deepEqual(r.planFrom(plan, null), plan);
  const junk = r.planFrom(plan, {
    phases: 'gone', phaseStarts: ['x'], end: 5, rolloverHour: 99, dumbbells: 'heavy', swaps: null, pushExtra: 'Chest',
    gap: 3, start: '1999-01-01', cycle: [], usdaKey: 7, finishAsked: 'yes',
  });
  assert.deepEqual(junk, { ...plan, }); // not one bad value got through
  const good = r.planFrom(plan, {
    rolloverHour: 2, dumbbells: [5, 10], usdaKey: 'abc', pushExtra: ['Chest', 4], finishAsked: true,
    swaps: { 'lat-pulldown': { name: 'Pull-ups', kind: 'body' }, broken: { name: 5 } },
    phaseStarts: [...starts.slice(0, 5), '2027-02-18'], end: '2027-03-30',
  });
  assert.deepEqual([good.rolloverHour, good.dumbbells, good.usdaKey, good.pushExtra, good.finishAsked], [2, [5, 10], 'abc', ['Chest'], true]);
  assert.deepEqual(Object.keys(good.swaps), ['lat-pulldown']);
  assert.deepEqual([good.phases[4].end, good.phases[5].start, good.end], ['2027-02-17', '2027-02-18', '2027-03-30']);
  // Dates that do not fit together are dropped as a pair, not half applied.
  const half = r.planFrom(plan, { phaseStarts: starts, end: '2026-11-01' });
  assert.deepEqual([half.end, half.phases], [plan.end, plan.phases]);
});

test('shiftPhases then saved as start dates: a week pushed back survives the round trip', () => {
  const shifted = r.shiftPhases(plan.phases, '2026-11-05', 7);
  const back = r.planFrom(plan, { phaseStarts: shifted.map((p) => p.start), end: r.addDays(plan.end, 7) });
  assert.deepEqual(back.phases, shifted);
  assert.equal(back.end, '2027-03-30');
});

test('isDay: only real days', () => {
  assert.deepEqual(['2026-10-10', '2026-02-30', '2026-13-01', '26-10-10', '', null, 20261010].map(r.isDay), [true, false, false, false, false, false, false]);
});
