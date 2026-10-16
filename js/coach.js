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

const { addDays, diffDays, weekday, workSets, workingKg, previousWeight, progression, jumpGoal, setsOf, realSet } = rules;
const v = (code, level, n = {}) => ({ code, level, n });
// Lifts going down, protein, steps and sessions: what the easy fortnight does not press.
const FOCUS_QUIET = new Set(['A3', 'A4', 'A5', 'A6']);
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
//   load      the phase's load. In a deload or diet break ('half') the weight is held and sets
//             stop well short on purpose, so the reps say nothing about the weight: not judged.
// Returns [] when silent, else the verdict and, for L2 and L3, the effort line L9.
export function liftCheck({ sets = [], lo, hi, kind, dumbbells = [], planned = 1, effort = null, firstTime = false, alt = false, hasAlt = false, load = null }) {
  if (alt || !Array.isArray(sets)) return [];
  const done = sets.filter(realSet);
  if (!done.length || !(lo >= 1) || !(hi >= lo)) return [];
  if (load === 'half') return [v('LD', 'none', { effort })];
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
  // at: the weight set 1 was done with. opener: it was heavier than the working weight, so what
  // is said about it is about that set, and never "go lighter than the weight most sets used".
  const n = { F, lo, hi, kg: W, first: firstTime, at: body ? null : first.kg, opener: !body && first.kg > W };

  const band = F >= hi + LIFT.aboveMargin ? 'above' : F > hi ? 'top' : F >= lo ? 'in' : lo - F <= LIFT.nearBelow ? 'near' : 'far';
  const level = { above: 'note', top: 'good', in: 'good', near: 'note', far: 'watch' }[band];

  if (body) {
    n.band = band;
    return [v('L7', level, n), ...(effort && (band === 'top' || band === 'in') ? [v('L9', 'none', { effort })] : [])];
  }

  // Ask the jump rule itself: what the next sheet will do with these sets, and what it takes to
  // go up from this weight. The words are built from these, so they cannot disagree with it.
  const prog = progression({ kind, reps: [lo, hi] }, { sets: done, planned, top: hi }, dumbbells);
  const goal = jumpGoal(kind, W, hi, dumbbells);
  n.jump = prog.type; // 'jump', 'extra', 'hold' or 'cap'
  n.next = goal.to;
  n.goal = goal.need; // the reps every planned set has to reach before the weight goes up
  n.big = goal.big;
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
export function setsCheck({ sets = [], planned, load, lastKg = null } = {}) {
  const done = Array.isArray(sets) ? sets.filter(realSet) : [];
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
export function sessionCheck({ minimum = false, finished = false, counts = [] } = {}) {
  if (!finished || minimum || counts.length <= SETS.minimumLifts) return null;
  const head = counts.slice(0, SETS.minimumLifts);
  const tail = counts.slice(SETS.minimumLifts);
  if (head.every((c) => c >= 2) && tail.every((c) => c === 0)) return v('S10', 'note');
  // With nothing filled in at all, the recap simply has not been done yet: that is not a verdict.
  const empty = counts.filter((c) => c === 0).length;
  return empty >= 3 && empty < counts.length ? v('S11', 'note', { n: empty }) : null;
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
  // Only real entries count. Anything damaged is left out, not read as food.
  const all = Array.isArray(entries) ? entries.filter((e) => e && typeof e === 'object') : [];
  // "Ate nothing" marks are not food: they do not count as meals eaten. But a day where every
  // meal is either logged or marked is complete, whatever it adds up to.
  const list = all.filter((e) => !e.none);
  const f = { entries: list.length, meals: 0, kcal: 0, kcalUnknown: false, protein: 0, proteinUnknown: false, fat: 0, fatUnknown: false, fibre: 0, fibreUnknown: false,
    accounted: rules.MEAL_IDS.every((m) => all.some((e) => e.meal === m)) };
  const meals = new Set();
  for (const e of list) {
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
// A day that can be judged: enough was logged that a low number is not just a short log. Meals
// marked "ate nothing" can stand in for the two meals (one big meal and nothing else is a whole
// day), but never for the calorie minimum: a short log is still a short log.
export const isJudgeable = (f) =>
  f.entries > 0 && !f.kcalUnknown && f.kcal >= DAY.judgeMinKcal && (f.meals >= DAY.judgeMinMeals || f.accounted);

// One day. A closed day (past the 4 am rollover) is judged once and only if enough was logged.
// The open day says nothing, except one protein reminder after 7 pm.
//   entries  the day's food entries      kcalTarget T, proteinTarget P
//   steps, stepGoal   what was walked and that day's ramp target
//   maintenance  the day is inside the diet break, where the deficit target is not the aim
//   open     the day is still going       hour  the local hour now (for the open day)
// Returns { facts, judgeable, lines: [verdict], tick, evening }.
export function dayCheck({ entries = [], kcalTarget, proteinTarget: P, steps = null, stepGoal = null, maintenance = false, open = false, hour = null }) {
  // A target set under the floor is not one the Coach measures against or points at.
  const T = isNum(kcalTarget) ? Math.max(kcalTarget, RAILS.kcalFloor) : kcalTarget;
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
  const firstCreatine = Object.keys(days).filter((k) => rules.isDay(k) && days[k]?.creatine).sort()[0];
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
// since: compare the latest session with the very first one instead (the whole journey), with no
// need for it to fall inside the week.
// Returns the counts and each lift: { id, dir, from: kg before, to: kg now, downTwice }.
export function liftTrends({ days, from, to, since = false }) {
  const history = {};
  for (const k of Object.keys(days).sort()) {
    if (k > to) break;
    if (!rules.isDay(k)) continue;
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
  const out = { up: 0, held: 0, down: 0, total: 0, downTwice: 0, lifts: [] };
  for (const [id, list] of Object.entries(history)) {
    if (list.length < 2 || (!since && list.at(-1).key < from)) continue;
    const cur = list.at(-1);
    const prev = since ? list[0] : list.at(-2);
    let dir = 'held';
    if (cur.kg > prev.kg) dir = 'up';
    else if (cur.kg < prev.kg) dir = 'down';
    else {
      const d = cur.count === prev.count ? cur.reps - prev.reps : cur.reps / cur.count - prev.reps / prev.count;
      dir = d >= 1 ? 'up' : d <= -1 ? 'down' : 'held';
    }
    out[dir]++;
    out.total++;
    const twice = !since && rules.wentBackwards(list.filter((x) => !x.minimum).map((x) => x.score));
    if (twice) out.downTwice++;
    out.lifts.push({ id, dir, from: prev.kg, to: cur.kg, downTwice: twice });
  }
  return out;
}

// The waist change between the newest reading and an earlier one 7 to 28 days before it,
// nearest to two weeks. Null with fewer than two readings that far apart.
export function waistChange(days, to) {
  const readings = Object.keys(days).filter((k) => rules.isDay(k) && k <= to && isNum(days[k]?.waistCm) && days[k].waistCm > 0).sort();
  const latest = readings.at(-1);
  if (!latest || diffDays(to, latest) > 14) return null; // an old reading says nothing about now
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
export function weekCheck({ key, days, T: setTarget, P, targets = {}, plan, targetChangedOn: changed = null, planLine = null, startKg = null }) {
  // A target set under the floor is never what the Coach tells you to aim for: everything is
  // measured against the floor instead, and a line says the target is too low.
  const T = isNum(setTarget) ? Math.max(setTarget, RAILS.kcalFloor) : setTarget;
  // A date is only believed when it is a real day that has already come.
  const targetChangedOn = rules.isDay(changed) && changed <= key ? changed : null;
  const A = weekEnd(key, plan.weekStartDow);
  const sessionsPerWeek = plan.sessionsPerWeek ?? 4;
  const soFar = soFarCounts({ days, from: addDays(A, 1), to: addDays(key, -1) });

  if (diffDays(A, plan.start) < 6) {
    // Too early for a read, but never too early to say a target is set under the floor.
    const low = isNum(setTarget) && setTarget < RAILS.kcalFloor;
    return {
      week: null, verdict: v('W0', 'note', { first: firstWeekEnd(plan) }),
      actions: low ? [{ code: 'A0', T: setTarget, floor: RAILS.kcalFloor }] : [],
      lines: low ? [v('F0', 'watch', { T: setTarget, floor: RAILS.kcalFloor })] : [],
      soFar, facts: null,
    };
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
  const fed = food.days >= WEEK.judgeableDays; // enough judgeable days to quote a food average at all
  const foodNums = { kcal: fed ? food.kcal : null, days: food.days };
  const trends = liftTrends({ days, from: w0.from, to: w0.to });
  const waist = waistChange(days, w0.to);
  const hundredth = (n) => Math.round(n * 100) / 100;
  // rate1 is the rate as it is shown, rounded once from the real figure. Rounding the rounded
  // rate again can land on the wrong side (0.853 would show as 0.8).
  const nums = { rate: rate === null ? null : hundredth(rate), rate1: rate === null ? null : Math.round(rate * 10) / 10, kgWeek: kgWeek === null ? null : hundredth(kgWeek), avg: w0.avg };

  // A rough maintenance figure, for the diet break. Null when there is nothing to work it out from.
  const lastAvg = weeks.map((w) => w.avg).find((a) => a !== null) ?? null;
  const maintenance = lastAvg === null ? null : rules.maintenanceKcal(T, plan.deficitKcal, startKg, lastAvg);

  const actions = [];
  let verdict;
  // The verdict's own action (A2). Every piece of advice is an action, never buried in the
  // verdict's sentence. urgent: it goes first on the card whatever else applies.
  let own = null;

  if (food.underFloor >= WEEK.floorDays) {
    verdict = v('W1', 'watch', { days: food.underFloor, T, floor: RAILS.kcalFloor });
    own = { code: 'A2', type: 'eat-to-floor', kcal: RAILS.kcalFloor, urgent: true };
  } else if (basis >= 2 && (rate > WEEK.fastPct || kgWeek > RAILS.maxLossKgPerWeek)) {
    verdict = v('W2', 'watch', nums);
    // The rate looks back two weeks. A target changed inside them has not had time to show, so
    // asking for another 150 would stack one change on top of the other.
    const since = targetChangedOn && targetChangedOn >= w1.from ? targetChangedOn : null;
    own = since
      ? { code: 'A2', type: 'changed', since, urgent: true }
      : { code: 'A2', type: 'add-kcal', kcal: WEEK.addKcalWhenFast, newKcalTarget: T + WEEK.addKcalWhenFast, from: 'carbs', urgent: true };
  } else if (w0.inBreak >= 4) {
    const enough = food.days >= WEEK.judgeableDays;
    const atMaintenance = enough && food.kcal >= T + DAY.breakMinOver;
    verdict = v('W3', atMaintenance ? 'good' : 'note', { kcal: food.kcal, days: food.days, T, enough });
    if (enough && !atMaintenance) own = { code: 'A2', type: 'break-eat', kcal: food.kcal, maintenance };
  } else if (weeks.some((w) => w.window)) {
    const latest = weeks.filter((w) => w.window).map((w) => w.window).sort((a, b) => (a[1] < b[1] ? 1 : -1))[0];
    verdict = v('W4', 'note', { why: latest[2], until: clearDay(latest[1], plan.weekStartDow), needed: WEEK.weighIns });
  } else if (!gateA) {
    verdict = v('W5', 'note', { counts: [w2.weighIns, w1.weighIns, w0.weighIns], needed: WEEK.weighIns });
    own = { code: 'A2', type: 'weigh', counts: [w2.weighIns, w1.weighIns, w0.weighIns], needed: WEEK.weighIns };
  } else {
    const flatish = ['flat', 'slow', 'rising'].includes(band);
    const settled = food.days >= WEEK.settledDays;
    const recomp = band === 'flat' && waist && waist.cm <= -WEEK.recompWaistCm && trends.total >= 2 && trends.up / trends.total >= WEEK.recompLiftsUp;
    if (recomp) {
      verdict = v('W6', 'good', { ...nums, waistCm: waist.cm, up: trends.up, total: trends.total });
    } else if (flatish && settled && food.kcal > T + WEEK.aboveTargetOver) {
      verdict = v('W7', 'note', { ...nums, band, kcal: food.kcal, days: food.days, T });
      own = { code: 'A2', type: 'aim', kcal: T, over: Math.round(food.kcal - T), band };
    } else if (band === 'flat') {
      const since = targetChangedOn && targetChangedOn >= w2.from ? targetChangedOn : null;
      if (since) {
        verdict = v('W8c', 'note', { since, until: clearDay(since, plan.weekStartDow), T });
        own = { code: 'A2', type: 'wait', since, until: clearDay(since, plan.weekStartDow) };
      } else if (!settled) {
        verdict = v('W8a', 'note', { ...nums, days: food.days });
      } else if (food.kcal >= T - WEEK.stallWithin) {
        const cutTo = T - WEEK.cutKcal;
        const cut = withinRails({ newKcalTarget: cutTo, cuts: ['carbs', 'fat'] })
          ? { kcal: WEEK.cutKcal, newKcalTarget: cutTo, from: ['carbs', 'fat'] } : null;
        verdict = v('W8', 'watch', { ...nums, kcal: food.kcal, days: food.days, canCut: Boolean(cut), steps: WEEK.addSteps });
        own = { code: 'A2', type: 'stall-choice', cut, addSteps: WEEK.addSteps, urgent: true };
      } else {
        verdict = v('W8b', 'note', { ...nums, kcal: food.kcal, days: food.days, T });
        own = { code: 'A2', type: 'log-all', kcal: food.kcal, T };
      }
    } else if (band === 'rising') {
      verdict = v('W9', 'watch', nums);
      own = { code: 'A2', type: 'hold-rising' };
    } else if (band === 'slow') {
      verdict = v('W10', 'note', { ...nums, ...foodNums });
      own = { code: 'A2', type: 'hold-slow' };
    } else {
      verdict = v('W11', 'good', { ...nums, ...foodNums, sessions: w0.sessions, of: sessionsPerWeek });
    }
  }

  // Actions: at most two, in this order. Safety first (a target under the floor, eating under it,
  // losing too fast) and the stall choice. Then the log, because nothing else can be judged
  // without it. Then the verdict's own advice, sessions, lifts, protein and steps.
  const candidates = [];
  if (isNum(setTarget) && setTarget < RAILS.kcalFloor) candidates.push({ code: 'A0', T: setTarget, floor: RAILS.kcalFloor });
  if (own?.urgent) candidates.push(own);
  if (food.days < 5) candidates.push({ code: 'A1', judged: food.days });
  if (own && !own.urgent) candidates.push(own);
  if (w0.sessions <= 1) candidates.push({ code: 'A6', done: w0.sessions, of: sessionsPerWeek });
  const twice = trends.lifts.filter((l) => l.downTwice).map((l) => l.id);
  if (trends.downTwice >= 2) candidates.push({ code: 'A3', n: trends.downTwice, lifts: twice });
  const proteinLow = P - DAY.proteinGoodBelowTarget;
  if (food.proteinDays >= WEEK.judgeableDays && food.protein < proteinLow) candidates.push({ code: 'A4', g: Math.round(food.protein), goal: proteinLow });
  const stepGoal = rules.stepTarget(w0.to, plan.start, plan.steps);
  if (w0.stepDays >= LINES.stepsMinDays && w0.steps < LINES.stepsLowShare * stepGoal) candidates.push({ code: 'A5', steps: Math.round(w0.steps), goal: stepGoal });
  // The easy fortnight asks for two things only, so sessions, lifts, protein and steps are not
  // pressed in a week that touches it. Safety, the log and the verdict's own advice still are.
  const f = plan.focus;
  const quiet = Boolean(f && rules.isDay(f.from) && rules.isDay(f.to) && w0.from <= f.to && w0.to >= f.from);
  for (const a of candidates) {
    if (actions.length >= 2) break;
    if (quiet && FOCUS_QUIET.has(a.code)) continue;
    if (withinRails(a)) actions.push(a);
  }

  // Lines under the verdict: facts with a level.
  const lines = [];
  if (isNum(setTarget) && setTarget < RAILS.kcalFloor) lines.push(v('F0', 'watch', { T: setTarget, floor: RAILS.kcalFloor }));
  const inWindow = Boolean(w0.window);
  if (basis === 3) {
    lines.push(v('F1', { pace: 'good', slow: 'note', flat: 'note', fast: 'watch', rising: 'watch' }[band], { ...nums, band, weighIns: w0.weighIns }));
  } else if (w0.avg !== null && !inWindow) {
    // Not enough usable weeks for a pace: the average is a fact, the pace would be a guess.
    lines.push(v('F1', 'none', { avg: w0.avg, rate: null, band: null, weighIns: w0.weighIns }));
  }
  if (food.days >= WEEK.judgeableDays) {
    const inBreak = w0.inBreak >= 4;
    const over = food.kcal - T;
    let level;
    if (inBreak) level = food.kcal >= T + DAY.breakMinOver ? 'good' : 'note';
    else if (food.kcal < RAILS.kcalFloor || over > LINES.kcalNoteOver) level = 'watch';
    else level = Math.abs(over) <= WEEK.stallWithin ? 'good' : 'note';
    lines.push(v('F2', level, { kcal: food.kcal, days: food.days, T }));
  } else lines.push(v('F2', 'none', { kcal: null, days: food.days }));
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

  // The same facts the verdict, the actions and the lines were built from, for the briefing.
  // It reads these and never works out a second opinion.
  const facts = {
    weighIns: w0.weighIns, avg: w0.avg, basis, rate: nums.rate, rate1: nums.rate1, band: basis === 3 ? band : null,
    window: w0.window ? w0.window[2] : null, inBreak: w0.inBreak >= 4,
    until: verdict.code === 'W4' ? verdict.n.until : null,
    foodDays: food.days, kcal: fed ? food.kcal : null,
    protein: food.proteinDays >= WEEK.judgeableDays ? Math.round(food.protein) : null,
    sessions: w0.sessions, of: sessionsPerWeek,
    steps: w0.stepDays >= LINES.stepsMinDays ? Math.round(w0.steps) : null, stepGoal,
    lifts: trends.lifts, liftsUp: trends.up, liftsDown: trends.down, liftsTotal: trends.total,
    T, P, maintenance, allActions: candidates.filter(withinRails).length,
    quiet, // the week touches the easy fortnight
  };
  return { week: { from: w0.from, to: w0.to }, verdict, actions, lines, soFar, facts };
}

// ----- Week helpers -----

function weekFacts({ days, to, windows, plan }) {
  const span = spanOf(to);
  const weigh = span.map((k) => days[k]?.weightKg).filter((x) => isNum(x) && x > 0);
  const judged = span.map((k) => dayFacts(days[k]?.food ?? [])).filter(isJudgeable);
  const known = (m) => judged.filter((f) => !f[`${m}Unknown`]).map((f) => f[m]);
  // When two quiet periods overlap the week, the one that ends last decides when it clears.
  const win = windows.filter(([a, b]) => a <= to && b >= span[0]).sort((a, b) => (a[1] < b[1] ? 1 : -1))[0] ?? null;
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

// The first day a weight verdict can speak again after `end` (the last day of a quiet period, or
// the day a target changed): it takes three finished weeks that all start after it, and the
// verdict is given the day after the third one ends.
export function clearDay(end, weekStartDow) {
  let d = addDays(end, 21);
  while (weekday(d) !== (weekStartDow + 6) % 7) d = addDays(d, 1);
  return addDays(d, 1);
}
export function firstWeekEnd(plan) {
  let d = addDays(plan.start, 6);
  while (weekday(d) !== (plan.weekStartDow + 6) % 7) d = addDays(d, 1);
  return d;
}

// Every rule code the Coach can return. coach-words.js must have a sentence for each.
export const ALL_CODES = Object.freeze([
  'L1', 'L2', 'L3', 'L4', 'L5', 'L6a', 'L6b', 'L7', 'L8', 'L9', 'LD',
  'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11',
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D6u', 'D7', 'D8', 'D9', 'DB',
  'W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W8a', 'W8b', 'W8c', 'W9', 'W10', 'W11',
  'F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
]);
