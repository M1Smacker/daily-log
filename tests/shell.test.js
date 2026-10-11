// Guards the offline shell: every file the app ships must be in the service worker's list,
// and the two version numbers must agree.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { VERSION } from '../js/version.js';
import { tidy, readBackup } from '../js/store.js';

const root = new URL('..', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('service worker and app agree on the version', () => {
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], VERSION);
});

test('every file in the shell list exists', () => {
  for (const f of shell.filter((f) => f !== './')) assert.ok(existsSync(new URL(f, root)), `${f} is listed but missing`);
});

test('every shipped file is in the shell list', () => {
  const shipped = ['index.html', 'manifest.webmanifest'];
  for (const dir of ['css', 'js', 'fonts', 'icons']) {
    for (const f of readdirSync(new URL(dir, root))) shipped.push(`${dir}/${f}`);
  }
  const missing = shipped.filter((f) => !shell.includes(f));
  assert.deepEqual(missing, [], 'add these to SHELL in sw.js');
});

// ----- Data safety -----

const good = {
  v: 1,
  profile: { v: 1, heightCm: 175, startKg: 85, goalKg: 78, targets: { kcal: 2000, protein: 150, carbs: 200, fat: 70, fibre: 30, waterMl: 2500 } },
  plan: {},
  days: { '2026-10-10': { weightKg: 84.6, steps: 4200, food: [{ id: 'a', name: 'Roti', kcal: 110 }], session: { type: 'done' } } },
  foods: {},
};

test('tidy: drops broken values, keeps good ones', () => {
  const out = tidy({
    ...good,
    days: {
      '2026-10-10': { weightKg: 'heavy', steps: -5, waterMl: 1500, food: 'lots', session: { type: 'banana' }, workout: 7 },
      'not-a-date': { weightKg: 80 },
      '2026-10-11': null,
    },
    foods: { ok: { name: 'Dahi', kcal: 120 }, bad: { name: 5 }, gone: { hidden: true } },
  });
  assert.deepEqual(out.days['2026-10-10'], { waterMl: 1500 });
  assert.equal(out.days['not-a-date'], undefined);
  assert.deepEqual(out.days['2026-10-11'], {});
  assert.deepEqual(Object.keys(out.foods).sort(), ['gone', 'ok']);
  assert.deepEqual(tidy(good).days, good.days); // good data comes through untouched
});

test('readBackup: a real backup comes back whole', () => {
  const read = readBackup(JSON.stringify(good));
  assert.equal(read.error, undefined);
  assert.deepEqual(read.data.days, good.days);
  assert.deepEqual(read.data.profile, good.profile);
});

test('readBackup: refuses anything that is not a usable backup, without throwing', () => {
  for (const text of ['', 'not json', '[]', 'null', '42', '{"v":1}', '{"days":{}}', JSON.stringify({ ...good, v: 99 }),
    JSON.stringify({ ...good, profile: null }), JSON.stringify({ ...good, profile: { targets: { kcal: 'x' } } })]) {
    const read = readBackup(text);
    assert.equal(typeof read.error, 'string', `accepted: ${text.slice(0, 30)}`);
    assert.equal(read.data, undefined);
  }
});

test('tidy: a day that is not a real calendar date is left out, so no screen ever does date sums on it', () => {
  const days = tidy({ ...good, days: { '2026-13-45': { weightKg: 80 }, '2026-02-30': { weightKg: 80 }, '2026-10-10': { weightKg: 84.6 }, nope: {} } }).days;
  assert.deepEqual(Object.keys(days), ['2026-10-10']);
});
