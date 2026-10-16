// "Copy my data for Claude": what the app knows, as plain text for a chat to read and answer from.
// Pure: the screen passes in what the Coach worked out, so this file can be tested on its own.
//
// What it is careful about, because a reader that cannot see the app will take the text at face
// value: a day with nothing logged is printed and called "not logged", never left out (leaving it
// out makes a half-logged week look complete). The Coach's verdicts go as sentences, with the
// rule code after each, never as bare codes. And it says up front how complete the log is, so the
// reader knows how hard to lean on any of it.

import * as rules from './rules.js';
import { say, dateText, dayName } from './coach-words.js';
import { sessions, liftName } from './exercises.js';
import { VERSION } from './version.js';
import { DAY as COACH_DAY, RAILS, WEEK } from './coach-constants.js';
import { dayFacts, isJudgeable } from './coach.js';

const n0 = (v) => Math.round(v).toLocaleString('en-GB');
const many = (n, one, more = `${one}s`) => `${n} ${n === 1 ? one : more}`;
const n1 = (v) => String(Math.round(v * 10) / 10);
const litres = (ml) => n1(ml / 1000);
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SESSION_NAME = (plan, id) => plan.sessions?.[id]?.name ?? id;
const countsAsDay = (food) => isJudgeable(dayFacts(food));
const short = (k) => dateText(k).replace(/^(\w{3})\w*/, '$1'); // "Fri 16 Oct"

// A lift's rep range from the plan, by its id or the id it was swapped from.
const EXERCISES = Object.values(sessions).flat();
const rangeOf = (id) => EXERCISES.find((e) => e.id === String(id).split('~')[0])?.reps ?? null;

// One day as a row. Food numbers carry "+" when some food had no figure for them.
function dayRow(c, k) {
  const d = c.data.days[k] ?? {};
  const food = Array.isArray(d.food) ? d.food : [];
  const t = rules.totals(food);
  const gaps = food.length ? rules.unknownIn(food) : [];
  // No food with a figure for it: unknown ("?"). Some with, some without: "at least" ("+").
  const f = (m) => (!food.length ? '-' : food.every((e) => e[m] == null) ? '?' : `${n1(t[m])}${gaps.includes(m) ? '+' : ''}`);
  const meals = rules.mealsOf(d);
  const logged = Object.values(meals).filter((x) => x === 'logged').length;
  const skipped = Object.values(meals).filter((x) => x === 'skipped').length;
  const mealText = logged || skipped ? `${logged} of 4${skipped ? ` (${skipped} skipped)` : ''}` : '-';
  const cardio = Array.isArray(d.cardio) ? d.cardio.reduce((a, x) => a + (x.minutes ?? 0), 0) : 0;
  const entry = c.log[k];
  const plannedHere = Boolean(c.plan.weekdays?.[rules.weekday(k)]);
  const session = entry
    ? `${d.workout?.session ? `${SESSION_NAME(c.plan, d.workout.session)} ` : ''}${{ done: 'done', min: 'minimum done', missed: 'missed' }[entry.type]}${entry.reason ? ` (${entry.reason})` : ''}`
    : d.workout && Object.values(d.workout.lifts ?? {}).some((l) => rules.setsOf(l).length) ? 'lifts logged, not finished'
    : plannedHere && k < c.key ? 'missed, nothing logged' : plannedHere ? 'gym day' : 'rest day';
  return [
    short(k), d.weightKg ? n1(d.weightKg) : '-',
    food.length ? f('kcal') : k === c.key ? 'nothing yet today' : 'not logged', f('protein'), f('carbs'), f('fat'), f('fibre'), mealText,
    d.steps != null ? n0(d.steps) : '-', d.waterMl != null ? litres(d.waterMl) : '-', cardio ? String(cardio) : '-',
    d.creatine ? 'yes' : '-', session,
  ].join(', ');
}

// The first and the latest time each lift was done, with its rep range: the proof of whether
// strength is holding. Deload days and alternatives are left out, they say nothing about strength.
function liftTrends(c) {
  const seen = new Map();
  for (const k of Object.keys(c.data.days).filter(rules.isDay).sort()) {
    const w = c.data.days[k].workout;
    if (!w || w.half || typeof w.lifts !== 'object' || !w.lifts) continue;
    for (const [id, lift] of Object.entries(w.lifts)) {
      const sets = rules.setsOf(lift);
      if (!sets.length || lift?.alt) continue;
      const r = seen.get(id) ?? { first: null, last: null, times: 0 };
      const at = { k, text: rules.setsText(sets) };
      r.first ??= at;
      r.last = at;
      r.times++;
      seen.set(id, r);
    }
  }
  return [...seen.entries()].map(([id, r]) => {
    const range = rangeOf(id);
    const head = `${liftName(id)}${range ? ` (${range[0]} to ${range[1]} reps)` : ''}`;
    return r.times === 1
      ? `${head}: done once, ${short(r.first.k)}, ${r.first.text}`
      : `${head}: first ${short(r.first.k)}, ${r.first.text}. Latest ${short(r.last.k)}, ${r.last.text}. Done ${r.times} times.`;
  });
}

// The spreadsheet: one row per day. A macro no food that day had a figure for is left blank
// (unknown), never 0. One that some foods lacked is the known part, and at_least names it, so a
// sum in the spreadsheet is not read as exact.
export function csvText(c) {
  const head = ['date', 'weight_kg', 'waist_cm', 'steps', 'water_l', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'at_least',
    'meals_logged', 'meals_skipped', 'session', 'cardio_min', 'creatine', 'vitamin_d'];
  const rows = Object.keys(c.data.days).filter(rules.isDay).sort().map((k) => {
    const d = c.data.days[k] ?? {};
    const food = Array.isArray(d.food) ? d.food : [];
    const t = rules.totals(food);
    const known = (m) => food.some((e) => e?.[m] != null);
    const cell = (m) => (food.length && known(m) ? t[m] : '');
    const partly = food.length ? rules.unknownIn(food).filter(known) : [];
    const meals = Object.values(rules.mealsOf(d));
    return rules.csvLine([
      k, d.weightKg, d.waistCm, d.steps, d.waterMl != null ? d.waterMl / 1000 : '',
      cell('kcal'), cell('protein'), cell('carbs'), cell('fat'), cell('fibre'), partly.join(' '),
      meals.filter((x) => x === 'logged').length || '', meals.filter((x) => x === 'skipped').length || '',
      d.session ? `${d.workout?.session ?? ''} ${d.session.type}`.trim() : '',
      (Array.isArray(d.cardio) ? d.cardio : []).reduce((a, x) => a + (x?.minutes ?? 0), 0) || '',
      d.creatine ? 'yes' : '', d.vitaminD ? 'yes' : '',
    ]);
  });
  return [rules.csvLine(head), ...rows].join('\n');
}

/**
 * The text. coach: { week, yesterday, brief } as the screens worked them out:
 *   week = weekCheck result, yesterday = dayCheck result with its key (or null),
 *   brief = compose() result (or null). full: false gives the short version.
 */
export function exportText(c, coach, { full = true } = {}) {
  const p = c.profile;
  const t = c.targets;
  const plan = c.plan;
  const key = c.key;
  const phase = rules.phaseFor(key, plan.phases);
  const ctx = { T: t.kcal };
  const L = [];
  const push = (...xs) => L.push(...xs);

  // ----- About the data -----
  const last14 = Array.from({ length: 14 }, (_, i) => rules.addDays(key, -13 + i)).filter((k) => k >= plan.start);
  const foodDays = last14.filter((k) => (c.data.days[k]?.food ?? []).some((e) => e && !e.none)); // a skip mark is not food
  const counted = foodDays.filter((k) => k < key && countsAsDay(c.data.days[k].food));
  const blank = last14.filter((k) => k < key && !c.data.days[k]?.food?.length && !Object.values(rules.mealsOf(c.data.days[k])).some(Boolean));
  const weighed = last14.filter((k) => Number(c.data.days[k]?.weightKg) > 0);
  const sessions14 = rules.sessionsIn14(c.log, key);
  const planned14 = last14.filter((k) => k <= key && plan.weekdays?.[rules.weekday(k)]).length;

  push(
    'This is data from my own fitness tracker app. Please use it to answer my question.',
    'Before the numbers: "-" or "not logged" means nothing was recorded. That is unknown, not zero. Sentences marked [code] come from the app\'s own fixed rules, not from me.',
    '',
    'ABOUT THE DATA',
    `App version ${VERSION}. Today is ${dateText(key)} ${key.slice(0, 4)}${phase ? `, ${phase.name}` : ''}. The app's day turns over at ${plan.rolloverHour === 0 ? 'midnight' : `${plan.rolloverHour} am`}, not midnight, so a late night counts as the day before.`,
    `Last ${many(last14.length, 'day')}: food logged on ${foodDays.length}, and ${counted.length} of those finished days were complete enough to count in averages. Weight logged on ${many(weighed.length, 'morning')}. ${many(sessions14, 'gym session')} done, with ${many(planned14, 'gym day')} planned.`,
    blank.length ? `Days with no food logged at all: ${blank.map(short).join(', ')}. Treat these as unknown, not as days of eating nothing.` : 'Every finished day in the last two weeks has some food logged.',
    `A day's food counts in the averages only with at least ${n0(COACH_DAY.judgeMinKcal)} kcal and ${COACH_DAY.judgeMinMeals} meals logged. A "+" after a food number means some foods that day had no figure for it, so the real number is at least that. A "?" means no food that day had a figure for it.`,
    `Weeks run ${DOW[plan.weekStartDow]} to ${DOW[(plan.weekStartDow + 6) % 7]}.`,
    'Not tracked by this app at all: sleep, hunger, mood, stress, soreness and alcohol.',
    '',
  );

  // ----- Me and the plan -----
  const pace = rules.planPace(p.startKg, p.goalKg, plan);
  const stepGoal = rules.stepTarget(key, plan.start, plan.steps);
  const order = plan.cycle.map((id) => SESSION_NAME(plan, id)).join(', ');
  const gymDays = Object.keys(plan.weekdays ?? {}).map(Number).sort((a, b) => ((a - plan.weekStartDow + 7) % 7) - ((b - plan.weekStartDow + 7) % 7)).map((d) => DOW[d]);
  const nextPhase = plan.phases.find((x) => x.start > key);
  const focus = rules.focusFor(plan, key);
  push(
    'ME AND THE PLAN',
    `${p.heightCm} cm. Started at ${p.startKg} kg, goal ${p.goalKg} kg by ${dateText(plan.end)} ${plan.end.slice(0, 4)}${pace ? `, which works out at ${pace.text}` : ''}.`,
    `Daily targets: ${n0(t.kcal)} kcal, ${n0(t.protein)} g protein, ${n0(t.carbs)} g carbs, ${n0(t.fat)} g fat, ${n0(t.fibre)} g fibre, ${litres(t.waterMl)} L water.`,
  );
  if (full) {
    if (plan.deficitKcal) push(`The calorie target was set about ${n0(plan.deficitKcal)} kcal under maintenance when the plan began, so maintenance was roughly ${n0(t.kcal + plan.deficitKcal)} kcal then. That is an estimate.`);
    if (p.targetChangedOn) push(`The calorie target last changed on ${dateText(p.targetChangedOn)}${p.targetWas ? `, from ${n0(p.targetWas)} kcal` : ''}.`);
    push(
      `Steps target today: ${n0(stepGoal)}${stepGoal < plan.steps.target ? `, rising ${n0(plan.steps.weeklyAdd)} every ${DOW[rules.weekday(plan.start)]} to ${n0(plan.steps.target)}` : ''}.`,
      phase ? `Phase now: ${phase.name}, from ${dateText(phase.start)}${phase.end ? ` to ${dateText(phase.end)}` : ''}. Sets: ${phase.sets} Effort: ${phase.effort} Food: ${phase.food}` : 'The plan has not started yet.',
      ...(nextPhase ? [`Next phase: ${nextPhase.name}, from ${dateText(nextPhase.start)}.`] : []),
      `Training: ${plan.cycle.length} sessions a week in this order: ${order}. Gym days: ${gymDays.join(', ')}. A missed session stays next in line, so the order never skips a session.`,
      'Weight jumps: a lift keeps its weight until every planned set reaches the top of its rep range, then goes up by the smallest step. A light set before the first proper set is a warm-up and does not count.',
    );
  }
  push(`Limits the app never crosses: never under ${n0(RAILS.kcalFloor)} kcal, never more than ${RAILS.maxLossKgPerWeek} kg a week of loss, never less protein.`);
  if (focus && !focus.over) push(`Right now: two easy weeks, ${dateText(focus.from)} to ${dateText(focus.to)}. Only a morning weigh-in and every meal logged are asked for. The gym has no target and steps are not counted.`);
  push('');

  // ----- The Coach -----
  const w = coach.week;
  push('THE COACH (the app\'s fixed rules, worked out on the phone, no AI)');
  if (coach.brief) {
    const b = coach.brief;
    push(`Briefing: ${b.caption}`);
    for (const [part, label] of [['where', 'Where you are'], ['well', 'Going well'], ['fix', 'Fix'], ['next', 'Next']]) {
      if (b[part]?.length) push(`  ${label}: ${b[part].join(' ')}`);
    }
  }
  if (w) {
    push(`Weekly verdict${w.week ? ` for ${dateText(w.week.from)} to ${dateText(w.week.to)}` : ''}: ${say(w.verdict, ctx)} [${w.verdict.code}]`);
    if (w.actions.length) push(`To do: ${w.actions.map((a) => `${say(a, ctx)} [${a.code}]`).join(' ')}`);
    if (full && w.lines.length) push(`Numbers behind it: ${w.lines.map((l) => `${say(l, ctx)} [${l.code}]`).join(' ')}`);
  }
  if (coach.yesterday) {
    const y = coach.yesterday;
    const ctxY = { ...ctx, dayName: dayName(y.key) };
    const said = y.lines.map((l) => `${say(l, ctxY)} [${l.code}]`).join(' ');
    push(`Yesterday, ${dateText(y.key)}: ${said || 'nothing to judge.'}`);
  }
  push('');

  // ----- Weight -----
  if (full) {
    const avg = rules.weightAverage(c.data.days, key);
    const inWeek = [0, 1, 2, 3, 4, 5, 6].filter((i) => Number(c.data.days[rules.addDays(key, -i)]?.weightKg) > 0).length;
    const all = Object.keys(c.data.days).filter((k) => rules.isDay(k) && Number(c.data.days[k].weightKg) > 0).sort();
    const waist = Object.keys(c.data.days).filter((k) => rules.isDay(k) && Number(c.data.days[k].waistCm) > 0).sort();
    push(
      'WEIGHT',
      avg !== null
        ? `7-day average: ${avg} kg from ${many(inWeek, 'weigh-in')}. The plan line says ${rules.planWeight(key, plan, p.startKg, p.goalKg)} kg today.`
        : `7-day average: not enough weigh-ins yet (${inWeek} in the last 7 days, it needs ${rules.MIN_WEIGH_INS}). The plan line says ${rules.planWeight(key, plan, p.startKg, p.goalKg)} kg today. The Coach's weekly weight read needs ${WEEK.weighIns} mornings in each week.`,
      all.length ? `Every weigh-in (date, kg): ${all.map((k) => `${short(k)} ${n1(c.data.days[k].weightKg)}`).join('; ')}.` : 'No weigh-ins logged yet.',
      waist.length ? `Waist (date, cm): ${waist.map((k) => `${short(k)} ${n1(c.data.days[k].waistCm)}`).join('; ')}.` : 'No waist measurements logged yet.',
      '',
    );
  }

  // ----- The days -----
  push(`LAST ${many(last14.length, 'DAY', 'DAYS')}, every day, oldest first`, 'date, weight kg, kcal, protein g, carbs g, fat g, fibre g, meals in, steps, water L, cardio min, creatine, gym');
  for (const k of last14) push(dayRow(c, k));
  push('');
  if (!full) return L.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n').trim();

  // ----- Weeks -----
  const sched = rules.schedule(plan, c.log, key);
  const weeks = rules.weeks(c.data.days, sched, key, plan.weekStartDow, plan.start, 999, countsAsDay);
  if (weeks.length) {
    push('WEEK BY WEEK, newest first', `week starting, finished days with food complete enough to count, average kcal and protein g over those days, sessions done of planned, 7-day average weight kg at the end of the week, change in kg from a week earlier`);
    for (const x of weeks) push([`${short(x.first)}${x.running ? ' (this week so far)' : ''}`, x.foodDays, x.kcal ?? '-', x.protein ?? '-', `${x.done} of ${x.planned}`, x.weight ?? '-', x.change ?? '-'].join(', '));
    push('');
  }

  // ----- Lifts -----
  const trends = liftTrends(c);
  if (trends.length) push('LIFTS, first time against the latest (deload days and alternatives left out)', ...trends, '');
  const recent = Object.keys(c.data.days).filter(rules.isDay).sort().reverse().filter((k) => c.data.days[k].workout?.finished).slice(0, 4).reverse();
  if (recent.length) {
    push('RECENT SESSIONS, set by set (weight x reps)');
    for (const k of recent) {
      const wk = c.data.days[k].workout;
      push(`${short(k)}, ${SESSION_NAME(plan, wk.session)}${wk.minimum ? ' (minimum)' : ''}${wk.half ? ' (deload, lighter on purpose)' : ''}`);
      for (const [id, lift] of Object.entries(wk.lifts ?? {})) {
        const sets = rules.setsOf(lift);
        if (!sets.length) continue;
        const range = rangeOf(id);
        push(`  ${liftName(id)}${lift.alt ? ' (alternative used)' : ''}${range ? `, ${range[0]} to ${range[1]} reps` : ''}${lift.planned ? `, ${lift.planned} sets planned` : ''}: ${rules.setsText(sets)}`);
      }
    }
  }
  return L.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n').trim();
}
