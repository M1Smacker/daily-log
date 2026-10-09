// Guards the offline shell: every file the app ships must be in the service worker's list,
// and the two version numbers must agree.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { VERSION } from '../js/version.js';

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
