// The Coach's briefing. The twelve fixtures from the briefing plan, with every number shifted so
// that nobody's real numbers are in this repo: the differences, and so the sentences, are the same.
// Each fixture also runs the four consistency rules and the size caps.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as b from '../js/briefing.js';
import * as c from '../js/coach.js';
import * as r from '../js/rules.js';
import { compose, WORDINGS } from '../js/briefing-words.js';
import { BRIEF } from '../js/coach-constants.js';
import { plan as basePlan } from '../js/plan.js';
import { liftName } from '../js/exercises.js';

const START = 92.0; // a made-up start weight
const GOAL = 77.5;
const T = 2200;
const P = 170;
const plan = { ...basePlan, sessionsPerWeek: 4 };
const s = (kg, reps) => ({ kg, reps });
const put = (days, key, patch) => { days[key] = { ...(days[key] ?? {}), ...patch }; };

const food = (kcal, protein) => ['breakfast', 'lunch', 'dinner'].map((m) => ({ id: m, meal: m, kcal: kcal / 3, protein: protein / 3, fat: 20, fibre: 8 }));
// One Thursday to Wednesday week ending on `to`.
function week(days, to, { avg = null, weighIns = 5, kcal = 2190, foodDays = 7, protein = 167, sessions = 4, steps = null } = {}) {
  for (let i = 0; i < 7; i++) {
    const d = {};
    if (avg !== null && i < weighIns) d.weightKg = avg;
    if (i < foodDays) d.food = food(kcal, protein);
    if (i < sessions) d.session = { type: 'done' };
    if (steps && i < 5) d.steps = steps;
    put(days, r.addDays(to, i - 6), d);
  }
}
// Sessions of some lifts: { [date]: { [liftId]: [kg, reps] } }, two equal sets each.
function lifts(days, byDate) {
  for (const [key, list] of Object.entries(byDate)) {
    put(days, key, { workout: { session: 'upperB', finished: true, minimum: false, half: false, lifts: Object.fromEntries(
      Object.entries(list).map(([id, [kg, reps]]) => [id, { sets: [s(kg, reps), s(kg, reps)], planned: 2, top: 12 }])) } });
  }
}
const NINE = ['incline-db-press', 'cable-row', 'chest-press', 'pec-deck', 'shoulder-press', 'lateral-raise', 'incline-curl', 'hammer-curl', 'spider-curl'];
const all = (fn) => Object.fromEntries(NINE.map((id, i) => [id, fn(id, i)]));

// A read the way briefing() builds one, with the plan line set by the fixture.
function read(R, days, { planOff = 0.4, pushExtra = [], history = [] } = {}) {
  const p = { ...plan, pushExtra };
  const A = r.addDays(R, -1);
  const probe = c.weekCheck({ key: R, days, T, P, targets: { fibre: 30, waterMl: 3000 }, plan: p, startKg: START });
  const wk = c.weekCheck({
    key: R, days, T, P, targets: { fibre: 30, waterMl: 3000 }, plan: p, startKg: START,
    planLine: probe.facts?.avg != null ? probe.facts.avg - planOff : null,
  });
  const t = c.liftTrends({ days, from: A, to: A, since: true });
  const waists = Object.keys(days).filter((k) => days[k].waistCm).sort();
  const lead = t.lifts.filter((l) => l.dir === 'up' && l.to > l.from).sort((x, y) => (y.to - y.from) - (x.to - x.from))[0];
  const since = {
    lifts: t.total >= 3 ? { u: t.up, m: t.total, down: t.down, lead: lead ? { id: lead.id, a: lead.from, b: lead.to } : null } : null,
    waist: waists.length >= 2 ? Math.round((days[waists.at(-1)].waistCm - days[waists[0]].waistCm) * 10) / 10 : null,
  };
  const input = { key: R, days, T, P, targets: {}, plan: p, startKg: START, goalKg: GOAL };
  // The event comes from the real look-ahead, by running the whole briefing for that day.
  const event = b.briefing(input).parts.next[0];
  const sel = b.selectWeek({
    R, wk, phase: r.phaseFor(R, p.phases), prevPhase: r.phaseFor(r.addDays(R, -7), p.phases),
    index: Math.floor(r.diffDays(A, c.firstWeekEnd(p)) / 7) + 1, since,
    event: /^N[123]/.test(event.id) ? event : null, startKg: START, goalKg: GOAL,
  }, history);
  return { sel, wk, text: compose(sel, { lift: liftName, index: 0 }) };
}
const ids = (list) => list.map((x) => x.id);

// ----- The rules that must hold for every briefing -----

const FROM = { X0: ['A0'], X1: ['A2'], X2: ['A2'], X2w: ['A2'], X3: ['A1'], X4: ['A2'], X5: ['A2'], X6: ['A2'], X7: ['A2'], X8: ['A2'], X9: ['A2'], X10: ['A2'], X11: ['A6'], X12: ['A3'], X13: ['A4'], X14: ['A5'], X15: ['A1'], X16c: ['A2'] };
const sentences = (list) => list.length;
const words = (text) => text.split(/\s+/).filter(Boolean).length;
function holds(sel, wk, text, label = '') {
  const fix = sel.parts.fix[0];
  const lineOf = (code) => wk.lines.find((l) => l.code === code);
  // 1. The fix is the card's first action, or a note on the card, or nothing.
  if (sel.summary.source === 'action') assert.ok(FROM[fix.id]?.includes(wk.actions[0]?.code), `${label}: fix ${fix.id} but the card's first action is ${wk.actions[0]?.code}`);
  if (['X16', 'X16b', 'X16q'].includes(fix.id)) assert.equal(wk.actions.length, 0, `${label}: "nothing to fix" while the card has an action`);
  // 2. Anything going well is something the card marks good.
  const GOOD = {
    G1: () => lineOf('F1')?.level === 'good', G2: () => wk.verdict.code === 'W6', G3: () => lineOf('F8')?.level === 'good',
    G3b: () => lineOf('F8')?.level === 'good', G4: () => lineOf('F7')?.level === 'good', G5: () => lineOf('F3')?.level === 'good',
    G6: () => wk.facts.foodDays >= 6, G7: () => wk.verdict.code === 'W3' && wk.verdict.level === 'good', G8: () => lineOf('F6')?.level === 'good',
  };
  for (const g of sel.parts.well) if (GOOD[g.id]) assert.ok(GOOD[g.id](), `${label}: ${g.id} is praised but the card does not mark it good`);
  // 3. An urgent verdict's own action is the fix (unless the target itself is under the floor).
  const urgent = wk.actions.find((a) => a.urgent);
  if (urgent && wk.actions[0].code !== 'A0') assert.ok(['X1', 'X2', 'X2w', 'X7'].includes(fix.id), `${label}: urgent ${urgent.type} but the fix is ${fix.id}`);
  // 4. The weight in Part 1 is the card's own average.
  const w = sel.parts.where[0].v.W;
  if (w !== undefined) assert.equal(w, wk.facts.avg, `${label}: Part 1 weight is not the card's`);
  // The caps.
  assert.ok(text.words <= BRIEF.maxWords, `${label}: ${text.words} words`);
  assert.ok(sentences(text.where) <= BRIEF.caps.where, `${label}: where has ${text.where.length} sentences`);
  assert.ok(sentences(text.well) <= BRIEF.caps.well, `${label}: well has ${text.well.length}`);
  assert.ok(sentences(text.fix) <= BRIEF.caps.fix + 1, `${label}: fix has ${text.fix.length}`);
  assert.ok(sentences(text.next) <= BRIEF.caps.next, `${label}: next has ${text.next.length}`);
  const everything = [...text.where, ...text.well, ...text.fix, ...text.next];
  for (const x of everything) {
    assert.ok(words(x) <= BRIEF.maxSentenceWords, `${label}: ${words(x)} words in "${x}"`);
    assert.doesNotMatch(x, /undefined|NaN|\[object|null|Infinity|[!?–—]/, `${label}: "${x}"`);
    assert.match(x, /[.]$/, `${label}: "${x}" does not end in a full stop`);
  }
  // At most two lift names, and at most one of them under "going well".
  const named = (list) => [...new Set(Object.values(NAMES_OF).filter((n) => list.join(' ').toLowerCase().includes(n.toLowerCase())))].length;
  assert.ok(named(everything) <= BRIEF.liftNames, `${label}: more than ${BRIEF.liftNames} lift names`);
  assert.ok(named(text.well) <= 1, `${label}: two lift names under going well`);
  // Never a number under the floor as something to eat.
  for (const m of everything.join(' ').matchAll(/(?:Get back to|Eat|Land on|Raise it to|Set it to|Eat at about|Eat about) ([\d,]+)/g)) {
    assert.ok(Number(m[1].replace(/,/g, '')) >= 1800, `${label}: "${m[0]}"`);
  }
}
const NAMES_OF = Object.fromEntries(NINE.map((id) => [id, liftName(id)]));

// ----- The fixtures -----

test('1. on pace in the 8th week, deload next: the big picture, nothing to fix', () => {
  const days = {};
  week(days, '2026-11-18', { avg: 89.4 }); week(days, '2026-11-25', { avg: 88.6 }); week(days, '2026-12-02', { avg: 87.9 });
  lifts(days, {
    '2026-10-10': all(() => [20, 10]),
    '2026-11-23': all((id, i) => [i < 6 ? 22.5 : 20, 10]),
    '2026-11-30': all((id, i) => [i < 6 ? 22.5 : 20, 10]),
  });
  put(days, '2026-10-10', { waistCm: 95.0 }); put(days, '2026-12-01', { waistCm: 93.0 });
  const { sel, wk, text } = read('2026-12-03', days);
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['P1.1'], ['B2', 'G1'], ['X16'], ['N1a']]);
  assert.deepEqual(text.where, ['Build, day 36 of 42.', 'You are at 87.9 kg, 4.1 down from 92.0, 10.4 to go.']);
  assert.deepEqual(text.well, ['Since the start: 4.1 kg down, 6 of 9 lifts up, waist 2.0 cm down.', 'Weight is dropping 0.9% a week, right on pace.']);
  assert.deepEqual(text.fix, ['Nothing to fix this week.', 'Leave the plan alone.']);
  assert.deepEqual(text.next, ['Deload starts Thursday 10 Dec: half the sets, same weights.', 'It will feel too easy, do it anyway.']);
  assert.equal(text.caption, 'Read of the week ending Wed 2 Dec. Next read Thursday 10 Dec.');
  holds(sel, wk, text, 'fixture 1');
});

test('2. flat for two weeks with food on target: the stall choice, and a lift by name', () => {
  const days = {};
  week(days, '2026-11-11', { avg: 89.6 }); week(days, '2026-11-18', { avg: 89.5 }); week(days, '2026-11-25', { avg: 89.5, kcal: 2220, foodDays: 6 });
  put(days, '2026-11-11', { waistCm: 94.2 }); put(days, '2026-11-25', { waistCm: 94.0 });
  lifts(days, {
    '2026-11-16': all((id) => [id === 'incline-db-press' ? 16 : 30, 10]),
    '2026-11-23': all((id, i) => (id === 'incline-db-press' ? [18, 10] : [30, i < 5 ? 11 : 10])),
  });
  const { sel, wk, text } = read('2026-11-26', days, { planOff: 1.6 });
  assert.equal(wk.verdict.code, 'W8');
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['P1.1', 'P1.2'], ['G3', 'G4'], ['X7'], ['N4']]);
  assert.deepEqual(text.where, ['Build, day 29 of 42.', 'You are at 89.5 kg, 2.5 down from 92.0, 12.0 to go.', 'That is 1.6 kg above the plan line.']);
  assert.deepEqual(text.well, ['5 of 9 lifts went up, led by Incline dumbbell press, 16 to 18 kg.', 'All 4 sessions done.']);
  assert.deepEqual(text.fix, ['Flat for 2 weeks with food on target.', 'Pick one: cut 150 kcal from carbs or fat, or add 2,000 steps a day.']);
  assert.deepEqual(text.next, ['Next read: Thursday 3 Dec.']);
  holds(sel, wk, text, 'fixture 2');
});

test('3. eating above target: that is why the scale is slow', () => {
  const days = {};
  week(days, '2026-11-04', { avg: 90.5 }); week(days, '2026-11-11', { avg: 90.3 }); week(days, '2026-11-18', { avg: 89.8, kcal: 2550, foodDays: 6, sessions: 3 });
  lifts(days, {
    '2026-11-09': all(() => [30, 10]),
    '2026-11-16': all((id, i) => [30, i < 4 ? 11 : i === 4 ? 9 : 10]),
  });
  const { sel, wk, text } = read('2026-11-19', days, { planOff: 0.7 });
  assert.equal(wk.verdict.code, 'W7');
  // 19 Nov is a photo day in the plan, so that is what comes next. The caption carries the next read.
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['P1.1'], ['G3b'], ['X6'], ['N3']]);
  assert.deepEqual(text.where, ['Build, day 22 of 42.', 'You are at 89.8 kg, 2.2 down from 92.0, 12.3 to go.']);
  assert.deepEqual(text.well, ['Lifts are holding.', 'In a deficit that is the job.']);
  assert.deepEqual(text.fix, ['Food averaged 2,550 kcal, 350 over target.', 'That is why the scale is slow.', 'Land on 2,200 before you touch the plan.']);
  assert.deepEqual(text.next, ['Photo day: Thursday 19 Nov.', 'Same light, same spot.']);
  assert.equal(text.caption, 'Read of the week ending Wed 18 Nov. Next read Thursday 26 Nov.');
  holds(sel, wk, text, 'fixture 3');
});

test('4. too fast, with a second action on the card', () => {
  const days = {};
  week(days, '2026-10-28', { avg: 91.5 }); week(days, '2026-11-04', { avg: 90.2 }); week(days, '2026-11-11', { avg: 88.8, protein: 173 });
  lifts(days, {
    '2026-10-26': all((id, i) => [i < 2 ? 50 : 30, 10]),
    '2026-11-02': all((id, i) => [i < 2 ? 47.5 : 30, 10]),
    '2026-11-09': all((id, i) => (i < 2 ? [45, 10] : [30, i < 5 ? 11 : 10])),
  });
  const { sel, wk, text } = read('2026-11-12', days, { planOff: -1.9 });
  assert.deepEqual(wk.actions.map((a) => a.code), ['A2', 'A3']);
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix)], [['P1.1', 'P1.2'], ['G4', 'G5'], ['X2']]);
  assert.deepEqual(text.where, ['Build, day 15 of 42.', 'You are at 88.8 kg, 3.2 down from 92.0, 11.3 to go.', 'That is 1.9 kg ahead of the plan line.']);
  assert.deepEqual(text.well, ['All 4 sessions done.', 'Protein averaged 173 g, in range.']);
  assert.deepEqual(text.fix, ['You are losing 1.5% a week.', 'Past 1% the muscle goes with the fat.', 'Add 150 kcal a day, from carbs.', 'The weekly card has one more.']);
  assert.deepEqual(text.next, ['Next read: Thursday 19 Nov.']);
  holds(sel, wk, text, 'fixture 4');
});

test('5. two lifts down two sessions running: both named in the fix, none under going well', () => {
  const days = {};
  week(days, '2026-11-04', { avg: 90.5 }); week(days, '2026-11-11', { avg: 89.8 }); week(days, '2026-11-18', { avg: 89.1 });
  lifts(days, {
    '2026-11-02': all((id, i) => [i < 2 ? 50 : 30, 10]),
    '2026-11-09': all((id, i) => [i < 2 ? 47.5 : 30, 10]),
    '2026-11-16': all((id, i) => (i < 2 ? [45, 10] : [30, i < 5 ? 11 : 10])),
  });
  const { sel, wk, text } = read('2026-11-19', days);
  assert.deepEqual([ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['G1', 'G4'], ['X12'], ['N3']]);
  assert.deepEqual(text.where, ['Build, day 22 of 42.', 'You are at 89.1 kg, 2.9 down from 92.0, 11.6 to go.']);
  assert.deepEqual(text.well, ['Weight is dropping 0.8% a week, right on pace.', 'All 4 sessions done.']);
  assert.deepEqual(text.fix, ['Incline dumbbell press and Seated cable row are down two sessions running.', 'Check sleep and food first.', 'If they drop again, deload early.']);
  holds(sel, wk, text, 'fixture 5');
});

test('6. the same logging gap for the third week: shorter and blunter, and stale praise rotates out', () => {
  const days = {};
  week(days, '2026-11-11', { avg: 90.0 }); week(days, '2026-11-18', { avg: 89.5 });
  week(days, '2026-11-25', { avg: 88.9, foodDays: 4, protein: 163, steps: 8100 });
  lifts(days, {
    '2026-11-16': all(() => [30, 10]),
    '2026-11-23': all((id, i) => [30, i < 3 ? 11 : i < 5 ? 9 : 10]),
  });
  const before = { fix: 'X3', well: ['G1', 'G4'], verdict: 'W11', level: 'good', foodDays: 4, sessions: 4, protein: 160, steps: null };
  const { sel, wk, text } = read('2026-11-26', days, { history: [{ ...before, repeat: 2 }, { ...before, repeat: 1 }] });
  assert.deepEqual([ids(sel.parts.well), ids(sel.parts.fix), sel.parts.fix[0].repeat], [['G5', 'G8'], ['X3'], 3]);
  assert.deepEqual(text.where, ['Build, day 29 of 42.', 'You are at 88.9 kg, 3.1 down from 92.0, 11.4 to go.']);
  assert.deepEqual(text.well, ['Protein averaged 163 g, in range.', 'Steps averaged 8,100, on target.']);
  assert.deepEqual(text.fix, ['Third week running: food was logged in full on 4 of 7 days.', 'Log every day this week.', 'Nothing else matters until this is fixed.']);
  assert.deepEqual(text.next, ['Next read: Thursday 3 Dec, and it needs 5 days of food and 4 weigh-ins.']);
  holds(sel, wk, text, 'fixture 6');
});

test('7. a quiet week shrinks, and tells you to stop checking', () => {
  const days = {};
  week(days, '2026-11-11', { avg: 89.9 }); week(days, '2026-11-18', { avg: 89.2 }); week(days, '2026-11-25', { avg: 88.5 });
  const { sel, wk, text } = read('2026-11-26', days, { history: [{ fix: 'X16', repeat: 1, well: ['G1', 'G4'], verdict: 'W11', level: 'good', foodDays: 7, sessions: 4, protein: 167, steps: null }] });
  assert.equal(sel.quiet, true);
  assert.deepEqual([ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['G1'], ['X16q'], ['N4q']]);
  assert.deepEqual([...text.where, ...text.well, ...text.fix, ...text.next], [
    'Build, day 29 of 42.', 'You are at 88.5 kg, 3.5 down from 92.0, 11.0 to go.',
    'Weight is dropping 0.8% a week, right on pace.', 'Nothing to fix.',
    'Nothing changes between Thursdays.', 'Next read Thursday 3 Dec.',
  ]);
  assert.ok(text.words < 40);
  holds(sel, wk, text, 'fixture 7');
});

test('8. the very first days: too early, and what to do until the first read', () => {
  const sel = b.briefing({ key: '2026-10-11', days: {}, T, P, targets: {}, plan, startKg: START, goalKg: GOAL });
  const text = compose(sel, { lift: liftName, index: 0 });
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['P1.6'], [], ['X17'], ['N0']]);
  assert.deepEqual(text.where, ['Foundation, day 4 of 21.', 'Too early for a read.']);
  assert.deepEqual(text.fix, ['Log every meal, weigh in every morning and do your sessions.', 'Nothing else counts yet.']);
  assert.deepEqual(text.next, ['First read: Thursday 15 Oct.']);
  // Only the day count moves before the first read.
  assert.deepEqual(compose(b.briefing({ key: '2026-10-13', days: {}, T, P, targets: {}, plan, startKg: START, goalKg: GOAL }), { index: 0 }).where[0], 'Foundation, day 6 of 21.');
});

test('9. the first fortnight: the weight is said but not counted, and the first weight read is dated', () => {
  const days = {};
  week(days, '2026-10-14', { avg: 90.6, foodDays: 5, protein: 165 });
  const { sel, wk, text } = read('2026-10-15', days);
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['P1.3'], ['G4', 'G5'], ['X16'], ['N4']]);
  assert.deepEqual(text.where, ['Foundation, day 8 of 21.', 'You are at 90.6 kg.', 'The early drop is mostly water, so it does not count yet.']);
  assert.deepEqual(text.well, ['All 4 sessions done.', 'Protein averaged 165 g, in range.']);
  assert.deepEqual(text.next, ['Next read: Thursday 22 Oct.', 'The first weight read is Thursday 12 Nov.']);
  holds(sel, wk, text, 'fixture 9');
});

test('10. the diet break at maintenance: nothing to fix, and when it ends', () => {
  const days = {};
  week(days, '2027-02-03', { avg: 82.1, kcal: 2640, foodDays: 6 });
  const { sel, wk, text } = read('2027-02-04', days);
  assert.deepEqual([wk.verdict.code, wk.verdict.level], ['W3', 'good']);
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['P1.1'], ['G7', 'G4'], ['X16b'], ['N1e']]);
  assert.deepEqual(text.where, ['Diet break, day 8 of 14.', 'You are at 82.1 kg, 9.9 down from 92.0, 4.6 to go.']);
  assert.deepEqual(text.well, ['Food is at maintenance and the weight is steady, which is the point of a break.', 'All 4 sessions done.']);
  assert.deepEqual(text.fix, ['Nothing to fix.', "Eat at maintenance, don't try to cut."]);
  assert.deepEqual(text.next, ['The break ends Wednesday 10 Feb.', 'The new calorie target is offered on Today the day after.']);
  holds(sel, wk, text, 'fixture 10');
});

test('11. a week with nothing logged, and the same again the week after', () => {
  const days = { '2026-11-15': { weightKg: 89 } };
  const { sel, wk, text } = read('2026-11-19', days);
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['P1.5'], [], ['X15'], ['N4']]);
  assert.deepEqual(text.where, ['Build, day 22 of 42.', 'Nothing was logged this week, so there is no read.']);
  assert.deepEqual(text.fix, ["A week with no log is a week I can't coach.", 'Log everything starting today.']);
  assert.deepEqual(text.next, ['Next read: Thursday 26 Nov, and it needs 5 days of food and 4 weigh-ins.']);
  holds(sel, wk, text, 'fixture 11');
  const again = (repeat) => read('2026-11-19', days, { history: [{ fix: 'X15', repeat, well: [], verdict: wk.verdict.code, level: 'note', foodDays: 0, sessions: 0, protein: null, steps: null }] }).text.fix;
  assert.deepEqual(again(1), ["Second week running: a week with no log is a week I can't coach.", 'Log everything starting today.']);
  assert.deepEqual(again(2), ['Third week running: nothing logged.', 'Log everything starting today.', 'Nothing else matters until this is fixed.']);
  assert.match(again(7)[0], /^Week 8 running: /);
});

test('12. the first read after a phase ends: what the phase did, and what starts next', () => {
  const days = {};
  week(days, '2026-11-25', { avg: 88.1 }); week(days, '2026-12-02', { avg: 87.4 }); week(days, '2026-12-09', { avg: 86.7 });
  lifts(days, {
    '2026-10-10': all((id) => [id === 'incline-db-press' ? 12 : 20, 10]),
    '2026-11-30': all((id, i) => (id === 'incline-db-press' ? [18, 10] : [i < 7 ? 22.5 : 20, 10])),
    '2026-12-07': all((id, i) => (id === 'incline-db-press' ? [18, 10] : [i < 7 ? 22.5 : 20, 10])),
  });
  const { sel, wk, text } = read('2026-12-10', days, { pushExtra: ['Side delts', 'Calves'] });
  assert.deepEqual([ids(sel.parts.where), ids(sel.parts.well), ids(sel.parts.fix), ids(sel.parts.next)], [['P1.1'], ['B1a', 'G1'], ['X16'], ['N1c']]);
  assert.deepEqual(text.where, ['Deload, day 1 of 7.', 'You are at 86.7 kg, 5.3 down from 92.0, 9.2 to go.']);
  assert.deepEqual(text.well, ['Build is done: 7 of 9 lifts went up, led by Incline dumbbell press, 12 to 18 kg.', 'Weight is dropping 0.8% a week, right on pace.']);
  assert.deepEqual(text.next, ['Push starts Thursday 17 Dec: an extra set for Side delts and Calves.', 'Effort goes to 0 to 2 reps in the tank.']);
  holds(sel, wk, text, 'fixture 12');
});

// ----- Things the plan did not cover, and the audit's additions -----

test('a fix that has just cleared is said once, first', () => {
  const days = {};
  week(days, '2026-11-11', { avg: 89.9 }); week(days, '2026-11-18', { avg: 89.2 }); week(days, '2026-11-25', { avg: 88.5, foodDays: 7 });
  const { sel, text } = read('2026-11-26', days, { history: [{ fix: 'X3', repeat: 2, well: ['G4'], verdict: 'W11', level: 'good', foodDays: 3, sessions: 4, protein: 167, steps: null }] });
  assert.equal(sel.parts.well[0].id, 'G9a');
  assert.equal(text.well[0], 'Food logged in full on 7 of 7 days, up from 3: that fix worked.');
  assert.equal(sel.parts.fix[0].repeat, 1);
});

test('a target set under 1,800 is the fix, ahead of everything, and it never escalates into advice to eat it', () => {
  const days = {};
  week(days, '2026-11-11', { avg: 89.9 }); week(days, '2026-11-18', { avg: 89.2 }); week(days, '2026-11-25', { avg: 88.5, foodDays: 2 });
  const sel = b.briefing({ key: '2026-11-26', days, T: 1700, P, targets: {}, plan, startKg: START, goalKg: GOAL });
  const text = compose(sel, { index: 0 });
  assert.equal(sel.parts.fix[0].id, 'X0');
  assert.match(text.fix.join(' '), /Raise it to 1,800 or more in Settings/);
  assert.doesNotMatch([...text.where, ...text.well, ...text.fix, ...text.next].join(' '), /(Get back to|Eat|Land on) 1,7/);
});

test('rising with food logged on too few days: the log is the fix, not "hold"', () => {
  const days = {};
  week(days, '2026-11-11', { avg: 88.0, foodDays: 2 }); week(days, '2026-11-18', { avg: 88.6, foodDays: 2 }); week(days, '2026-11-25', { avg: 89.2, foodDays: 2 });
  const { sel, wk } = read('2026-11-26', days);
  assert.equal(wk.verdict.code, 'W9');
  assert.deepEqual(wk.actions.map((a) => a.code), ['A1', 'A2']);
  assert.equal(sel.parts.fix[0].id, 'X3');
  assert.equal(sel.parts.fix[0].tail, true);
});

test('the words hold still from one read to the next, and change with the week', () => {
  const days = {};
  week(days, '2026-11-11', { avg: 89.9 }); week(days, '2026-11-18', { avg: 89.2 }); week(days, '2026-11-25', { avg: 88.5 });
  const on = (key) => { const sel = b.briefing({ key, days, T, P, targets: {}, plan, startKg: START, goalKg: GOAL }); return JSON.stringify([sel.parts, compose(sel, { lift: liftName })]); };
  const thursday = on('2026-11-26');
  for (const key of ['2026-11-27', '2026-11-29', '2026-11-30', '2026-12-02']) assert.equal(on(key), thursday, `the briefing moved on ${key}`);
  assert.notEqual(on('2026-12-03'), thursday);
  // Wording A and B are different sentences for the same choice.
  const sel = b.briefing({ key: '2026-11-26', days, T, P, targets: {}, plan, startKg: START, goalKg: GOAL });
  assert.notDeepEqual(compose(sel, { index: 0 }).well, compose(sel, { index: 1 }).well);
});

test('nothing is stored and nothing is changed: the same input gives the same briefing', () => {
  const days = {};
  week(days, '2026-11-11', { avg: 89.9 }); week(days, '2026-11-18', { avg: 89.2 }); week(days, '2026-11-25', { avg: 88.5 });
  const freeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
  const input = freeze({ key: '2026-11-26', days, T, P, targets: {}, plan: { ...plan }, startKg: START, goalKg: GOAL });
  assert.deepEqual(b.briefing(input), b.briefing(input));
});

test('voice: no banned word, no dash, no question, no cheerleading in the briefing wording', () => {
  const source = readFileSync(new URL('../js/briefing-words.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  for (const banned of ['lazy', 'weak', 'pathetic', 'excuses', 'cheat', 'cheated', 'bad food', 'clean food', 'you always', 'you never', 'just', 'great job', 'proud', 'amazing']) {
    assert.doesNotMatch(source, new RegExp(`\\b${banned}\\b`, 'i'), `"${banned}" is in the briefing wording`);
  }
  assert.doesNotMatch(source, /[–—]/, 'a dash is in the wording');
  assert.doesNotMatch(source, /\b(color|center|program|gray|fiber|meter)\b/i);
  // Every template has an A and a B.
  for (const [id, list] of Object.entries(WORDINGS)) assert.ok(Array.isArray(list) && list.length >= 2, `${id} has ${list.length} wording`);
});

// ----- Stress: made-up people, every day of the plan -----

import { sessions } from '../js/exercises.js';

for (const e of Object.values(sessions).flat()) NAMES_OF[e.id] = e.name;

function rng(seed) {
  let x = seed;
  const next = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
  next.int = (a, z) => a + Math.floor(next() * (z - a + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  return next;
}
function randomLog(rnd) {
  const days = {};
  let kg = 84 + rnd() * 14;
  const drift = (rnd() - 0.75) * 0.25;
  const weighP = rnd.pick([0.15, 0.6, 0.9, 1]);
  const foodP = rnd.pick([0.1, 0.6, 0.9, 1]);
  const kcal = rnd.pick([1500, 1950, 2200, 2500, 2900]);
  const creatineFrom = rnd.chance(0.4) ? r.addDays(basePlan.start, rnd.int(0, 100)) : null;
  const gap = rnd.chance(0.4) ? [r.addDays(basePlan.start, rnd.int(20, 90)), rnd.int(7, 21)] : null; // a stretch with nothing logged
  for (let k = basePlan.start; k <= '2027-03-20'; k = r.addDays(k, 1)) {
    kg += drift + (rnd() - 0.5) * 0.4;
    if (gap && k >= gap[0] && k < r.addDays(gap[0], gap[1])) continue;
    const d = {};
    if (rnd.chance(weighP)) d.weightKg = Math.round(kg * 10) / 10;
    if (rnd.chance(foodP)) d.food = Array.from({ length: rnd.int(1, 5) }, () => ({ meal: rnd.pick(['breakfast', 'lunch', 'snack', 'dinner']), kcal: Math.round((kcal / 3) * (0.5 + rnd())), protein: rnd.chance(0.1) ? null : rnd.int(5, 75), fat: rnd.int(2, 40), fibre: rnd.chance(0.4) ? null : rnd.int(0, 15) }));
    if (rnd.chance(0.5)) d.steps = rnd.int(1000, 14000);
    if (rnd.chance(0.06)) d.waistCm = Math.round((85 + rnd() * 10) * 10) / 10;
    if (creatineFrom && k >= creatineFrom && rnd.chance(0.8)) d.creatine = true;
    if (rnd.chance(0.5)) {
      d.session = { type: rnd.pick(['done', 'done', 'min', 'missed']) };
      if (d.session.type !== 'missed') {
        const id = rnd.pick(Object.keys(sessions));
        d.workout = { session: id, finished: true, minimum: d.session.type === 'min', half: rnd.chance(0.08), lifts: Object.fromEntries(
          sessions[id].filter(() => rnd.chance(0.85)).map((ex) => [ex.id, {
            sets: Array.from({ length: rnd.int(1, 4) }, () => (ex.kind === 'body' ? { reps: rnd.int(3, 20) } : { kg: rnd.pick([10, 15, 20, 30, 40]), reps: rnd.int(3, 20) })),
            planned: ex.sets, top: ex.reps[1],
          }])) };
      }
    }
    if (Object.keys(d).length) days[k] = d;
  }
  return days;
}

test('stress: every briefing agrees with its card, keeps to its size, and holds still between reads', () => {
  const rnd = rng(909);
  const reached = new Set();
  let quietSeen = 0;
  for (let person = 0; person < 8; person++) {
    const days = randomLog(rnd);
    const target = rnd.pick([1700, 1900, 2200, 2400, 3000]);
    const p = { ...plan, pushExtra: rnd.chance(0.5) ? ['Side delts', 'Calves'] : [] };
    const input = { days, T: target, P: rnd.pick([140, 170]), targets: { fibre: 30, waterMl: 3000 }, plan: p, startKg: START, goalKg: GOAL, targetChangedOn: rnd.chance(0.4) ? r.addDays(p.start, rnd.int(10, 150)) : null };
    let before = null;
    for (let key = r.addDays(p.start, -2); key <= '2027-03-25'; key = r.addDays(key, 1)) {
      const sel = b.briefing({ ...input, key });
      const text = compose(sel, { lift: liftName });
      const label = `person ${person} on ${key}`;
      const wk = c.weekCheck({ ...input, key, planLine: r.planWeight(r.addDays(sel.read, -1), p, START, GOAL) });
      holds(sel, wk, text, label);
      for (const part of ['where', 'well', 'fix', 'next']) for (const it of sel.parts[part]) reached.add(it.id);
      // A watch on the card is never met with "nothing to fix".
      if (wk.verdict.level === 'watch') assert.ok(!['X16', 'X16b', 'X16q', 'X17'].includes(sel.parts.fix[0].id), `${label}: a watch, but nothing to fix`);
      // Part 1 and the fix are always there. Going well is only left out when there is nothing to read.
      assert.ok(text.where.length >= 1 && text.fix.length >= 1 && text.next.length >= 1, label);
      if (sel.quiet) { quietSeen++; assert.ok(text.words < 40, `${label}: a quiet week of ${text.words} words`); }
      // Between two reads nothing moves, except on the day the calorie target is changed.
      const now = JSON.stringify([sel.parts, text]);
      if (before && before.read === sel.read && sel.week && key !== input.targetChangedOn) assert.equal(now, before.text, `${label}: the briefing moved between reads`);
      before = { read: sel.read, text: now };
      assert.deepEqual(b.briefing({ ...input, key }).parts, sel.parts);
    }
  }
  for (const id of ['P1.1', 'P1.3', 'P1.4', 'P1.5', 'P1.6', 'G0', 'G4', 'X3', 'X15', 'X16', 'X17', 'N0', 'N4', 'N1a', 'N1b', 'N1e', 'N2']) assert.ok(reached.has(id), `${id} was never reached`);
});

test('wording that only real use shows: extra sessions, a weight equal to the start, and reads after the break', () => {
  // Five sessions in a week is not "5 of 4".
  const days = {};
  week(days, '2026-11-11', { avg: 89.9 }); week(days, '2026-11-18', { avg: 89.2 }); week(days, '2026-11-25', { avg: 88.5, sessions: 5 });
  const five = read('2026-11-26', days).text;
  assert.ok(five.well.includes('5 sessions done, 4 planned.'), five.well.join(' '));
  assert.doesNotMatch([...five.where, ...five.well].join(' '), /5 of 4/);
  // A weight that equals the start weight is not "0.0 down".
  const same = {};
  week(same, '2026-11-11', { avg: START }); week(same, '2026-11-18', { avg: START }); week(same, '2026-11-25', { avg: START });
  assert.match(read('2026-11-26', same).text.where[1], /the same as your 92\.0 start/);
  // After the diet break it is "weight reads restart", not "the first weight read".
  const after = {};
  week(after, '2027-02-17', { avg: 80 });
  const text = read('2027-02-18', after).text;
  assert.match(text.next.join(' '), /Weight reads restart Thursday 11 Mar/);
  assert.doesNotMatch(text.next.join(' '), /first weight read/);
});
