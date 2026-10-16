// The Coach's briefing: four short parts built from the week check, never beside it.
//   where  where you are      well  what is working
//   fix    the one thing      next  what comes next
//
// This file only selects. Each part comes back as data, { id, v }: which template, and the
// numbers for it. The sentences live in briefing-words.js. Everything here is pure: the same
// input gives the same parts, nothing is stored and nothing is written.
//
// The briefing reads the week check's own verdict, actions, lines and facts. It never works out
// a second opinion. "Shown before", "second week running" and the quiet week are found by
// running this same selection on the earlier weeks, from the first one forward.

import * as rules from './rules.js';
import * as coach from './coach.js';
import { BRIEF, WEEK } from './coach-constants.js';

const { addDays, diffDays } = rules;
const round1 = (n) => Math.round(n * 10) / 10;
const item = (id, v = {}) => ({ id, v });
const line = (wk, code) => wk.lines.find((l) => l.code === code);

// How many sentences a going-well item takes. The rest take one.
const TWO_SENTENCES = new Set(['G2', 'G3b']);
// Fixes that are not problems: they never escalate, and a week with one of these can be quiet.
const NO_PROBLEM = new Set(['X16', 'X16b', 'X16q', 'X17']);
const NEVER_ESCALATES = new Set([...NO_PROBLEM, 'X8']);
// After one of these, the next read needs the log back before it can say much.
const NEEDS_LOG = new Set(['X3', 'X4', 'X5', 'X15']);
// Praise that rotates out once it has been said.
const ROTATES = new Set(['G1', 'G2', 'G3', 'G3b', 'G4', 'G5', 'G6', 'G7', 'G8']);
// Phases where lifts are trained to go up. A deload and the diet break hold them on purpose.
const training = (p) => Boolean(p) && !p.maintenance && p.load !== 'half';

// ----- Reading one week -----

// The day a read is given: the day after the week it covers ends.
export const readDay = (key, weekStartDow) => addDays(coach.weekEnd(key, weekStartDow), 1);

// The lift that gained the most weight, among those that went up. Null when none gained weight.
function leadLift(lifts) {
  const gained = lifts.filter((l) => l.dir === 'up' && l.to > l.from).sort((a, b) => (b.to - b.from) - (a.to - a.from) || (a.id < b.id ? -1 : 1));
  return gained[0] ? { id: gained[0].id, a: gained[0].from, b: gained[0].to } : null;
}

// The whole journey, as of the end of a week: lifts against their first session, and the waist
// against its first reading. A piece with nothing to go on is null, never a zero.
function sinceStart({ days }, to) {
  const t = coach.liftTrends({ days, from: to, to, since: true });
  const waists = Object.keys(days).filter((k) => rules.isDay(k) && k <= to && days[k]?.waistCm > 0).sort();
  const far = waists.length >= 2 && diffDays(waists.at(-1), waists[0]) >= BRIEF.waistSinceDays;
  return {
    lifts: t.total >= BRIEF.minLifts ? { u: t.up, m: t.total, down: t.down, lead: leadLift(t.lifts) } : null,
    waist: far ? round1(days[waists.at(-1)].waistCm - days[waists[0]].waistCm) : null,
  };
}

// What falls in the week after a read, in the order it is worth saying.
function lookAhead({ plan }, R) {
  const { phases } = plan;
  const last = addDays(R, 7);
  const now = rules.phaseFor(R, phases);
  // The diet break ending comes first: what follows it is said in the same breath.
  if (now?.maintenance && now.end && now.end >= R && now.end <= addDays(R, 6)) return item('N1e', { date: now.end });
  const starting = phases.find((p) => p.start > R && p.start <= last);
  if (starting) {
    const v = { label: starting.label ?? starting.name, date: starting.start };
    if (starting.maintenance) {
      return item('N1b', { ...v, n: starting.end ? diffDays(starting.end, starting.start) + 1 : null });
    }
    if (starting.load === 'half') return item('N1a', v);
    if (starting.extraSet) return item('N1c', { ...v, muscles: (plan.pushExtra ?? []).slice(0, 2), rir: starting.rir });
    return item('N1d', { ...v, rir: starting.rir });
  }
  const ended = phases.find((p) => p.maintenance && p.end && p.end < R && p.end >= addDays(R, -7));
  if (ended) return item('N2', { date: coach.clearDay(addDays(ended.end, WEEK.windowAfterBreakDays), plan.weekStartDow) });
  // From the read day itself: photo days and reads fall on the same weekday, so "the coming
  // week" has to start today or the photo line could never be said.
  const photo = plan.photos ? rules.nextPhotoDay(R, plan.photos) : null;
  if (photo && photo <= addDays(R, 6)) return item('N3', { date: photo });
  return null;
}

// ----- The selection for one week -----
// read: { R, wk, phase, prevPhase, index, since, event, startKg, goalKg, maintenance }
// history: what earlier briefings chose, newest first: [{ fix, repeat, well, verdict, level, ... }]
export function selectWeek(read, history = []) {
  const { wk, R } = read;
  const f = wk.facts;
  const early = wk.verdict.code === 'W0';
  const last = history[0] ?? null;
  const blackout = !early && f.foodDays === 0 && f.weighIns <= 1 && f.sessions === 0;
  const phase = read.phase;
  const base = {
    label: phase ? phase.label ?? phase.name : null,
    d: phase ? diffDays(R, phase.start) + 1 : null,
    n: phase?.end ? diffDays(phase.end, phase.start) + 1 : null,
  };

  // ----- Part 1: where you are -----
  let where;
  const readable = !early && !blackout && f.weighIns >= WEEK.weighIns;
  // Inside the diet break the weight is still said: it is only the week after that is "settling".
  const settling = readable && f.window && !(f.window === 'break' && f.inBreak);
  if (early) where = [item('P1.6', base)];
  else if (blackout) where = [item('P1.5', base)];
  else if (!readable) where = [item('P1.4', { ...base, k: f.weighIns })];
  else if (settling) where = [item({ start: 'P1.3', break: 'P1.3b', creatine: 'P1.3c' }[f.window], { ...base, W: f.avg })];
  else {
    const W = f.avg;
    const toGo = round1(W - read.goalKg);
    where = [item(toGo > 0 ? 'P1.1' : 'P1.1g', { ...base, W, x: round1(Math.abs(read.startKg - W)), up: W > read.startKg, S: read.startKg, r: toGo })];
    const off = line(wk, 'F10')?.n.diff;
    if (typeof off === 'number' && Math.abs(off) >= BRIEF.planLineKg) where.push(item('P1.2', { y: round1(Math.abs(off)), above: off > 0 }));
  }

  // ----- Part 3: the one fix. It is the card's first action, in other words. -----
  const first = wk.actions[0] ?? null;
  let fix;
  let source = first ? 'action' : 'none';
  if (first?.code === 'A0') fix = item('X0', { T: first.T, floor: first.floor });
  else if (early) { fix = item('X17'); source = 'none'; }
  else if (blackout) fix = item('X15');
  else if (first) fix = fromAction(first, wk, f);
  else {
    // The card has no action. A note on the card is the next best thing to say.
    const downOnce = f.lifts.filter((l) => l.downTwice).map((l) => l.id);
    const note = (code) => line(wk, code)?.level === 'note';
    source = 'note';
    // In the easy fortnight the card does not press lifts, sessions, protein or steps, so the
    // briefing does not either: the same check decides both.
    if (f.quiet) { fix = item(f.inBreak ? 'X16b' : 'X16'); source = 'none'; }
    else if (downOnce.length === 1 && line(wk, 'F8')?.level === 'watch') fix = item('X12', { lifts: downOnce, more: 0 });
    else if (note('F7')) fix = item('X11', { n: f.sessions, of: f.of });
    else if (note('F3')) fix = item('X13', { g: f.protein, P: f.P });
    else if (note('F6')) fix = item('X14', { n: f.steps, t: f.stepGoal });
    else { fix = item(f.inBreak ? 'X16b' : 'X16'); source = 'none'; }
  }
  const repeat = last && last.fix === fix.id && !NEVER_ESCALATES.has(fix.id) ? last.repeat + 1 : 1;
  // In a blackout everything is missing, and the one fix covers all of it.
  const tail = !blackout && wk.actions.length >= 2;

  // ----- Part 2: what is working. Only what the card itself marks good. -----
  const names = { left: BRIEF.liftNames - (fix.id === 'X12' ? fix.v.lifts.length : 0) };
  const lead = (l) => (l && names.left > 0 ? l : null);
  const good = (code) => line(wk, code)?.level === 'good';
  const special = []; // a fix that has just cleared, and the big picture: said once, never rotated
  const ordinary = [];
  if (!early && !blackout) {
    const cleared = last && last.fix !== fix.id ? {
      X3: f.foodDays > last.foodDays ? item('G9a', { n: f.foodDays, m: last.foodDays }) : null,
      X11: f.sessions > last.sessions ? item('G9b', { n: f.sessions, of: f.of, m: last.sessions }) : null,
      X13: f.protein !== null && last.protein !== null && f.protein > last.protein ? item('G9c', { g: f.protein, m: last.protein }) : null,
      X14: f.steps !== null && last.steps !== null && f.steps > last.steps ? item('G9d', { n: f.steps, m: last.steps }) : null,
      X6: f.kcal !== null && f.kcal <= f.T + WEEK.aboveTargetOver ? item('G9e', { x: f.kcal }) : null,
    }[last.fix] : null;
    if (cleared) special.push(cleared);

    const since = read.since;
    const ended = read.prevPhase && read.prevPhase !== phase && training(read.prevPhase) ? read.prevPhase : null;
    if (ended && since.lifts) {
      const { u, m, down } = since.lifts;
      if (u / m >= 0.5) special.push(item('B1a', { prev: ended.label ?? ended.name, u, m, lead: lead(since.lifts.lead) }));
      else if (down <= 1) special.push(item('B1b', { prev: ended.label ?? ended.name }));
    } else if (read.index % BRIEF.bigPictureEvery === 0 && !f.window) {
      const weight = readable ? { x: round1(Math.abs(read.startKg - f.avg)), up: f.avg > read.startKg } : null;
      if (weight || since.lifts || since.waist !== null) {
        special.push(item('B2', { weight, lifts: since.lifts ? { u: since.lifts.u, m: since.lifts.m } : null, waist: since.waist }));
      }
    }
    if (special.some((s) => s.v.lead)) names.left = 0; // one lift name at most in this part

    if (wk.verdict.code === 'W3' && wk.verdict.level === 'good') ordinary.push(item('G7'));
    if (wk.verdict.code === 'W6') ordinary.push(item('G2', { c: Math.abs(wk.verdict.n.waistCm), u: wk.verdict.n.up, m: wk.verdict.n.total }));
    else if (good('F1')) ordinary.push(item('G1', { R: f.rate1 }));
    if (good('F8') && f.liftsTotal >= BRIEF.minLifts) {
      if (f.liftsUp / f.liftsTotal >= 0.5) ordinary.push(item('G3', { u: f.liftsUp, m: f.liftsTotal, lead: lead(leadLift(f.lifts)) }));
      else ordinary.push(item('G3b'));
    }
    if (good('F7')) ordinary.push(item('G4', { n: f.sessions, of: f.of }));
    if (good('F3')) ordinary.push(item('G5', { g: f.protein }));
    if (f.foodDays >= BRIEF.foodDaysGood) ordinary.push(item('G6', { n: f.foodDays }));
    if (good('F6')) ordinary.push(item('G8', { n: f.steps }));
  }

  // ----- Part 4: what comes next -----
  const nextRead = addDays(R, 7);
  const event = early ? null : read.event;
  const quiet = Boolean(last) && !early && !blackout && !event && !special.length
    && last.verdict === wk.verdict.code && last.level === wk.verdict.level
    && NO_PROBLEM.has(last.fix) && NO_PROBLEM.has(fix.id);

  let well;
  if (early || blackout) well = [];
  else if (quiet) well = ordinary.slice(0, 1); // the top one, even if it was said last week
  else {
    const stale = new Set(history.slice(0, BRIEF.staleWeeks).flatMap((h) => h.well).filter((id) => ROTATES.has(id)));
    const fresh = ordinary.filter((g) => !stale.has(g.id));
    const pool = [...special, ...(fresh.length >= 2 ? fresh : ordinary)];
    well = [];
    let used = 0;
    for (const g of pool) {
      const size = TWO_SENTENCES.has(g.id) ? 2 : 1;
      if (used + size > BRIEF.caps.well) continue;
      well.push(g);
      used += size;
    }
  }
  if (!early && !blackout && !well.length) well = [item('G0')];

  let next;
  if (early) next = [item('N0', { date: addDays(wk.verdict.n.first, 1) })];
  else if (quiet) next = [item('N4q', { date: nextRead })];
  // After a week with gaps, what the next read needs matters more than a photo reminder.
  else if (event && !(event.id === 'N3' && NEEDS_LOG.has(fix.id))) next = [event.id === 'N1b' ? item('N1b', { ...event.v, M: f.maintenance }) : event];
  else next = [item('N4', { date: nextRead, first: f.until && f.until > R ? f.until : null, why: wk.verdict.n.why ?? null, needs: NEEDS_LOG.has(fix.id) })];

  if (quiet) fix = item('X16q');
  return {
    read: R, week: wk.week, nextRead, quiet,
    parts: { where, well, fix: [{ ...fix, repeat, tail }], next },
    // What later weeks need to know about this one. Recomputed each time, never stored.
    summary: {
      fix: fix.id === 'X16q' ? 'X16' : fix.id, repeat, source, well: well.map((g) => g.id),
      verdict: wk.verdict.code, level: wk.verdict.level,
      foodDays: f?.foodDays ?? 0, sessions: f?.sessions ?? 0, protein: f?.protein ?? null, steps: f?.steps ?? null,
    },
  };
}

// The fix that says what the card's first action says.
function fromAction(a, wk, f) {
  const n = wk.verdict.n;
  if (a.code === 'A1') return item('X3', { n: a.judged });
  if (a.code === 'A6') return item('X11', { n: a.done, of: a.of });
  if (a.code === 'A3') return item('X12', { lifts: a.lifts.slice(0, BRIEF.liftNames), more: Math.max(0, a.lifts.length - BRIEF.liftNames) });
  if (a.code === 'A4') return item('X13', { g: a.g, P: f.P });
  if (a.code === 'A5') return item('X14', { n: a.steps, t: a.goal });
  // A2: the verdict's own advice.
  return {
    'eat-to-floor': () => item('X1', { n: n.days, T: f.T, floor: a.kcal }),
    'add-kcal': () => item('X2', { R: n.rate1, add: a.kcal }),
    changed: () => item('X2w', { R: n.rate1, since: a.since }),
    'stall-choice': () => item('X7', { cut: a.cut ? a.cut.kcal : null, steps: a.addSteps }),
    aim: () => item('X6', { x: n.kcal, d: a.over, T: a.kcal, band: a.band }),
    weigh: () => item('X4', { a: a.counts[0], b: a.counts[1], c: a.counts[2], needed: a.needed }),
    'log-all': () => item('X5', { x: a.kcal, T: a.T }),
    wait: () => item('X8', { since: a.since, until: a.until }),
    'hold-rising': () => item('X9', { R: Math.abs(n.rate1) }),
    'hold-slow': () => item('X10', { R: n.rate1, lo: WEEK.onPacePct, hi: WEEK.fastPct }),
    'break-eat': () => item('X16c', { x: a.kcal, M: a.maintenance }),
  }[a.type]();
}

// ----- The briefing for today -----
// input: { key, days, T, P, targets, plan, targetChangedOn, startKg, goalKg }
// Returns the selection for the latest read, with history worked out from the weeks before it.
export function briefing(input) {
  const { key, plan } = input;
  // asOf is the day the check is made on. The plan line is always the one for the week's last
  // day, so it does not drift as the days after a read go by.
  const check = (R, asOf = R) => coach.weekCheck({
    ...input, key: asOf, planLine: rules.planWeight(addDays(R, -1), plan, input.startKg, input.goalKg),
  });
  const firstRead = addDays(coach.firstWeekEnd(plan), 1);
  const R = readDay(key, plan.weekStartDow);

  // Before the first read: only the day count moves, so this one follows today, not a Thursday.
  if (R < firstRead) {
    return selectWeek({ R: key, wk: check(key), phase: rules.phaseFor(key, plan.phases), prevPhase: null, index: 0, since: null, event: null, startKg: input.startKg, goalKg: input.goalKg });
  }

  const history = [];
  let out = null;
  for (let day = firstRead, index = 1; day <= R; day = addDays(day, 7), index++) {
    const phase = rules.phaseFor(day, plan.phases);
    // The latest read is checked as of today, like the card under it: a calorie target changed
    // since Thursday turns "pick one" into "give it time" on both at once. Nothing else about a
    // finished week depends on the day it is read.
    out = selectWeek({
      R: day, wk: check(day, day === R ? key : day), phase, prevPhase: rules.phaseFor(addDays(day, -7), plan.phases), index,
      since: sinceStart(input, addDays(day, -1)), event: lookAhead(input, day),
      startKg: input.startKg, goalKg: input.goalKg,
    }, history);
    history.unshift(out.summary);
  }
  return out;
}
