// Pure rules. No DOM, no Firebase. Tested in tests/rules.test.js.
// Days are passed around as 'YYYY-MM-DD' keys so time zones only matter in dayKey().

const DAY = 86400000;
const toMs = (key) => Date.parse(key + 'T00:00:00Z');
const toKey = (ms) => new Date(ms).toISOString().slice(0, 10);

// True for a real calendar day written as 'YYYY-MM-DD'. 30 February is not one.
export const isDay = (key) =>
  typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(toMs(key)) && toKey(toMs(key)) === key;
export const addDays = (key, n) => toKey(toMs(key) + n * DAY);
export const diffDays = (a, b) => Math.round((toMs(a) - toMs(b)) / DAY);
export const weekday = (key) => new Date(toMs(key)).getUTCDay(); // 0 is Sunday

// The app's "today". Before the rollover hour it is still yesterday.
export function dayKey(now, rolloverHour = 4, utcOffsetHours = 3) {
  return toKey(now.getTime() + (utcOffsetHours - rolloverHour) * 3600000);
}

// phases: [{ name, start, end? }] in date order. Returns null before the first one.
export function phaseFor(key, phases) {
  return phases.find((p) => key >= p.start && (!p.end || key <= p.end)) ?? null;
}

// steps: { from, weeklyAdd, target }, ramping from the plan start date.
export function stepTarget(key, start, steps) {
  const weeks = Math.floor(Math.max(0, diffDays(key, start)) / 7);
  return Math.min(steps.target, steps.from + steps.weeklyAdd * weeks);
}

// log: { 'YYYY-MM-DD': { type: 'done' | 'min' | 'missed', reason?, id? } }. id is the session logged that day.
// Builds every day from plan.start to plan.end, or four weeks past today if that is later:
// the plan's end date is a target, and training carries on until the goal is reached.
// What is next is decided by the cycle,
// never by the weekday: a missed session stays next in line and lands on the next
// planned gym day, so every later day moves one session along.
// A planned day that has passed with nothing logged counts as missed on its own.
// States: done, min, missed, planned, rest.
const RUN_ON_DAYS = 28;
export function schedule(plan, log, todayKey) {
  const days = [];
  const n = plan.cycle.length;
  let idx = 0;
  const ahead = addDays(todayKey, RUN_ON_DAYS);
  const end = ahead > plan.end ? ahead : plan.end;
  for (let k = plan.start; k <= end; k = addDays(k, 1)) {
    const entry = log[k];
    const planned = Boolean(plan.weekdays[weekday(k)]);
    const day = { key: k, dow: weekday(k), dayNum: Number(k.slice(8)), isToday: k === todayKey, session: null, state: 'rest' };
    if (entry?.type === 'done' || entry?.type === 'min') {
      // A logged workout knows which session it was, and the cycle carries on from there.
      // Without one, the day takes whatever was next in line.
      if (plan.cycle.includes(entry.id)) idx = plan.cycle.indexOf(entry.id);
      day.state = entry.type;
      day.session = plan.cycle[idx++ % n];
    } else if (planned && (k < todayKey || (entry?.type === 'missed' && k === todayKey))) {
      day.state = 'missed';
      day.session = plan.cycle[idx % n];
      day.auto = !entry;
      day.reason = entry?.reason ?? null;
    } else if (planned) {
      day.state = 'planned';
      day.session = plan.cycle[idx++ % n];
    }
    days.push(day);
  }
  return days;
}

// The seven days of the week containing key.
export function weekStrip(days, key, weekStartDow) {
  const first = addDays(key, -((weekday(key) - weekStartDow + 7) % 7));
  const last = addDays(first, 6);
  return days.filter((d) => d.key >= first && d.key <= last);
}

// The next session still to do, today included.
export const nextUp = (days, key) => days.find((d) => d.key >= key && d.state === 'planned') ?? null;

// Planned sessions missed in a row right up to today. A done or minimum session ends the run.
export function missedRun(days, key) {
  let count = 0;
  let firstKey = null;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.key > key || d.state === 'rest' || d.state === 'planned') continue;
    if (d.state !== 'missed') break;
    count++;
    firstKey = d.key;
  }
  return { count, firstKey };
}

// Push the current phase's end and every later phase back by n days. Finished phases stay.
export function shiftPhases(phases, key, n) {
  return phases.map((p) => {
    if (p.end && p.end < key) return p;
    const moved = { ...p, start: p.start > key ? addDays(p.start, n) : p.start };
    if (p.end) moved.end = addDays(p.end, n);
    return moved;
  });
}

// ----- Moving the phases -----
// The phases follow one another with no gap, so their start dates say everything: each phase runs
// until the day before the next one starts, and the last runs until the goal is reached.

const MAX_PLAN_DAYS = 1100; // three years. Anything longer is a slip, and every screen walks the whole plan.

// The first thing wrong with a set of start dates and a goal date, as a sentence, or null.
// plan: { start, phases }.
export function phaseDatesProblem(plan, starts, end) {
  const { phases } = plan;
  if (!Array.isArray(starts) || starts.length !== phases.length || !starts.every(isDay) || !isDay(end)) return 'Every date needs to be filled in.';
  if (starts[0] !== plan.start) return `${phases[0].name} starts on the first day of the plan. That date stays where it is.`;
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] <= starts[i - 1]) return `${phases[i].name} has to start after ${phases[i - 1].name} does.`;
  }
  if (end <= starts.at(-1)) return `The goal date has to be after ${phases.at(-1).name} starts.`;
  if (diffDays(end, plan.start) > MAX_PLAN_DAYS) return 'The goal date is more than three years after the start. Check the year.';
  return null;
}

export function movePhases(phases, starts) {
  return phases.map(({ end, ...p }, i) => ({
    ...p, start: starts[i], ...(i < phases.length - 1 ? { end: addDays(starts[i + 1], -1) } : {}),
  }));
}

// The plan in use: the template from plan.js with your saved changes on top. Only the things the
// app itself saves are taken, and only when they are the right kind of value, so damaged data or
// an odd backup file can never break a screen. Anything else falls back to the template.
export function planFrom(base, saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const isMap = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  const plan = { ...base };
  if (Number.isInteger(s.rolloverHour) && s.rolloverHour >= 0 && s.rolloverHour <= 6) plan.rolloverHour = s.rolloverHour;
  if (Array.isArray(s.dumbbells) && s.dumbbells.length >= 2 && s.dumbbells.every((n) => typeof n === 'number' && n > 0)) plan.dumbbells = s.dumbbells;
  if (isMap(s.swaps)) {
    plan.swaps = Object.fromEntries(Object.entries(s.swaps)
      .filter(([, v]) => isMap(v) && typeof v.name === 'string' && typeof v.kind === 'string'));
  }
  if (isMap(s.gap)) plan.gap = s.gap;
  if (s.rampSets === 2 || s.rampSets === 3) plan.rampSets = s.rampSets;
  if (Array.isArray(s.pushExtra)) plan.pushExtra = s.pushExtra.filter((m) => typeof m === 'string');
  for (const k of ['usdaKey', 'geminiKey']) if (typeof s[k] === 'string' && s[k]) plan[k] = s[k];
  if (s.finishAsked === true) plan.finishAsked = true;
  // The dates are taken together or not at all.
  const end = s.end ?? base.end;
  const starts = s.phaseStarts ?? base.phases.map((p) => p.start);
  if (!phaseDatesProblem(base, starts, end)) {
    plan.end = end;
    plan.phases = movePhases(base.phases, starts);
  }
  return plan;
}

// ----- Training -----

export const MIN_EXERCISES = 3; // the minimum session is the first three lifts
const MIN_SETS = 2;

// How many sets to do today. ex: { sets, main }, phase: { load, start }.
// rampSets: how many sets every lift gets through a ramp phase (the Foundation phase) when that is
// more than the plan's own 2. A minimum session and a deload are not touched by it.
export function setsFor(ex, phase, key, minimum = false, rampSets = MIN_SETS) {
  if (minimum) return Math.min(MIN_SETS, ex.sets);
  if (phase?.load === 'half') return Math.ceil(ex.sets / 2);
  if (phase?.load === 'ramp') {
    if (rampSets > MIN_SETS) return rampSets;
    const firstWeek = diffDays(key, phase.start) < 7;
    return firstWeek || !ex.main ? Math.min(MIN_SETS, ex.sets) : ex.sets;
  }
  return ex.sets;
}

// The effort to aim for, as [from, to] reps in reserve.
export function targetRir(phase, key, lastIsoSet = false) {
  if (!phase) return [1, 3];
  if (phase.rirFirstWeek && diffDays(key, phase.start) < 7) return phase.rirFirstWeek;
  if (lastIsoSet && phase.rirLastIso) return phase.rirLastIso;
  return phase.rir;
}

export const JUMP_KG = { barbell: 2.5, machine: 5 };
const BIG_JUMP = 0.15; // a jump of more than 15% needs extra reps first
export const EXTRA_REPS = 3;

export function nextWeight(kind, kg, dumbbells) {
  if (kind === 'dumbbell') return dumbbells.find((w) => w > kg) ?? null;
  return JUMP_KG[kind] ? kg + JUMP_KG[kind] : null;
}

// The jump rule (double progression). Keep the weight until every set reaches the top of
// the rep range at the effort the phase asked for, then go up by the smallest jump.
//   ex:   { kind, reps: [low, high] }
//   last: the previous time this lift was done: { sets: [{ kg, reps, rir }], planned, rirLo, top }
//         top is the top of the rep range in the session it was done in. A lift shared by two
//         sessions can have two ranges, and it is judged by the one it was done under.
// Returns one of:
//   { type: 'start' }                    never done before
//   { type: 'body' }                     no weight to add, progress in reps
//   { type: 'hold', kg }                 same weight, keep building reps
//   { type: 'jump', kg, to }             earned: go to `to`
//   { type: 'extra', kg, to, need }      the next step is big: reach `need` reps on every set first
//   { type: 'cap', kg }                  earned, but there is nothing heavier: use the alternative
export function progression(ex, last, dumbbells) {
  const sets = (last?.sets ?? []).filter((s) => s.reps > 0);
  if (!sets.length) return { type: 'start' };
  if (ex.kind === 'body') return { type: 'body' };
  const kg = workingKg(sets);
  if (!(kg > 0)) return { type: 'start' };

  // When the sets were not all at one weight, the lift is judged at the weight most of them
  // were done with. A set at a heavier weight was harder than asked, so it counts as reached.
  // A lighter set does not: the weight stays until every set is done at it.
  const top = last.top ?? ex.reps[1];
  const reached = (reps) => sets.every((s) => (s.kg ?? 0) > kg || ((s.kg ?? 0) === kg && s.reps >= reps));
  const effortOk = sets.every((s) => s.rir == null || s.rir >= (last.rirLo ?? 0));
  const earned = sets.length >= (last.planned ?? 1) && reached(top) && effortOk;
  if (!earned) return { type: 'hold', kg };

  const to = nextWeight(ex.kind, kg, dumbbells);
  if (to === null) return { type: 'cap', kg };
  const need = top + EXTRA_REPS;
  if ((to - kg) / kg > BIG_JUMP && !reached(need)) return { type: 'extra', kg, to, need };
  return { type: 'jump', kg, to };
}

// The sets of one lift on one day, as they were logged. A recap holds every set with its own
// weight and reps. Older recaps held one weight and the fewest reps, and are read as that many
// equal sets. A set with no reps was not done.
export function setsOf(lift) {
  if (!lift) return [];
  const sets = Array.isArray(lift.sets) ? lift.sets
    : Array.from({ length: lift.planned ?? 1 }, () => ({ kg: lift.kg, reps: lift.reps }));
  return sets.filter((s) => s && s.reps > 0);
}

// The weight most of the sets were done with. When two weights tie, the lighter one.
export function workingKg(sets) {
  const count = new Map();
  for (const s of sets) count.set(s.kg ?? 0, (count.get(s.kg ?? 0) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

// Sets in words: "35 kg x 12, 12, 11", or "40 kg x 8, 35 kg x 12, 35 kg x 12" when the weight
// changed, or "12, 10 reps" for a lift with no weight.
export function setsText(sets) {
  if (!sets.length) return '';
  if (!sets.some((s) => s.kg > 0)) return `${sets.map((s) => s.reps).join(', ')} reps`;
  return sets.every((s) => s.kg === sets[0].kg)
    ? `${sets[0].kg} kg x ${sets.map((s) => s.reps).join(', ')}`
    : sets.map((s) => `${s.kg ?? 0} kg x ${s.reps}`).join(', ');
}

// A rough strength score for one session of a lift: the best set, as an estimated one-rep max.
export const bestSet = (sets) =>
  Math.max(0, ...sets.filter((s) => s.reps > 0).map((s) => (s.kg ?? 0) * (1 + s.reps / 30)));

// True when a lift's score has dropped two sessions running. scores: oldest first,
// with deload and minimum sessions already left out.
export const wentBackwards = (scores) => {
  const [a, b, c] = scores.slice(-3);
  return scores.length >= 3 && c < b && b < a;
};

// ----- Weight and progress -----

const MIN_WEIGH_INS = 3;

// Average of the weigh-ins in the 7 days ending on key, or null with fewer than three.
// days: { 'YYYY-MM-DD': { weightKg } }
export function weightAverage(days, key) {
  const list = [];
  for (let i = 0; i < 7; i++) {
    const w = days[addDays(key, -i)]?.weightKg;
    if (w) list.push(w);
  }
  return list.length >= MIN_WEIGH_INS ? round1(list.reduce((a, b) => a + b, 0) / list.length) : null;
}

// Where the plan says the weight should be on a day: a straight line from the starting
// weight to the goal, going flat through any maintenance phase (the diet break).
export function planWeight(key, plan, startKg, goalKg) {
  const inBreak = (k) => plan.phases.some((p) => p.maintenance && k >= p.start && k <= (p.end ?? k));
  let total = 0;
  let passed = 0;
  for (let k = addDays(plan.start, 1); k <= plan.end; k = addDays(k, 1)) {
    if (inBreak(k)) continue;
    total++;
    if (k <= key) passed++;
  }
  return round1(startKg - (startKg - goalKg) * (total ? passed / total : 0));
}

const FLAT_KG = 0.1; // a weekly drop smaller than this counts as flat
const FAST_KG = 1; // losing more than this a week is too fast
const WAIST_CM = 0.5; // the smallest waist change worth trusting on a tape measure
export const STALL_CUT_KCAL = 150;
export const STALL_ADD_STEPS = 2000;

// The stall check, from the last three weekly averages and the waist.
//   days: { key: { weightKg, waistCm } }
// Returns { status, drop } where status is one of:
//   'need-data'  not enough weigh-ins for three weekly averages yet
//   'fast'       losing more than 1 kg a week after the first two weeks: eat a little more
//   'recomp'     scale flat for two weeks but the waist is shrinking: leave everything alone
//   'stall'      scale flat for two weeks and the waist has not shrunk: cut a little or walk more
//   'break'      scale flat, but in or just after a maintenance phase, where flat is the point
//   'ok'         on track
// phases: the plan's phases. A maintenance phase (the diet break) changes what the scale should do.
export function stallCheck(days, key, planStart, phases = []) {
  const [now, lastWeek, twoWeeksAgo] = [0, 7, 14].map((n) => weightAverage(days, addDays(key, -n)));
  if (now === null || lastWeek === null) return { status: 'need-data' };
  const drop = round1(lastWeek - now);
  // The first two weeks of a deficit drop extra water: at the start, and again after a diet break.
  const water = diffDays(key, planStart) < 14
    || phases.some((p) => p.maintenance && p.end && key > p.end && diffDays(key, p.end) <= 14);
  if (drop > FAST_KG && !water) return { status: 'fast', drop };
  if (twoWeeksAgo === null) return { status: 'need-data' };
  const flat = drop < FLAT_KG && lastWeek > twoWeeksAgo - FLAT_KG;
  if (!flat) return { status: 'ok', drop };
  // The three weekly averages reach back 20 days. While any of them touches a maintenance phase,
  // a flat scale is what the plan asked for, not a stall.
  const from = addDays(key, -20);
  if (phases.some((p) => p.maintenance && p.start <= key && (p.end ?? key) >= from)) return { status: 'break', drop };

  // The newest waist measurement against the newest one from at least two weeks before it.
  const waists = Object.keys(days).filter((k) => k <= key && days[k].waistCm).sort();
  const latest = waists.at(-1);
  const earlier = latest && waists.filter((k) => diffDays(latest, k) >= 14).at(-1);
  const shrunk = Boolean(earlier) && days[earlier].waistCm - days[latest].waistCm >= WAIST_CM;
  return { status: shrunk ? 'recomp' : 'stall', drop, waistKnown: Boolean(earlier) };
}

// The calorie target for the phase after the diet break. Maintenance falls as the weight does:
// about 10 kcal a day per kg at rest (Mifflin-St Jeor), times the plan's activity multiplier of 1.4.
// Height and age have not changed, so they drop out, and the deficit stays the size it was.
export const KCAL_PER_KG = 14;
export function finishKcal(kcal, startKg, nowKg) {
  const lost = Math.max(0, startKg - nowKg);
  return Math.max(Math.min(kcal, KCAL_FLOOR), Math.round((kcal - KCAL_PER_KG * lost) / 10) * 10);
}
// True in the phase that follows a maintenance phase.
export function afterBreak(key, phases) {
  const i = phases.indexOf(phaseFor(key, phases));
  return i > 0 && Boolean(phases[i - 1].maintenance);
}

// The dumbbell list as typed in Settings: "5, 7, 7.5 10". Returns it sorted, or null if it is not a list of weights.
export function readDumbbells(text) {
  const list = String(text).split(/[\s,;]+/).filter(Boolean).map(Number);
  if (list.length < 2 || list.some((n) => !Number.isFinite(n) || n <= 0 || n > 100)) return null;
  return [...new Set(list)].sort((a, b) => a - b);
}

// The next progress photo day on or after key. photos: { first, everyDays }
export function nextPhotoDay(key, photos) {
  if (key <= photos.first) return photos.first;
  const since = diffDays(key, photos.first);
  return addDays(photos.first, Math.ceil(since / photos.everyDays) * photos.everyDays);
}

// A number as it was typed, with a dot or a comma for the decimals. Null when empty or not a number.
// The app shows big numbers as 6,400, so one typed that way is six thousand four hundred, not 6.4.
// Nothing in the app is measured to three decimal places, so there is no clash.
export function typedNumber(text) {
  const t = String(text ?? '').trim();
  const raw = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// One line of a CSV file. Values with a comma, quote or line break are quoted.
export const csvLine = (values) =>
  values.map((v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''))).join(',');

// ----- Food -----

export const MACROS =['kcal', 'protein', 'carbs', 'fat', 'fibre'];
const round1 = (n) => Math.round(n * 10) / 10;

// food holds macros for one serving. amount is grams when the food is logged by weight
// (food.byGrams, with food.grams in one serving), otherwise a number of servings.
export function portion(food, amount) {
  return portionBy(food, amount, food.byGrams ? 'g' : 'serving');
}

// The same, with the unit said out loud: 'g' (needs food.grams) or 'serving'.
// A number the food does not have stays unknown (null). It is never guessed.
export function portionBy(food, amount, unit) {
  const servings = unit === 'g' ? amount / food.grams : amount;
  return Object.fromEntries(MACROS.map((m) => [m, food[m] == null ? null : round1(food[m] * servings)]));
}

// A logged entry after it was edited. typed: the nutrient boxes as they were saved, null when empty.
// Nutrients changed by hand are taken as they are, for the new amount. If only the amount changed,
// what was logged is scaled: the saved food may have been edited since, and the entry is a record.
export const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat'];
export function editEntry(e, amount, typed, meal) {
  if (NUTRIENTS.some((k) => typed[k] !== (e[k] ?? null))) return { ...e, ...typed, amount, meal };
  // An entry with no usable amount of its own has nothing to scale from, so its numbers stay.
  return { ...e, ...portionBy(e, e.amount > 0 ? amount / e.amount : 1, 'serving'), amount, meal };
}

// What a recipe gives per serving. items: logged-style entries with their macros.
// If one ingredient has no figure for a macro, the recipe has none for it either.
export function recipeServing(items, servings) {
  return Object.fromEntries(MACROS.map((m) => {
    if (m !== 'fibre' && items.some((i) => i[m] == null)) return [m, null];
    return [m, round1(items.reduce((a, i) => a + (i[m] ?? 0), 0) / servings)];
  }));
}

// The foods logged in the last `span` days, most often first, each with the amount last used.
export function recentFoods(days, key, span = 30) {
  const seen = new Map();
  for (let i = 0; i < span; i++) {
    // Newest first within the day too, so the amount kept is the one used last.
    for (const e of [...(days[addDays(key, -i)]?.food ?? [])].reverse()) {
      if (!e.foodId) continue;
      const r = seen.get(e.foodId) ?? { foodId: e.foodId, amount: e.amount, unit: e.unit, count: 0, ago: i };
      r.count++;
      seen.set(e.foodId, r);
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.ago - b.ago);
}

// Earlier meals of one kind (say, lunches) from the last `span` days, newest first.
// The same set of foods is listed once.
export function pastMeals(days, key, meal, span = 14) {
  const out = [];
  const had = new Set();
  for (let i = 1; i <= span; i++) {
    const k = addDays(key, -i);
    const entries = (days[k]?.food ?? []).filter((e) => e.meal === meal);
    const sign = entries.map((e) => `${e.foodId ?? e.name}:${e.amount}`).sort().join('|');
    if (!entries.length || had.has(sign)) continue;
    had.add(sign);
    out.push({ key: k, entries });
  }
  return out;
}

export function totals(entries) {
  const sum = Object.fromEntries(MACROS.map((m) => [m, 0]));
  for (const e of entries) for (const m of MACROS) sum[m] += e[m] ?? 0;
  for (const m of MACROS) sum[m] = round1(sum[m]);
  return sum;
}

// The plan's weeks up to today, newest first, for the Progress screen and the weekly check-in.
// Food is averaged over the days it was logged. The weight is the 7-day average on the week's
// last day (today, for the week still running), with its change from seven days before.
//   sched: the days from schedule(). Returns [{ first, last, running, foodDays, kcal, protein,
//   done, planned, weight, change }], with null where there is nothing to go on.
export function weeks(days, sched, key, weekStartDow, planStart, count = 6) {
  const out = [];
  let first = addDays(key, -((weekday(key) - weekStartDow + 7) % 7));
  for (; out.length < count && addDays(first, 6) >= planStart; first = addDays(first, -7)) {
    const last = addDays(first, 6);
    const upTo = last < key ? last : key;
    const fed = [];
    for (let k = first; k <= upTo; k = addDays(k, 1)) if (days[k]?.food?.length) fed.push(totals(days[k].food));
    const avg = (m) => (fed.length ? Math.round(fed.reduce((a, t) => a + t[m], 0) / fed.length) : null);
    const inWeek = sched.filter((d) => d.key >= first && d.key <= last);
    const done = inWeek.filter((d) => d.state === 'done' || d.state === 'min').length;
    const weight = weightAverage(days, upTo);
    const before = weightAverage(days, addDays(upTo, -7));
    out.push({
      first, last, running: last >= key, foodDays: fed.length, kcal: avg('kcal'), protein: avg('protein'),
      done, planned: Math.max(done, inWeek.filter((d) => d.session).length),
      weight, change: weight === null || before === null ? null : round1(weight - before),
    });
  }
  return out;
}

// Which meal a food most likely belongs to, from the local hour. Late night counts as dinner.
export const mealFor = (hour) =>
  hour < 4 ? 'dinner' : hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 19 ? 'snack' : 'dinner';
export const localHour = (now, utcOffsetHours = 3) => new Date(now.getTime() + utcOffsetHours * 3600000).getUTCHours();

// Things to warn about before saving targets. Never blocks, the choice stays with the user.
export const KCAL_FLOOR = 1800;
export const FAT_FLOOR = 50;
export function targetWarnings(t) {
  const out = [];
  if (t.kcal < KCAL_FLOOR) out.push(`${t.kcal} kcal is under ${KCAL_FLOOR}. The plan says not to go below that, because it starts to cost muscle, energy and focus.`);
  if (t.fat < FAT_FLOOR) out.push(`${t.fat} g of fat is under ${FAT_FLOOR} g. The plan keeps fat at ${FAT_FLOOR} g or more.`);
  return out;
}

// Numbers that cannot be right, by field. Catches typos like 8.5 kg or 20000 kcal.
// Returns the first problem as a sentence, or null.
const SANE = {
  heightCm: [120, 230, 'Height should be in centimetres, for example 170.'],
  startKg: [30, 250, 'Starting weight should be in kilograms, for example 85.'],
  goalKg: [30, 250, 'Goal weight should be in kilograms, for example 75.'],
  kcal: [800, 6000, 'Calories look wrong. A daily target is usually between 1,500 and 3,500.'],
  protein: [20, 400, 'Protein looks wrong. It is in grams per day.'],
  carbs: [20, 900, 'Carbs look wrong. They are in grams per day.'],
  fat: [10, 300, 'Fat looks wrong. It is in grams per day.'],
  fibre: [5, 100, 'Fibre looks wrong. It is in grams per day.'],
  waterMl: [500, 10000, 'Water should be in litres, for example 3.'],
};
export function profileProblem(profile) {
  const flat = { ...profile, ...profile.targets };
  for (const [name, [min, max, message]] of Object.entries(SANE)) {
    const v = flat[name];
    if (!(typeof v === 'number' && v >= min && v <= max)) return message;
  }
  return null;
}

// Warnings about the pace the start weight, goal and end date add up to.
const SAFE_KG_A_WEEK = 1;
export function paceWarnings(startKg, goalKg, plan) {
  if (goalKg >= startKg) return ['Your goal is not below your starting weight, so the plan line will not go down.'];
  // The loss happens outside the maintenance phases.
  let lossDays = 0;
  for (let k = addDays(plan.start, 1); k <= plan.end; k = addDays(k, 1)) {
    if (!plan.phases.some((p) => p.maintenance && k >= p.start && k <= (p.end ?? k))) lossDays++;
  }
  if (!lossDays) return ['The whole plan is a maintenance phase, so there are no days left to lose the weight in.'];
  const perWeek = round1(((startKg - goalKg) / lossDays) * 7);
  return perWeek > SAFE_KG_A_WEEK
    ? [`Reaching ${goalKg} kg by the end date means losing ${perWeek} kg a week. More than ${SAFE_KG_A_WEEK} kg a week costs muscle. A later date or a higher goal is safer.`]
    : [];
}

// A weigh-in far from the recent ones is more likely a typo than a real change.
const ODD_WEIGHT_KG = 3;
export function oddWeight(days, key, kg) {
  for (let i = 1; i <= 14; i++) {
    const before = days[addDays(key, -i)]?.weightKg;
    if (before) return Math.abs(kg - before) > ODD_WEIGHT_KG ? round1(Math.abs(kg - before)) : null;
  }
  return null;
}

export const left = (target, eaten) => target - eaten;

// The macro furthest behind its target, or null when all are met.
export function biggestGap(targets, eaten) {
  const behind = ['protein', 'carbs', 'fat']
    .map((m) => ({ m, ratio: eaten[m] / targets[m] }))
    .filter((x) => x.ratio < 1)
    .sort((a, b) => a.ratio - b.ratio);
  return behind[0]?.m ?? null;
}
