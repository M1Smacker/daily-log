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

// log: { 'YYYY-MM-DD': { type: 'done' | 'min' | 'missed', reason? } }.
// Builds every day from plan.start to plan.end. What is next is decided by the cycle,
// never by the weekday: a missed session stays next in line and lands on the next
// planned gym day, so every later day moves one session along.
// A planned day that has passed with nothing logged counts as missed on its own.
// States: done, min, missed, planned, rest.
export function schedule(plan, log, todayKey) {
  const days = [];
  const n = plan.cycle.length;
  let idx = 0;
  for (let k = plan.start; k <= plan.end; k = addDays(k, 1)) {
    const entry = log[k];
    const planned = Boolean(plan.weekdays[weekday(k)]);
    const day = { key: k, dow: weekday(k), dayNum: Number(k.slice(8)), isToday: k === todayKey, session: null, state: 'rest' };
    if (entry?.type === 'done' || entry?.type === 'min') {
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

export const left = (target, eaten) => target - eaten;

// The macro furthest behind its target, or null when all are met.
export function biggestGap(targets, eaten) {
  const behind = ['protein', 'carbs', 'fat']
    .map((m) => ({ m, ratio: eaten[m] / targets[m] }))
    .filter((x) => x.ratio < 1)
    .sort((a, b) => a.ratio - b.ratio);
  return behind[0]?.m ?? null;
}
