// How the Coach is drawn, and the glue that feeds it from the app's data. The rules live in
// coach.js and the sentences in coach-words.js. Nothing here saves anything.

import * as rules from './rules.js';
import * as coach from './coach.js';
import { esc, shortDate } from './ui.js';
import { say, LIFT_NOTE, dayName } from './coach-words.js';

// One line. Level none is drawn plain and muted.
export const coachLine = (item, ctx) => (item
  ? `<div class="coach-line lvl-${item.level ?? 'none'}" data-code="${item.code}">${esc(say(item, ctx))}</div>` : '');

// The lines for one lift: the weight verdict, then the effort line, then the fixed note that
// says what it was judged from.
// `after` is more lines (the sets check) that go before the note.
export function liftLines(verdicts, ctx, after = '') {
  if (!verdicts.some((v) => v.code !== 'L9')) return after;
  return verdicts.map((v) => coachLine(v, ctx)).join('') + after + `<div class="coach-note">${esc(LIFT_NOTE)}</div>`;
}

// ----- Feeding the Coach from the app's data -----

export function coachWeek(c) {
  const p = c.profile;
  const end = coach.weekEnd(c.key, c.plan.weekStartDow);
  return coach.weekCheck({
    key: c.key,
    days: c.data.days,
    T: c.targets.kcal,
    P: c.targets.protein,
    targets: { fibre: c.targets.fibre, waterMl: c.targets.waterMl },
    plan: {
      start: c.plan.start, phases: c.plan.phases, steps: c.plan.steps, weekStartDow: c.plan.weekStartDow,
      sessionsPerWeek: Object.keys(c.plan.weekdays ?? {}).length || 4,
    },
    targetChangedOn: p?.targetChangedOn ?? null,
    planLine: p ? rules.planWeight(end, c.plan, p.startKg, p.goalKg) : null,
  });
}

// A finished day. Null before the plan began.
export function coachDay(c, key) {
  if (key < c.plan.start) return null;
  const d = c.data.days[key];
  return {
    key,
    ...coach.dayCheck({
      entries: d?.food ?? [], kcalTarget: c.targets.kcal, proteinTarget: c.targets.protein,
      steps: d?.steps ?? null, stepGoal: rules.stepTarget(key, c.plan.start, c.plan.steps),
      maintenance: Boolean(rules.phaseFor(key, c.plan.phases)?.maintenance),
    }),
  };
}

// The open day: only the evening protein reminder. The day runs past midnight until the
// rollover, so 1 am is hour 25 of the day that is still open, not the morning of a new one.
export function coachToday(c) {
  const clock = rules.localHour(new Date(), c.plan.utcOffsetHours);
  return coach.dayCheck({
    entries: c.day.food ?? [], kcalTarget: c.targets.kcal, proteinTarget: c.targets.protein,
    open: true, hour: clock < c.plan.rolloverHour ? clock + 24 : clock,
  });
}

// ----- The cards -----

const range = (w) => (w.week ? `${shortDate(w.week.from)} to ${shortDate(w.week.to)}` : '');

// The week check in full, for Progress.
export function weekCardHtml(c) {
  const w = coachWeek(c);
  const ctx = { T: c.targets.kcal };
  const verdict = `${coachLine(w.verdict, ctx)}${w.actions.map((a) => `<div class="coach-action">${esc(say(a, ctx))}</div>`).join('')}`;
  const lines = w.lines.map((l) => coachLine(l, ctx)).join('');
  const sofar = w.soFar.days > 0
    ? `<div class="small muted">This week so far: ${w.soFar.sessions} session${w.soFar.sessions === 1 ? '' : 's'}, food logged enough on ${w.soFar.judgeable} of ${w.soFar.days} day${w.soFar.days === 1 ? '' : 's'}.</div>` : '';
  return `
    <section class="card">
      <span class="card-title">Coach, the week</span>
      ${w.week ? `<span class="card-tag">${range(w)}</span>` : ''}
      <div class="coach-slot">${verdict}</div>
      ${lines ? `<div class="coach-slot facts">${lines}</div>` : ''}
      ${sofar}
      <div class="small muted">Fixed rules from your plan, worked out on the phone. It only reads what you logged, and it never changes your targets.</div>
    </section>`;
}

// What Today shows: yesterday's day check, the evening reminder, and the week's verdict when it
// asks for something or when the week has only just finished. Empty when there is nothing to say.
export function todayCardHtml(c) {
  const ctx = { T: c.targets.kcal };
  const blocks = [];

  const y = coachDay(c, rules.addDays(c.key, -1));
  if (y) {
    const ctxY = { ...ctx, dayName: dayName(y.key) };
    const lines = y.lines.map((l) => coachLine(l, ctxY)).join('');
    const tick = y.tick ? '<div class="coach-line lvl-good" data-code="D8">Step target hit.</div>' : '';
    blocks.push(`<div class="coach-block"><div class="coach-when">Yesterday, ${esc(dayName(y.key))}</div>${lines}${tick}</div>`);
  }

  const evening = coachToday(c).evening;
  if (evening) blocks.push(`<div class="coach-block"><div class="coach-when">Today</div>${coachLine(evening, ctx)}</div>`);

  const w = coachWeek(c);
  const fresh = w.week && rules.diffDays(c.key, rules.addDays(w.week.to, 1)) < 2; // Thursday and Friday
  if (w.verdict.level === 'watch' || (fresh && w.verdict.code !== 'W0')) {
    const acts = w.actions.map((a) => `<div class="coach-action">${esc(say(a, ctx))}</div>`).join('');
    blocks.push(`<div class="coach-block"><div class="coach-when">Last week</div>${coachLine(w.verdict, ctx)}${acts}<a class="link" href="#progress">See the week</a></div>`);
  }

  if (!blocks.length) return '';
  return `<section class="card coach"><span class="card-title">Coach</span>${blocks.join('')}</section>`;
}

// The Coach's verdicts as rule codes, for the "Copy my data for Claude" text.
export function coachCodes(c) {
  const w = coachWeek(c);
  const y = coachDay(c, rules.addDays(c.key, -1));
  const list = (items) => items.map((x) => `${x.code}${x.level && x.level !== 'none' ? ` (${x.level})` : ''}`).join(', ');
  const out = [];
  out.push(`Week${w.week ? ` ${w.week.from} to ${w.week.to}` : ''}: verdict ${list([w.verdict])}${w.actions.length ? `; actions ${w.actions.map((a) => a.code).join(', ')}` : ''}${w.lines.length ? `; lines ${list(w.lines)}` : ''}.`);
  if (y) out.push(`Yesterday ${y.key}: ${y.lines.length ? list(y.lines) : 'nothing to judge'}${y.tick ? ', D8' : ''}.`);
  return out;
}
