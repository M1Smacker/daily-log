// A recap holds every set. These are the rules that read the sets and plan the next weight from them.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../js/rules.js';

const DB = [5, 7, 7.5, 8, 10, 12.5, 15, 17.5, 20];
const press = { kind: 'machine', reps: [8, 12] };
const s = (kg, reps) => ({ kg, reps });
const last = (sets, planned = 3) => ({ sets, planned, top: 12 });

test('setsOf: a recap set by set, an older recap as equal sets, and sets with no reps left out', () => {
  assert.deepEqual(r.setsOf({ sets: [s(40, 8), s(35, 12), { kg: 35 }, s(35, 0)], planned: 3 }), [s(40, 8), s(35, 12)]);
  assert.deepEqual(r.setsOf({ kg: 40, reps: 10, planned: 3 }), [s(40, 10), s(40, 10), s(40, 10)]);
  assert.deepEqual(r.setsOf({ reps: 9, planned: 2 }), [{ kg: undefined, reps: 9 }, { kg: undefined, reps: 9 }]); // bodyweight
  assert.deepEqual(r.setsOf({ kg: 40, planned: 3 }), []); // a weight but no reps: not done
  assert.deepEqual(r.setsOf(undefined), []);
  assert.deepEqual(r.setsOf({ sets: [null, 'x', s(20, 5)] }), [s(20, 5)]);
});

test('workingKg: the weight most sets were done with, the lighter one on a tie', () => {
  assert.equal(r.workingKg([s(40, 8), s(35, 12), s(35, 12)]), 35);
  assert.equal(r.workingKg([s(35, 12), s(40, 8), s(40, 7)]), 40);
  assert.equal(r.workingKg([s(40, 8), s(35, 12)]), 35);
  assert.equal(r.workingKg([s(30, 12), s(35, 10), s(40, 8)]), 30);
  assert.equal(r.workingKg([]), 0);
});

test('progression: one heavy set then lighter ones. The heavy set counts, so full reps on the rest earn the jump', () => {
  assert.deepEqual(r.progression(press, last([s(40, 8), s(35, 12), s(35, 12)]), DB), { type: 'jump', kg: 35, to: 40 });
  // The lighter sets fell short: the weight stays where most of the work was done.
  assert.deepEqual(r.progression(press, last([s(40, 8), s(35, 12), s(35, 10)]), DB), { type: 'hold', kg: 35 });
});

test('progression: a warm-up weight then heavier sets. The lighter set holds the weight back', () => {
  assert.deepEqual(r.progression(press, last([s(35, 12), s(40, 12), s(40, 12)]), DB), { type: 'hold', kg: 40 });
  assert.deepEqual(r.progression(press, last([s(40, 12), s(40, 12), s(40, 12)]), DB), { type: 'jump', kg: 40, to: 45 });
});

test('progression: more sets than the sheet asked for is fine, fewer is not', () => {
  assert.equal(r.progression(press, last([s(40, 12), s(40, 12), s(40, 12)], 2), DB).type, 'jump');
  assert.equal(r.progression(press, last([s(40, 12), s(40, 12)], 3), DB).type, 'hold');
});

test('progression: a big jump still needs the extra reps, and a heavier set covers them', () => {
  const raise = { kind: 'dumbbell', reps: [12, 20] };
  const at = (sets) => r.progression(raise, { sets, planned: 2, top: 20 }, DB);
  assert.deepEqual(at([s(5, 20), s(5, 20)]), { type: 'extra', kg: 5, to: 7, need: 23 });
  assert.deepEqual(at([s(5, 23), s(5, 23)]), { type: 'jump', kg: 5, to: 7 });
  assert.deepEqual(at([s(7, 12), s(5, 23), s(5, 23)]), { type: 'jump', kg: 5, to: 7 });
});

test('setsText: one weight, a change of weight, and no weight', () => {
  assert.equal(r.setsText([s(35, 12), s(35, 12), s(35, 11)]), '35 kg x 12, 12, 11');
  assert.equal(r.setsText([s(40, 8), s(35, 12)]), '40 kg x 8, 35 kg x 12');
  assert.equal(r.setsText([{ reps: 10 }, { reps: 8 }]), '10, 8 reps');
  assert.equal(r.setsText([]), '');
});

test('bestSet: the strongest set of the day, whichever weight it was at', () => {
  assert.equal(r.bestSet([s(40, 8), s(35, 12)]), 40 * (1 + 8 / 30));
  assert.equal(r.bestSet([s(40, 5), s(35, 12)]), 35 * (1 + 12 / 30));
});
