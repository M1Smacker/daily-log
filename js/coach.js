// The Coach: fixed rules that grade what was logged against the plan.
//
// Every function here is pure. The same input always gives the same output, nothing is read from
// or written to stored data, and nothing is saved: a verdict is worked out again each time, so
// editing a past day changes its verdict and nothing goes stale.
//
// A verdict is { code, level, n }:
//   code   the rule, for example 'L3'. The sentence for it lives in coach-words.js, and tests
//          read the code, never the sentence.
//   level  'good' (nothing to do), 'note' (worth knowing), 'watch' (do one thing) or 'none'.
//   n      the numbers the rule used.
// Unlogged is unknown: a day with no entries is never 0 kcal, and a missing nutrient is never 0 g.

import * as rules from './rules.js';
import { LIFT, SETS, DAY, WEEK, LINES, RAILS, withinRails } from './coach-constants.js';

const { addDays, diffDays, weekday, workSets, workingKg, nextWeight, previousWeight, progression, setsOf } = rules;
const v = (code, level, n = {}) => ({ code, level, n });
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const round1 = (n) => Math.round(n * 10) / 10;
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

// ===== Lift check =====
// Was today's weight right for the rep range? It judges the first working set, the first set at
// the working weight or heavier. Later sets lose reps to fatigue, and "every set" is the jump
// rule's job. The jump rule is asked what the next sheet will say, so the Coach never promises
// a jump the sheet will not give.
//
//   sets      the sets as logged: [{ kg, reps }]
//   lo, hi    the rep range of the lift that day
//   kind      'barbell' | 'machine' | 'dumbbell' | 'body'
//   dumbbells the gym's dumbbells, lightest first
//   planned   the sets the sheet asked for
//   effort    [from, to] reps in reserve for the phase, or null
//   firstTime true when this lift has no history
//   alt       true when the alternative was done: the weight is not for this lift, so it stays silent
//   hasAlt    true when the lift lists an alternative
// Returns [] when silent, else the verdict and, for L2 and L3, the effort line L9.
export function liftCheck({ sets = [], lo, hi, kind, dumbbells = [], planned = 1, effort = null, firstTime = false, alt = false, hasAlt = false }) {
  if (alt) return [];
  const done = sets.filter((s) => s && s.reps > 0);
  if (!done.length || !(lo >= 1) || !(hi >= lo)) return [];
  const body = kind === 'body';
  let W = null;
  let first = done[0];
  if (!body) {
    const work = workSets(done).filter((s) => s.kg > 0);
    if (!work.length) return [];
    W = workingKg(work);
    first = work.find((s) => s.kg >= W);
  }
  const F = first.reps;
  const n = { F, lo, hi, kg: W, first: firstTime };

  const band = F >= hi + LIFT.aboveMargin ? 'above' : F > hi ? 'top' : F >= lo ? 'in' : lo - F <= LIFT.nearBelow ? 'near' : 'far';
  const level = { above: 'note', top: 'good', in: 'good', near: 'note', far: 'watch' }[band];

  if (body) {
    n.band = band;
    return [v('L7', level, n), ...(effort && (band === 'top' || band === 'in') ? [v('L9', 'none', { effort })] : [])];
  }

  const prog = progression({ kind, reps: [lo, hi] }, { sets: done, planned, top: hi }, dumbbells);
  n.jump = prog.type; // 'jump', 'extra', 'hold' or 'cap'
  n.next = prog.to ?? nextWeight(kind, W, dumbbells);
  n.need = prog.need ?? null;
  n.prev = previousWeight(kind, W, dumbbells);
  n.hasAlt = hasAlt;

  // On the heaviest dumbbell there is nothing to go up to.
  if (kind === 'dumbbell' && dumbbells.length >= 2 && W >= Math.max(...dumbbells) && F >= hi) {
    return [F >= hi + LIFT.aboveMargin ? v('L6b', 'note', n) : v('L6a', 'good', n)];
  }
  const code = { above: 'L1', top: 'L2', in: 'L3', near: 'L4', far: 'L5' }[band];
  return [v(code, level, n), ...(effort && (code === 'L2' || code === 'L3') ? [v('L9', 'none', { effort })] : [])];
}

// L8: a lift that went down two sessions running. scores: one strength score per session,
// oldest first, with deload, minimum and alternative sessions already left out.
export function liftBackwards(scores) {
  return rules.wentBackwards(scores) ? v('L8', 'watch', { sessions: 3 }) : null;
}

// ===== Sets check =====
// How many sets were done against the sets planned that day. Warm-ups (under 70% of the heaviest
// set) do not count. An extra set never changes the lift check.
//   load  'ramp' (Foundation), 'full' (Build, Push, Finish) or 'half' (deload, diet break)
//   lastKg  the working weight of the lift last time, for the deload rule
export function setsCheck({ sets = [], planned, load, lastKg = null }) {
  const done = sets.filter((s) => s && s.reps > 0);
  if (!done.length || !(planned >= 1)) return [];
  const work = workSets(done);
  const count = work.length;
  const out = [];
  const extra = count - planned;
  if (extra > 0) {
    const many = extra >= SETS.extraNoteAt;
    if (load === 'half') out.push(v('S7', 'note', { count, planned }));
    else if (load === 'ramp') out.push(many ? v('S3', 'note', { count, planned }) : v('S2', 'good', { count, planned }));
    else out.push(many ? v('S5', 'note', { count, planned }) : v('S4', 'good', { count, planned }));
  } else if (extra < 0) {
    out.push(v('S9', 'note', { short: -extra, count, planned }));
  }
  if (load === 'half' && isNum(lastKg)) {
    const kg = workingKg(work.filter((s) => s.kg > 0));
    if (kg > lastKg) out.push(v('S8', 'note', { kg, lastKg }));
  }
  return out;
}

// A Full session that looks like a Minimum one, or has lifts with nothing logged.
//   counts  the number of sets logged for each lift of the session, in order
export function sessionCheck({ minimum = false, finished = false, counts = [] }) {
  if (!finished || minimum || counts.length <= SETS.minimumLifts) return null;
  const head = counts.slice(0, SETS.minimumLifts);
  const tail = counts.slice(SETS.minimumLifts);
  if (head.every((c) => c >= 2) && tail.every((c) => c === 0)) return v('S10', 'note');
  const empty = counts.filter((c) => c === 0).length;
  return empty >= 3 ? v('S11', 'note', { n: empty }) : null;
}

// Direct sets per muscle over a run of days. muscleOf: lift id to muscle name, or undefined.
export function weeklySets({ days, from, to, muscleOf }) {
  const out = {};
  for (let k = from; k <= to; k = addDays(k, 1)) {
    for (const [id, lift] of Object.entries(days[k]?.workout?.lifts ?? {})) {
      const muscle = muscleOf(id);
      if (!muscle) continue;
      out[muscle] = (out[muscle] ?? 0) + workSets(setsOf(lift)).length;
    }
  }
  return out;
}
// S6: the most worked muscle, when it is past the ceiling.
export function ceilingCheck(counts) {
  const [muscle, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  return n > SETS.weeklyCeiling ? v('S6', 'watch', { muscle, n }) : null;
}

// ===== Day check =====

// What a day's entries add up to, without turning unknown into zero.
export function dayFacts(entries = []) {
  const f = { entries: entries.length, meals: 0, kcal: 0, kcalUnknown: false, protein: 0, proteinUnknown: false, fat: 0, fatUnknown: false, fibre: 0, fibreUnknown: false };
  const meals = new Set();
  for (const e of entries) {
    meals.add(e.meal ?? 'other');
    for (const m of ['kcal', 'protein', 'fat', 'fibre']) {
      if (isNum(e[m])) f[m] += e[m];
      else f[`${m}Unknown`] = true;
    }
  }
  f.meals = meals.size;
  for (const m of ['kcal', 'protein', 'fat', 'fibre']) f[m] = round1(f[m]);
  return f;
}
// A day that can be judged: enough was logged that a low number is not just a short log.
export const isJudgeable = (f) =>
  f.entries > 0 && !f.kcalUnknown && f.kcal >= DAY.judgeMinKcal && f.meals >= DAY.judgeMinMeals;

// One day. A closed day (past the 4 am rollover) is judged once and only if enough was logged.
// The open day says nothing, except one protein reminder after 7 pm.
//   entries  the day's food entries      kcalTarget T, proteinTarget P
//   steps, stepGoal   what was walked and that day's ramp target
//   maintenance  the day is inside the diet break, where the deficit target is not the aim
//   open     the day is still going       hour  the local hour now (for the open day)
// Returns { facts, judgeable, lines: [verdict], tick, evening }.
export function dayCheck({ entries = [], kcalTarget: T, proteinTarget: P, steps = null, stepGoal = null, maintenance = false, open = false, hour = null }) {
  const f = dayFacts(entries);
  const out = { facts: f, judgeable: false, lines: [], tick: false, evening: null };

  if (open) {
    if (hour !== null && hour >= DAY.eveningHour && f.entries > 0 && !f.kcalUnknown && !f.proteinUnknown && isNum(P) && isNum(T)) {
      const left = T - f.kcal;
      if (f.protein < DAY.eveningProteinShare * P && left > 0) {
        out.evening = v('D9', 'note', { g: Math.ceil(P - f.protein), kcalLeft: Math.round(left) });
      }
    }
    return out;
  }

  out.judgeable = isJudgeable(f);
  if (!out.judgeable) {
    out.lines.push(v('D0', 'none', { kcal: f.kcal, meals: f.meals, entries: f.entries }));
    return out;
  }

  // Line 1, energy. Priority: floor, then big, over, under, on target.
  const kcal = f.kcal;
  let energy;
  if (kcal < RAILS.kcalFloor) energy = v('D3', 'watch', { kcal, floor: RAILS.kcalFloor });
  else if (maintenance) energy = v('DB', kcal >= T ? 'good' : 'note', { kcal, T });
  else if (kcal > T + DAY.bigOver) energy = v('D5', 'note', { over: Math.round(kcal - T) });
  else if (kcal > T + DAY.onTargetAbove) {
    const over = Math.round(kcal - T);
    energy = v('D4', 'note', { over, fatKg: Math.round((over / DAY.kcalPerKgFat) * 100) / 100 });
  } else if (kcal < T - DAY.onTargetBelow) energy = v('D2', 'note', { under: Math.round(T - kcal) });
  else energy = v('D1', 'good', { kcal, T });
  out.lines.push(energy);

  // Line 2, protein, or the fat floor when protein is fine and fat was low.
  const goodAt = P - DAY.proteinGoodBelowTarget;
  const lowAt = P - DAY.proteinLowBelowTarget;
  let protein;
  if (f.proteinUnknown) {
    protein = v('D6u', f.protein >= goodAt ? 'good' : 'note', { atLeast: f.protein, goodAt });
  } else {
    protein = v('D6', f.protein >= goodAt ? 'good' : f.protein >= lowAt ? 'note' : 'watch', { g: f.protein, goodAt });
  }
  if (protein.level === 'good' && !f.fatUnknown && f.fat < RAILS.fatFloorG) {
    out.lines.push(v('D7', 'note', { g: f.fat, floor: RAILS.fatFloorG }));
  } else out.lines.push(protein);

  out.tick = isNum(steps) && steps > 0 && isNum(stepGoal) && steps >= stepGoal;
  return out;
}

// ===== Week check =====

// The last day of the latest finished week (the day before the week start, counting back).
export function weekEnd(key, weekStartDow) {
  const endDow = (weekStartDow + 6) % 7;
  let d = addDays(key, -1);
  while (weekday(d) !== endDow) d = addDays(d, -1);
  return d;
}
const spanOf = (to) => Array.from({ length: 7 }, (_, i) => addDays(to, i - 6));

// Days when the scale is expected to mislead: [from, to, why].
export function weightWindows({ plan, days }) {
  const out = [[plan.start, addDays(plan.start, WEEK.windowStartDays - 1), 'start']];
  for (const p of plan.phases) {
    if (p.maintenance) out.push([p.start, addDays(p.end ?? p.start, WEEK.windowAfterBreakDays), 'break']);
  }
  const firstCreatine = Object.keys(days).filter((k) => days[k]?.creatine).sort()[0];
  if (firstCreatine) out.push([firstCreatine, addDays(firstCreatine, WEEK.windowCreatineDays), 'creatine']);
  return out;
}

// Loss as a share of bodyweight per week. Positive is losing.
export function paceBand(rate) {
  if (rate > WEEK.fastPct) return 'fast';
  if (rate >= WEEK.onPacePct) return 'pace';
  if (rate >= WEEK.slowPct) return 'slow';
  if (rate >= -WEEK.risingPct) return 'flat';
  return 'rising';
}

// How each lift did in the latest session against the one before it. A lift is "up" when its
// working weight rose, or it stayed and the reps at that weight rose by 1 or more. Only lifts
// logged in two or more sessions count, and the latest of them has to fall inside [from, to].
export function liftTrends({ days, from, to }) {
  const history = {};
  for (const k of Object.keys(days).sort()) {
    if (k > to) break;
    const w = days[k]?.workout;
    if (!w || w.half) continue;
    for (const [id, lift] of Object.entries(w.lifts ?? {})) {
      if (lift?.alt) continue;
      const sets = workSets(setsOf(lift));
      if (!sets.length) continue;
      const kg = workingKg(sets.filter((s) => s.kg > 0));
      const at = sets.filter((s) => (s.kg ?? 0) === kg);
      (history[id] ??= []).push({
        key: k, kg, count: at.length, reps: at.reduce((a, s) => a + s.reps, 0),
        score: rules.bestSet(sets), minimum: Boolean(w.minimum),
      });
    }
  }
  const out = { up: 0, held: 0, down: 0, total: 0, downTwice: 0 };
  for (const list of Object.values(history)) {
    if (list.length < 2 || list.at(-1).key < from) continue;
    const [prev, cur] = list.slice(-2);
    let dir = 'held';
    if (cur.kg > prev.kg) dir = 'up';
    else if (cur.kg < prev.kg) dir = 'down';
    else {
      const d = cur.count === prev.count ? cur.reps - prev.reps : cur.reps / cur.count - prev.reps / prev.count;
      dir = d >= 1 ? 'up' : d <= -1 ? 'down' : 'held';
    }
    out[dir]++;
    out.total++;
    if (rules.wentBackwards(list.filter((x) => !x.minimum).map((x) => x.score))) out.downTwice++;
  }
  return out;
}

// The waist change between the newest reading and an earlier one 7 to 28 days before it,
// nearest to two weeks. Null with fewer than two readings that far apart.
export function waistChange(days, to) {
  const readings = Object.keys(days).filter((k) => k <= to && isNum(days[k]?.waistCm) && days[k].waistCm > 0).sort();
  const latest = readings.at(-1);
  if (!latest) return null;
  const earlier = readings
    .filter((k) => diffDays(latest, k) >= 7 && diffDays(latest, k) <= 28)
    .sort((a, b) => Math.abs(diffDays(latest, a) - 14) - Math.abs(diffDays(latest, b) - 14))[0];
  return earlier ? { cm: round1(days[latest].waistCm - days[earlier].waistCm), from: earlier, to: latest } : null;
}

// One verdict and at most two actions for the latest finished week (Thursday to Wednesday).
//   key       today
//   days      { 'YYYY-MM-DD': { weightKg, waistCm, steps, waterMl, food, creatine, session, workout } }
//   T, P      the calorie and protein targets
//   targets   { fibre, waterMl }
//   plan      { start, phases, steps: { from, weeklyAdd, target }, weekStartDow, sessionsPerWeek }
//   targetChangedOn   the day the calorie target last changed, or null
//   planLine  the kg the plan line says on the week's last day, or null
// Returns { week: { from, to }, verdict, actions: [{ code, ... }], lines: [verdict], soFar }.
export function weekCheck({ key, days, T, P, targets = {}, plan, targetChangedOn = null, planLine = null }) {
  const A = weekEnd(key, plan.weekStartDow);
  const sessionsPerWeek = plan.sessionsPerWeek ?? 4;
  const soFar = soFarCounts({ days, from: addDays(A, 1), to: addDays(key, -1) });

  if (diffDays(A, plan.start) < 6) {
    return { week: null, verdict: v('W0', 'note', { first: firstWeekEnd(plan) }), actions: [], lines: [], soFar };
  }

  const windows = weightWindows({ plan, days });
  const weeks = [0, 1, 2].map((i) => weekFacts({ days, to: addDays(A, -7 * i), windows, plan }));
  const [w0, w1, w2] = weeks;
  const usable = (w) => w.weighIns >= WEEK.weighIns && !w.window;
  const gateA = weeks.every(usable);
  const gateB = usable(w0) && usable(w1);
  const basis = gateA ? 3 : gateB ? 2 : 0;
  const rate = basis === 3 ? ((w2.avg - w0.avg) / 2 / w0.avg) * 100 : basis === 2 ? ((w1.avg - w0.avg) / w0.avg) * 100 : null;
  const kgWeek = basis === 3 ? (w2.avg - w0.avg) / 2 : basis === 2 ? w1.avg - w0.avg : null;
  const band = rate === null ? null : paceBand(rate);
  const food = w0.food;
  const trends = liftTrends({ days, from: w0.from, to: w0.to });
  const waist = waistChange(days, w0.to);
  const hundredth = (n) => Math.round(n * 100) / 100;
  const nums = { rate: rate === null ? null : hundredth(rate), kgWeek: kgWeek === null ? null : hundredth(kgWeek), avg: w0.avg };

  const actions = [];
  let verdict;
  let own = null; // the verdict's own action (A2)

  if (food.underFloor >= WEEK.floorDays) {
    verdict = v('W1', 'watch', { days: food.underFloor, T, floor: RAILS.kcalFloor });
    own = { code: 'A2', type: 'eat-to-floor', kcal: RAILS.kcalFloor };
  } else if (basis >= 2 && (rate > WEEK.fastPct || kgWeek > RAILS.maxLossKgPerWeek)) {
    verdict = v('W2', 'watch', nums);
    own = { code: 'A2', type: 'add-kcal', kcal: WEEK.addKcalWhenFast, newKcalTarget: T + WEEK.addKcalWhenFast, from: 'carbs' };
  } else if (w0.inBreak >= 4) {
    const enough = food.days >= WEEK.judgeableDays;
    const atMaintenance = enough && food.kcal >= T + DAY.breakMinOver;
    verdict = v('W3', atMaintenance ? 'good' : 'note', { kcal: food.kcal, days: food.days, T, enough });
  } else if (weeks.some((w) => w.window)) {
    const why = weeks.find((w) => w.window).window[2];
    verdict = v('W4', 'note', { why, until: windowClear(weeks, plan.weekStartDow), food: food.days });
  } else if (!gateA) {
    verdict = v('W5', 'note', { counts: [w2.weighIns, w1.weighIns, w0.weighIns], needed: WEEK.weighIns });
  } else {
    const flatish = ['flat', 'slow', 'rising'].includes(band);
    const settled = food.days >= WEEK.settledDays;
    const recomp = band === 'flat' && waist && waist.cm <= -WEEK.recompWaistCm && trends.total >= 2 && trends.up / trends.total >= WEEK.recompLiftsUp;
    if (recomp) {
      verdict = v('W6', 'good', { ...nums, waistCm: waist.cm, up: trends.up, total: trends.total });
    } else if (flatish && settled && food.kcal > T + WEEK.aboveTargetOver) {
      verdict = v('W7', 'note', { ...nums, kcal: food.kcal, days: food.days, T });
    } else if (band === 'flat') {
      const since = targetChangedOn && targetChangedOn >= w2.from ? targetChangedOn : null;
      if (since) {
        verdict = v('W8c', 'note', { since, until: addDays(since, 21), T });
      } else if (!settled) {
        verdict = v('W8a', 'note', { ...nums, days: food.days });
      } else if (food.kcal >= T - WEEK.stallWithin) {
        const cutTo = T - WEEK.cutKcal;
        const cut = withinRails({ newKcalTarget: cutTo, cuts: ['carbs', 'fat'] })
          ? { kcal: WEEK.cutKcal, newKcalTarget: cutTo, from: ['carbs', 'fat'] } : null;
        verdict = v('W8', 'watch', { ...nums, kcal: food.kcal, days: food.days, canCut: Boolean(cut), steps: WEEK.addSteps });
        own = { code: 'A2', type: 'stall-choice', cut, addSteps: WEEK.addSteps };
      } else {
        verdict = v('W8b', 'note', { ...nums, kcal: food.kcal, days: food.days, T });
      }
    } else if (band === 'rising') {
      verdict = v('W9', 'watch', nums);
    } else if (band === 'slow') {
      verdict = v('W10', 'note', { ...nums, kcal: food.kcal, days: food.days });
    } else {
      verdict = v('W11', 'good', { ...nums, kcal: food.kcal, days: food.days, sessions: w0.sessions, of: sessionsPerWeek });
    }
  }

  // Actions: at most two. When the verdict is a watch, its own action goes first.
  const candidates = [];
  if (food.days < 5) candidates.push({ code: 'A1', judged: food.days });
  if (own) candidates.push(own);
  if (trends.downTwice >= 2) candidates.push({ code: 'A3', n: trends.downTwice });
  const proteinLow = P - DAY.proteinGoodBelowTarget;
  if (food.proteinDays >= WEEK.judgeableDays && food.protein < proteinLow) candidates.push({ code: 'A4', g: Math.round(food.protein), goal: proteinLow });
  const stepGoal = rules.stepTarget(w0.to, plan.start, plan.steps);
  if (w0.stepDays >= LINES.stepsMinDays && w0.steps < LINES.stepsLowShare * stepGoal) candidates.push({ code: 'A5', steps: Math.round(w0.steps), goal: stepGoal });
  if (w0.sessions <= 1) candidates.push({ code: 'A6', done: w0.sessions, of: sessionsPerWeek });
  if (verdict.level === 'watch') candidates.sort((a, b) => (b.code === 'A2') - (a.code === 'A2'));
  for (const a of candidates) {
    if (actions.length >= 2) break;
    if (withinRails(a)) actions.push(a);
  }

  // Lines under the verdict: facts with a level.
  const lines = [];
  const inWindow = Boolean(w0.window);
  if (basis >= 2 && !inWindow && rate !== null) {
    lines.push(v('F1', { pace: 'good', slow: 'note', flat: 'note', fast: 'watch', rising: 'watch' }[band], { ...nums, band, weeks: basis }));
  }
  if (food.days >= WEEK.judgeableDays) {
    const inBreak = w0.inBreak >= 4;
    const over = food.kcal - T;
    let level;
    if (inBreak) level = food.kcal >= T + DAY.breakMinOver ? 'good' : 'note';
    else if (food.kcal < RAILS.kcalFloor || over > LINES.kcalNoteOver) level = 'watch';
    else level = Math.abs(over) <= WEEK.stallWithin ? 'good' : 'note';
    lines.push(v('F2', level, { kcal: food.kcal, days: food.days, T }));
  } else lines.push(v('F2', 'none', { days: food.days }));
  if (food.proteinDays >= WEEK.judgeableDays) {
    const g = food.protein;
    lines.push(v('F3', g >= P - LINES.proteinGoodBelowTarget ? 'good' : g >= P - LINES.proteinLowBelowTarget ? 'note' : 'watch',
      { g: Math.round(g), days: food.proteinDays, goal: P - LINES.proteinGoodBelowTarget }));
  }
  if (food.fibreDays >= WEEK.judgeableDays && isNum(targets.fibre)) {
    lines.push(v('F4', food.fibre >= LINES.fibreNoteUnder ? 'good' : 'note', { g: Math.round(food.fibre), days: food.fibreDays, goal: LINES.fibreNoteUnder }));
  }
  if (w0.waterDays >= LINES.waterMinDays && isNum(targets.waterMl)) {
    lines.push(v('F5', w0.water >= targets.waterMl ? 'good' : 'note', { ml: Math.round(w0.water), days: w0.waterDays, goalMl: targets.waterMl }));
  }
  if (w0.stepDays >= LINES.stepsMinDays) {
    lines.push(v('F6', w0.steps >= stepGoal ? 'good' : 'note', { steps: Math.round(w0.steps), days: w0.stepDays, goal: stepGoal }));
  }
  lines.push(v('F7', w0.sessions >= LINES.sessionsGood ? 'good' : w0.sessions >= LINES.sessionsNote ? 'note' : 'watch', { done: w0.sessions, of: sessionsPerWeek }));
  const heldOnPurpose = w0.heldDays >= 4; // a deload or diet break week keeps its weights on purpose
  if (trends.total >= 1 && !heldOnPurpose) {
    const level = trends.down >= LINES.liftsDownWatch || trends.downTwice >= 1 ? 'watch' : trends.down >= LINES.liftsDownNote ? 'note' : 'good';
    lines.push(v('F8', level, { up: trends.up, held: trends.held, down: trends.down, total: trends.total, downTwice: trends.downTwice }));
  }
  if (waist) {
    const level = waist.cm <= -LINES.waistChangeCm ? 'good' : waist.cm >= LINES.waistChangeCm ? 'note' : 'none';
    lines.push(v('F9', level, { cm: waist.cm, from: waist.from, to: waist.to }));
  }
  if (isNum(planLine) && w0.avg !== null && !inWindow && w0.weighIns >= WEEK.weighIns) {
    const diff = round1(w0.avg - planLine);
    const level = diff > LINES.planLineGood || -diff > LINES.planLineAheadNote ? 'note' : 'good';
    lines.push(v('F10', level, { diff, avg: w0.avg, planLine }));
  }

  return { week: { from: w0.from, to: w0.to }, verdict, actions, lines, soFar };
}

// ----- Week helpers -----

function weekFacts({ days, to, windows, plan }) {
  const span = spanOf(to);
  const weigh = span.map((k) => days[k]?.weightKg).filter((x) => isNum(x) && x > 0);
  const judged = span.map((k) => dayFacts(days[k]?.food ?? [])).filter(isJudgeable);
  const known = (m) => judged.filter((f) => !f[`${m}Unknown`]).map((f) => f[m]);
  const win = windows.find(([a, b]) => a <= to && b >= span[0]) ?? null;
  const logged = (m) => span.map((k) => days[k]?.[m]).filter((x) => isNum(x) && x > 0);
  return {
    from: span[0], to, weighIns: weigh.length, avg: weigh.length ? Math.round(mean(weigh) * 100) / 100 : null,
    window: win,
    inBreak: span.filter((k) => plan.phases.some((p) => p.maintenance && k >= p.start && k <= (p.end ?? k))).length,
    heldDays: span.filter((k) => rules.phaseFor(k, plan.phases)?.load === 'half').length,
    sessions: span.filter((k) => ['done', 'min'].includes(days[k]?.session?.type)).length,
    waterDays: logged('waterMl').length, water: mean(logged('waterMl')) ?? 0,
    stepDays: logged('steps').length, steps: mean(logged('steps')) ?? 0,
    food: {
      days: judged.length,
      kcal: Math.round(mean(judged.map((f) => f.kcal)) ?? 0),
      underFloor: judged.filter((f) => f.kcal < RAILS.kcalFloor).length,
      proteinDays: known('protein').length, protein: mean(known('protein')) ?? 0,
      fibreDays: known('fibre').length, fibre: mean(known('fibre')) ?? 0,
    },
  };
}

function soFarCounts({ days, from, to }) {
  if (to < from) return { from, to, sessions: 0, judgeable: 0, days: 0 };
  let sessions = 0; let judgeable = 0; let n = 0;
  for (let k = from; k <= to; k = addDays(k, 1)) {
    n++;
    if (['done', 'min'].includes(days[k]?.session?.type)) sessions++;
    if (isJudgeable(dayFacts(days[k]?.food ?? []))) judgeable++;
  }
  return { from, to, sessions, judgeable, days: n };
}

// The first day a week verdict can speak again: three finished weeks, all clear of the window.
function windowClear(weeks, weekStartDow) {
  const end = weeks.filter((w) => w.window).map((w) => w.window[1]).sort().at(-1);
  let d = addDays(end, 21);
  while (weekday(d) !== (weekStartDow + 6) % 7) d = addDays(d, 1);
  return addDays(d, 1);
}
function firstWeekEnd(plan) {
  let d = addDays(plan.start, 6);
  while (weekday(d) !== (plan.weekStartDow + 6) % 7) d = addDays(d, 1);
  return d;
}

// Every rule code the Coach can return. coach-words.js must have a sentence for each.
export const ALL_CODES = Object.freeze([
  'L1', 'L2', 'L3', 'L4', 'L5', 'L6a', 'L6b', 'L7', 'L8', 'L9',
  'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11',
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D6u', 'D7', 'D8', 'D9', 'DB',
  'W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W8a', 'W8b', 'W8c', 'W9', 'W10', 'W11',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10',
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
]);
