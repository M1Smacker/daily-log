// Pure rules. No DOM, no Firebase. Tested in tests/rules.test.js.
// Days are passed around as 'YYYY-MM-DD' keys so time zones only matter in dayKey().

const DAY = 86400000;
const toMs = (key) => Date.parse(key + 'T00:00:00Z');
const toKey = (ms) => new Date(ms).toISOString().slice(0, 10);

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

// ----- Training -----

export const MIN_EXERCISES = 3; // the minimum session is the first three lifts
const MIN_SETS = 2;

// How many sets to do today. ex: { sets, main }, phase: { load, start }.
export function setsFor(ex, phase, key, minimum = false) {
  if (minimum) return Math.min(MIN_SETS, ex.sets);
  if (phase?.load === 'half') return Math.ceil(ex.sets / 2);
  if (phase?.load === 'ramp') {
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
  const kg = Math.min(...sets.map((s) => s.kg ?? 0));
  if (!(kg > 0)) return { type: 'start' };

  const top = last.top ?? ex.reps[1];
  const effortOk = sets.every((s) => s.rir == null || s.rir >= (last.rirLo ?? 0));
  const earned = sets.length >= (last.planned ?? 1) && sets.every((s) => s.reps >= top) && effortOk;
  if (!earned) return { type: 'hold', kg };

  const to = nextWeight(ex.kind, kg, dumbbells);
  if (to === null) return { type: 'cap', kg };
  const need = top + EXTRA_REPS;
  if ((to - kg) / kg > BIG_JUMP && !sets.every((s) => s.reps >= need)) return { type: 'extra', kg, to, need };
  return { type: 'jump', kg, to };
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
//   'ok'         on track
export function stallCheck(days, key, planStart) {
  const [now, lastWeek, twoWeeksAgo] = [0, 7, 14].map((n) => weightAverage(days, addDays(key, -n)));
  if (now === null || lastWeek === null) return { status: 'need-data' };
  const drop = round1(lastWeek - now);
  if (drop > FAST_KG && diffDays(key, planStart) >= 14) return { status: 'fast', drop };
  if (twoWeeksAgo === null) return { status: 'need-data' };
  const flat = drop < FLAT_KG && lastWeek > twoWeeksAgo - FLAT_KG;
  if (!flat) return { status: 'ok', drop };

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
