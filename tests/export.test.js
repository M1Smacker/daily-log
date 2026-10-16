// "Copy my data for Claude". Made-up numbers only: nobody's real data is in this repo.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../js/rules.js';
import * as coach from '../js/coach.js';
import { briefing } from '../js/briefing.js';
import { compose } from '../js/briefing-words.js';
import { liftName } from '../js/exercises.js';
import { exportText, csvText } from '../js/export-text.js';
import { plan as basePlan } from '../js/plan.js';

const profile = { v: 1, heightCm: 178, startKg: 92, goalKg: 77.5, targets: { kcal: 2200, protein: 170, carbs: 220, fat: 60, fibre: 30, waterMl: 3000 } };
const lift = (kg, ...reps) => ({ sets: reps.map((n) => ({ kg, reps: n })), planned: 2, top: 12 });

// A week like a real first week: some days logged well, some not at all, one weigh-in.
function person(extra = {}) {
  const days = {
    '2026-10-08': { session: { type: 'done' }, workout: { session: 'upperA', finished: true, lifts: { 'lat-pulldown': lift(40, 12, 10) } } },
    '2026-10-10': { session: { type: 'done' }, workout: { session: 'lowerA', finished: true, lifts: { 'leg-curl': lift(16, 8, 8, 8) } },
      food: [{ meal: 'breakfast', name: 'a', kcal: 900, protein: 60, carbs: 80, fat: 40 }, { meal: 'lunch', name: 'b', kcal: 1785, protein: 127, carbs: 126, fat: 81 }], steps: 3695, waterMl: 2500 },
    '2026-10-11': { weightKg: 90.1, session: { type: 'done' }, workout: { session: 'upperB', finished: true, lifts: { 'chest-press': lift(28, 10, 10) } },
      food: [{ meal: 'lunch', name: 'c', kcal: 1100, protein: null, carbs: 100, fat: 30 }, { meal: 'dinner', name: 'd', kcal: 1023, protein: 89, carbs: 137, fat: 57 }] },
    '2026-10-13': { food: [{ meal: 'lunch', name: 'e', kcal: 1698, protein: 125, carbs: 167, fat: 59 }], steps: 8000 },
    '2026-10-15': { session: { type: 'missed' } },
    '2026-10-17': { workout: { session: 'lowerB', finished: true, half: false, lifts: { 'leg-curl': lift(18, 9, 8) } }, session: { type: 'done' }, waistCm: 98 },
    ...extra,
  };
  const log = {};
  for (const [k, d] of Object.entries(days)) if (d.session) log[k] = { ...d.session, id: d.workout?.session };
  return { key: '2026-10-18', plan: { ...basePlan }, profile, targets: profile.targets, data: { days, foods: {} }, log };
}
function coachFor(c) {
  const input = {
    key: c.key, days: c.data.days, T: c.targets.kcal, P: c.targets.protein, targets: { fibre: 30, waterMl: 3000 },
    plan: { ...c.plan, sessionsPerWeek: 4 }, targetChangedOn: null, startKg: c.profile.startKg, goalKg: c.profile.goalKg,
  };
  const y = r.addDays(c.key, -1);
  return {
    week: coach.weekCheck({ ...input, planLine: 90 }),
    yesterday: { key: y, ...coach.dayCheck({ entries: c.data.days[y]?.food ?? [], kcalTarget: 2200, proteinTarget: 170, steps: null, stepGoal: 5000 }) },
    brief: compose(briefing(input), { lift: liftName }),
  };
}

test('export: every one of the last 14 days is printed, and a blank day says "not logged"', () => {
  const c = person();
  const text = exportText(c, coachFor(c));
  const days = text.slice(text.indexOf('LAST 11 DAYS'), text.indexOf('WEEK BY WEEK'));
  const rows = days.split('\n').filter((l) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ Oct, /.test(l));
  assert.equal(rows.length, 11); // 8 Oct (the plan's first day) to 18 Oct
  assert.match(text, /Wed 14 Oct, -, not logged/);
  assert.match(text, /Days with no food logged at all: Thu 8 Oct, Fri 9 Oct, Mon 12 Oct, Wed 14 Oct, Thu 15 Oct, Fri 16 Oct, Sat 17 Oct\./);
});

test('export: the Coach is sentences with the code after each, never bare codes', () => {
  const c = person();
  const text = exportText(c, coachFor(c));
  const coachPart = text.slice(text.indexOf('THE COACH'), text.indexOf('WEIGHT'));
  assert.match(coachPart, /Weekly verdict[^\n]*: [A-Z][^\n]*\[W\d+[a-c]?\]/);
  assert.match(coachPart, /Briefing: Read of the week/);
  assert.match(coachPart, /Fix: /);
  // No line that is only codes, the way the old export sent them.
  assert.doesNotMatch(coachPart, /verdict W\d+ \(/);
  assert.doesNotMatch(coachPart, /actions A\d/);
});

test('export: how complete the log is, said up front', () => {
  const c = person();
  const text = exportText(c, coachFor(c));
  const about = text.slice(0, text.indexOf('ME AND THE PLAN'));
  assert.match(about, /Last 11 days: food logged on 3, and 2 of those finished days were complete enough to count in averages\. Weight logged on 1 morning\./);
  assert.match(about, /4 gym sessions done/);
  assert.match(about, /Not tracked by this app at all: sleep/);
  assert.match(about, /Weeks run Thursday to Wednesday\./);
  assert.match(about, /turns over at 4 am/);
});

test('export: unknown food numbers carry a "+", never a silent zero', () => {
  const c = person();
  const text = exportText(c, coachFor(c));
  assert.match(text, /Sun 11 Oct, 90\.1, 2123, 89\+,/); // one food had no protein figure
});

test('export: maintenance, the pace and the safety limits are there, worked out', () => {
  const c = person();
  const text = exportText(c, coachFor(c));
  assert.match(text, /maintenance was roughly 2,750 kcal then/); // 2,200 + 550
  assert.match(text, /works out at about 0\.\d kg a week/);
  assert.match(text, /never under 1,800 kcal, never more than 1 kg a week of loss, never less protein/);
});

test('export: every weigh-in, the waist, and each lift first against latest with its rep range', () => {
  const c = person();
  const text = exportText(c, coachFor(c));
  assert.match(text, /Every weigh-in \(date, kg\): Sun 11 Oct 90\.1\./);
  assert.match(text, /Waist \(date, cm\): Sat 17 Oct 98\./);
  assert.match(text, /Leg curl \(\d+ to \d+ reps\): first Sat 10 Oct, 16 kg x 8, 8, 8\. Latest Sat 17 Oct, 18 kg x 9, 8\. Done 2 times\./);
  assert.match(text, /Lat pulldown \(8 to 12 reps\): done once, Thu 8 Oct, 40 kg x 12, 10/);
});

test('export: a day with lifts logged but never finished says so, and a missed gym day too', () => {
  const c = person({ '2026-10-16': { workout: { session: 'lowerB', lifts: { 'leg-curl': lift(16, 8) } } } });
  const text = exportText(c, coachFor(c));
  assert.match(text, /Fri 16 Oct, [^\n]*lifts logged, not finished/);
  assert.match(text, /Tue 13 Oct, [^\n]*missed, nothing logged/);
  assert.match(text, /Thu 15 Oct, [^\n]*missed$/m);
});

test('export: a skipped meal is told apart from one not logged', () => {
  const c = person({ '2026-10-16': { food: [{ meal: 'lunch', name: 'x', kcal: 800 }], noMeal: ['breakfast'] } });
  const text = exportText(c, coachFor(c));
  assert.match(text, /Fri 16 Oct, -, 800, [^\n]*, 1 of 4 \(1 skipped\),/);
});

test('export: the two easy weeks are said when they are on', () => {
  const c = person();
  c.plan = { ...c.plan, focus: { from: '2026-10-16', to: '2026-10-29' } };
  assert.match(exportText(c, coachFor(c)), /Right now: two easy weeks, Friday 16 Oct to Thursday 29 Oct\./);
});

test('export: the short version keeps the essentials and drops the long parts', () => {
  const c = person();
  const long = exportText(c, coachFor(c));
  const short = exportText(c, coachFor(c), { full: false });
  assert.ok(short.length < long.length);
  for (const must of ['ABOUT THE DATA', 'Daily targets', 'THE COACH', 'LAST 11 DAYS', 'never under 1,800 kcal']) assert.ok(short.includes(must), must);
  for (const gone of ['WEEK BY WEEK', 'LIFTS, first time', 'RECENT SESSIONS', 'Every weigh-in']) assert.ok(!short.includes(gone), gone);
});

test('export: no personal details or keys, no "undefined" or "NaN", no em dashes', () => {
  const c = person();
  c.plan = { ...c.plan, usdaKey: 'SECRET-USDA-KEY-123', geminiKey: 'SECRET-GEMINI-KEY-456' };
  for (const full of [true, false]) {
    const text = exportText(c, coachFor(c), { full });
    assert.ok(!text.includes('SECRET'), 'a key leaked');
    assert.doesNotMatch(text, /undefined|NaN|\[object|null/);
    assert.doesNotMatch(text, /—|–/);
  }
});

test('export: an empty account and a brand new day do not break it', () => {
  const c = { ...person(), data: { days: {}, foods: {} }, log: {}, key: '2026-10-08' };
  const text = exportText(c, { week: null, yesterday: null, brief: null });
  assert.match(text, /LAST 1 DAY,/);
  assert.match(text, /No weigh-ins logged yet\./);
  assert.doesNotMatch(text, /undefined|NaN|\[object|null/);
});

test('spreadsheet: a macro no food had is blank, a partly known one is named in at_least', () => {
  const c = person({ '2026-10-16': { food: [{ meal: 'lunch', name: 'x', kcal: 800 }], noMeal: ['breakfast'] } });
  const text = csvText(c);
  const [head, ...rows] = text.split('\n');
  const col = (name) => head.split(',').indexOf(name);
  const row = (date) => rows.find((r) => r.startsWith(date)).split(',');
  // 16 Oct: one food, no protein, carbs, fat or fibre figure at all.
  assert.equal(row('2026-10-16')[col('kcal')], '800');
  assert.equal(row('2026-10-16')[col('protein_g')], '');
  assert.equal(row('2026-10-16')[col('meals_skipped')], '1');
  // 11 Oct: one food without protein, one with: the known part, named as "at least".
  assert.equal(row('2026-10-11')[col('protein_g')], '89');
  assert.match(row('2026-10-11')[col('at_least')], /protein/);
  // A day with no food has blank food cells, not zeros.
  assert.equal(row('2026-10-15')[col('kcal')], '');
  assert.doesNotMatch(text, /undefined|NaN|null/);
});
