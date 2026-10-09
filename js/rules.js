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

// What is next is decided by the cycle, never by the weekday.
export const nextSession = (cycle, doneCount) => cycle[doneCount % cycle.length];

// First planned training day on or after key.
export function nextPlannedDay(key, weekdays) {
  for (let i = 0; i < 7; i++) {
    const k = addDays(key, i);
    if (weekdays[weekday(k)]) return k;
  }
  return null;
}

// done: { 'YYYY-MM-DD': sessionId } for the days actually trained.
// States: done, today, planned, rest. A tick goes on the day trained, even a rest day.
export function weekStrip(key, plan, done) {
  const back = (weekday(key) - plan.weekStartDow + 7) % 7;
  const first = addDays(key, -back);
  return Array.from({ length: 7 }, (_, i) => {
    const k = addDays(first, i);
    const planned = plan.weekdays[weekday(k)] ?? null;
    const state = done[k] ? 'done' : k === key ? 'today' : planned ? 'planned' : 'rest';
    return { key: k, dow: weekday(k), dayNum: Number(k.slice(8)), session: done[k] ?? planned, state };
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
