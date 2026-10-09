// The Today screen: week strip and calendar, next session, calories, and the small daily cards.

import * as rules from './rules.js';
import * as store from './store.js';
import { ui, ctx } from './state.js';
import {
  view, sheet, esc, num, pct, fmt, shortDate, longDate, litres, DOW, TICK, CHEVRON,
  actions, forms, app, openSheet, field, readNumber,
} from './ui.js';

const GAP_SESSIONS = 4; // missed in a row before offering to push the phases back
const GAP_SHIFT_DAYS = 7;
const REASONS = ['Sick', 'Exams', 'Travel', 'Other'];
const WATER_STEP_ML = 250;
const STATE_WORD = { done: 'done', min: 'minimum done', missed: 'missed', planned: 'planned', rest: 'rest day' };

// One day, in the strip or the calendar. Days up to today can be tapped to mark them.
function dayCell(c, d, inStrip) {
  const s = d.session && c.plan.sessions[d.session];
  const label = d.state === 'missed' ? 'Missed' : s ? s.short : 'Rest';
  const ticked = inStrip && (d.state === 'done' || d.state === 'min');
  const inner = `
    ${inStrip ? `<span class="dow">${DOW[d.dow]}</span>` : ''}
    <span class="dot">${ticked ? TICK : d.dayNum}</span>
    <span class="label">${label}</span>`;
  const cls = `day ${d.state}${d.isToday ? ' is-today' : ''}`;
  if (d.key > c.key) return `<div class="${cls}">${inner}</div>`;
  const aria = `${longDate(d.key)}, ${s ? s.name + ', ' : ''}${STATE_WORD[d.state]}`;
  return `<button type="button" class="${cls}" data-act="open-day" data-day="${d.key}" aria-label="${aria}">${inner}</button>`;
}

function calendar(c, days) {
  const byKey = new Map(days.map((d) => [d.key, d]));
  const lastMonth = c.plan.end.slice(0, 7);
  let html = '';
  for (let m = c.plan.start.slice(0, 7); m <= lastMonth; ) {
    const [y, mo] = m.split('-').map(Number);
    const first = `${m}-01`;
    const length = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const cells = Array(rules.weekday(first)).fill(null); // weeks start on Sunday
    for (let i = 0; i < length; i++) cells.push(rules.addDays(first, i));

    html += `<h3 class="month" id="month-${m}">${fmt(first, { month: 'long', year: 'numeric' })}</h3><div class="cal-grid">`;
    html += DOW.map((d) => `<span class="cal-dow">${d}</span>`).join('');
    for (let w = 0; w < cells.length; w += 7) {
      const week = cells.slice(w, w + 7);
      for (const p of c.plan.phases) {
        if (week.includes(p.start)) {
          html += `<div class="phase-line">${p.name}, ${shortDate(p.start)} to ${p.end ? shortDate(p.end) : 'goal'}</div>`;
        }
      }
      html += week.map((k) => {
        if (!k) return '<span></span>';
        if (byKey.has(k)) return dayCell(c, byKey.get(k), false);
        return `<div class="day out"><span class="dot">${Number(k.slice(8))}</span><span class="label"></span></div>`;
      }).join('');
    }
    html += '</div>';
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  }
  return html + `
    <div class="legend">
      <span><i class="key done"></i>Done</span>
      <span><i class="key min"></i>Minimum</span>
      <span><i class="key missed"></i>Missed</span>
      <span><i class="key planned"></i>Planned</span>
    </div>`;
}

function weekCard(c, days) {
  const open = ui.calendarOpen;
  const strip = rules.weekStrip(days, c.key, c.plan.weekStartDow).map((d) => dayCell(c, d, true)).join('');
  return `
    <section class="week-card" aria-label="${open ? 'Full plan' : 'This week'}">
      ${open ? calendar(c, days) : `<div class="strip">${strip}</div>`}
      <button type="button" class="fold${open ? ' open' : ''}" data-act="toggle-calendar" aria-expanded="${open}">
        ${open ? 'Back to this week' : 'Show the full plan'}${CHEVRON}
      </button>
    </section>`;
}

// plan.gap remembers which long-gap offers have been answered, so each is asked once.
function gapOffer(c, run) {
  const gap = c.plan.gap ?? {};
  const answered = gap.firstKey === run.firstKey ? gap.offers : 0;
  if (Math.floor(run.count / GAP_SESSIONS) <= answered) return '';
  return `
    <section class="card raised">
      <div class="card-title">${run.count} sessions missed in a row</div>
      <div class="muted" style="font-size:14px">You can push every phase back a week so the plan picks up where you left off. Your sessions already carry on in order either way.</div>
      <div class="pair">
        <button type="button" class="btn primary" data-act="gap-push">Push back a week</button>
        <button type="button" class="btn" data-act="gap-keep">Keep the dates</button>
      </div>
    </section>`;
}

function nextSession(c, days, run) {
  const todayDay = days.find((d) => d.key === c.key);
  const next = rules.nextUp(days, c.key);
  const trained = todayDay && (todayDay.state === 'done' || todayDay.state === 'min');
  // Session number in the whole plan, counted from the sessions actually done.
  const doneBefore = days.filter((d) => d.key < c.key && (d.state === 'done' || d.state === 'min')).length;
  const no = `No. ${String(doneBefore + 1).padStart(2, '0')}`;

  if (trained) {
    const nextLine = next
      ? `Next up: ${c.plan.sessions[next.session].name} on ${fmt(next.key, { weekday: 'long' })}.`
      : 'That was the last session in the plan.';
    return `
      <section class="card ticket">
        <div class="ticket-top">
          <span class="eyebrow">Done today${todayDay.state === 'min' ? ', minimum' : ''}</span>
          <span class="ticket-no">${no}</span>
        </div>
        <div class="session-name">${c.plan.sessions[todayDay.session].name}</div>
        <div class="muted" style="font-size:14px">${nextLine}</div>
        <div class="tear"></div>
        <div class="pair">
          <button type="button" class="btn primary" data-act="start-workout">Open session</button>
          <button type="button" class="btn" data-act="mark-today" data-type="clear">Undo</button>
        </div>
      </section>`;
  }
  if (!next) return '';
  const s = c.plan.sessions[next.session];
  const when = next.key === c.key ? 'today' : fmt(next.key, { weekday: 'long' });
  return `
    <section class="card ticket">
      <div class="ticket-top">
        <span class="eyebrow">Next session, ${when}</span>
        <span class="ticket-no">${no}</span>
      </div>
      <div class="session-name">${s.name}</div>
      <div class="muted" style="font-size:14px">${s.about}.</div>
      <div class="meta">
        <div><b>${s.exercises}</b><span>Exercises</span></div>
        <div><b>${s.minutes}</b><span>Minutes</span></div>
      </div>
      ${run.count >= 2 ? '<div class="note">The last two sessions were missed. A minimum session counts in full.</div>' : ''}
      <div class="tear"></div>
      <div class="pair">
        <button type="button" class="btn primary" data-act="start-workout">Start session</button>
        <button type="button" class="btn" data-act="start-workout" data-minimum="true">Minimum</button>
      </div>
      <div class="small muted">A missed day never doubles up. The same session just stays next in line.</div>
    </section>`;
}

function calories(c, eaten) {
  const t = c.targets;
  const macro = (name, m) => `
    <div class="macro">
      <div class="row"><span>${name}</span><span class="muted"><b>${num(eaten[m])}</b> of ${num(t[m])} g</span></div>
      <div class="bar ${m}"><i style="width:${pct(eaten[m], t[m])}%"></i></div>
    </div>`;
  const gap = rules.biggestGap(t, eaten);
  const remaining = rules.left(t.kcal, eaten.kcal);
  const note = eaten.kcal === 0 ? 'Nothing logged yet today.'
    : gap ? `${{ protein: 'Protein', carbs: 'Carbs', fat: 'Fat' }[gap]} is the gap today.`
    : 'All three macros are on target.';
  return `
    <section class="card kcal">
      <div class="row">
        <span class="card-title">Calories</span>
        <span class="kcal-left">${remaining >= 0 ? `${num(remaining)} left` : `${num(-remaining)} over`}</span>
      </div>
      <div><span class="big">${num(eaten.kcal)}</span><span class="muted"> of ${num(t.kcal)} kcal</span></div>
      <div class="bar tall"><i style="width:${pct(eaten.kcal, t.kcal)}%"></i></div>
      <div class="macros">${macro('Protein', 'protein')}${macro('Carbs', 'carbs')}${macro('Fat', 'fat')}</div>
      <div class="row small muted"><span>${note}</span><span>Fibre ${num(eaten.fibre)} of ${num(t.fibre)} g</span></div>
      <a class="btn compact" href="#food">Log food</a>
    </section>`;
}

function smallCards(c) {
  const d = c.day;
  const stepGoal = rules.stepTarget(c.key, c.plan.start, c.plan.steps);
  const steps = d.steps ?? 0;
  const water = d.waterMl ?? 0;
  return `
    <div class="grid2">
      <section class="card mini">
        <span class="card-title">Steps</span>
        <span class="big">${num(steps)}</span>
        <span class="small muted sub">of ${num(stepGoal)} today</span>
        <div class="bar"><i style="width:${pct(steps, stepGoal)}%"></i></div>
        <button type="button" class="btn compact" data-act="open-steps">${d.steps == null ? 'Add steps' : 'Update'}</button>
      </section>
      <section class="card mini">
        <span class="card-title">Water</span>
        <span class="big">${litres(water)} L</span>
        <span class="small muted sub">of ${litres(c.targets.waterMl)} L today</span>
        <div class="bar carbs"><i style="width:${pct(water, c.targets.waterMl)}%"></i></div>
        <div class="pair tight">
          <button type="button" class="btn compact narrow" data-act="water" data-ml="${-WATER_STEP_ML}" aria-label="Take ${WATER_STEP_ML} ml off" ${water ? '' : 'disabled'}>&minus;</button>
          <button type="button" class="btn compact" data-act="water" data-ml="${WATER_STEP_ML}">+${WATER_STEP_ML} ml</button>
        </div>
      </section>
      <section class="card mini">
        <span class="card-title">Weight</span>
        <span class="big ${d.weightKg ? '' : 'muted'}">${d.weightKg ? `${d.weightKg} kg` : 'Not yet'}</span>
        <span class="small muted sub">Morning, before food or water.</span>
        <button type="button" class="btn compact" data-act="open-weight">${d.weightKg ? 'Change' : 'Add weight'}</button>
      </section>
      <section class="card mini">
        <span class="card-title">Supplements</span>
        <div class="ticks">
          <label class="tick"><input type="checkbox" data-tick="creatine" ${d.creatine ? 'checked' : ''}>Creatine</label>
          <label class="tick"><input type="checkbox" data-tick="vitaminD" ${d.vitaminD ? 'checked' : ''}>Vitamin D</label>
        </div>
      </section>
    </div>`;
}

export function todayBody() {
  const c = ctx();
  const days = rules.schedule(c.plan, c.log, c.key);
  const run = rules.missedRun(days, c.key);
  return weekCard(c, days) + gapOffer(c, run) + nextSession(c, days, run) +
    calories(c, rules.totals(c.day.food ?? [])) + smallCards(c) +
    '<div class="status" data-sync></div>';
}

// ----- Handlers -----

const setSession = (key, type, reason) =>
  store.setDay(key, { session: type === 'clear' ? null : reason ? { type, reason } : { type } });

actions['toggle-calendar'] = () => {
  ui.calendarOpen = !ui.calendarOpen;
  app.redraw();
  const target = ui.calendarOpen ? document.getElementById(`month-${ctx().key.slice(0, 7)}`) : view;
  target?.scrollIntoView({ block: 'start' });
};

actions['mark-today'] = (el) => setSession(ctx().key, el.dataset.type);

actions['open-day'] = (el) => {
  const c = ctx();
  const k = el.dataset.day;
  const d = rules.schedule(c.plan, c.log, c.key).find((x) => x.key === k);
  const planned = Boolean(c.plan.weekdays[d.dow]);
  const name = d.session && c.plan.sessions[d.session].name;
  const status = d.state === 'missed'
    ? `${name}, missed${d.reason ? ` (${esc(d.reason)})` : d.auto ? ', nothing was logged' : ''}`
    : name ? `${name}, ${STATE_WORD[d.state]}` : 'Rest day';
  openSheet(`
    <div class="sheet-body">
      <div>
        <div class="card-title">${longDate(k)}</div>
        <div class="muted" style="font-size:14px">${status}</div>
      </div>
      ${d.state === 'done' || d.state === 'min' || d.isToday
        ? `<button type="button" class="btn primary" data-act="start-workout" data-day="${k}">${d.isToday && d.state === 'planned' ? 'Start this session' : 'Open the logged sets'}</button>` : ''}
      <button type="button" class="btn${d.state === 'done' || d.state === 'min' || d.isToday ? '' : ' primary'}" data-act="set-day" data-type="done" data-day="${k}">Mark done</button>
      <button type="button" class="btn" data-act="set-day" data-type="min" data-day="${k}">Did the minimum</button>
      ${planned ? `
        <button type="button" class="btn" data-act="set-day" data-type="missed" data-day="${k}">Missed</button>
        <div class="small muted">Or a miss with a reason, if you want to note one:</div>
        <div class="chips">
          ${REASONS.map((r) => `<button type="button" class="chip" data-act="set-day" data-type="missed" data-reason="${r}" data-day="${k}">${r}</button>`).join('')}
        </div>` : '<div class="small muted">Training on a rest day takes the next session in line.</div>'}
      ${c.log[k] ? `<button type="button" class="btn" data-act="set-day" data-type="clear" data-day="${k}">Clear this mark</button>` : ''}
      <button type="button" class="btn quiet" data-act="close-sheet">Close</button>
    </div>`);
};

actions['set-day'] = (el) => {
  sheet.close();
  setSession(el.dataset.day, el.dataset.type, el.dataset.reason);
};

for (const act of ['gap-push', 'gap-keep']) {
  actions[act] = () => {
    const c = ctx();
    const run = rules.missedRun(rules.schedule(c.plan, c.log, c.key), c.key);
    const patch = { gap: { firstKey: run.firstKey, offers: Math.floor(run.count / GAP_SESSIONS) } };
    if (act === 'gap-push') {
      patch.phases = rules.shiftPhases(c.plan.phases, c.key, GAP_SHIFT_DAYS);
      patch.end = rules.addDays(c.plan.end, GAP_SHIFT_DAYS);
    }
    store.setPlan(patch);
  };
}

actions.water = (el) => {
  const c = ctx();
  store.setDay(c.key, { waterMl: Math.max(0, (c.day.waterMl ?? 0) + Number(el.dataset.ml)) });
};

// A one-number sheet, used for steps and weight.
const numberSheet = (form, title, hint, label, value, opts) => openSheet(`
  <form class="sheet-body" data-form="${form}" novalidate>
    <div>
      <div class="card-title">${title}</div>
      <div class="muted" style="font-size:14px">${hint}</div>
    </div>
    ${field('value', label, value, opts)}
    <button class="btn primary">Save</button>
    <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
  </form>`);

actions['open-steps'] = () => numberSheet('steps', 'Steps today',
  'Type the total your phone shows so far, not the steps since last time.', 'Steps so far', ctx().day.steps, { decimal: false });
actions['open-weight'] = () => numberSheet('weight', 'Weight this morning',
  'After the toilet, before any food or water, same scale.', 'Weight', ctx().day.weightKg, { unit: 'kg' });

forms.steps = (fd) => {
  const n = readNumber(fd, 'value');
  if (n === null) return 'Type a number of steps.';
  store.setDay(ctx().key, { steps: Math.round(n) });
};
forms.weight = (fd) => {
  const n = readNumber(fd, 'value');
  if (n === null || n < 30 || n > 250) return 'Type your weight in kilograms, for example 82.4.';
  store.setDay(ctx().key, { weightKg: Math.round(n * 10) / 10 });
};

// Supplement tick boxes save as soon as they change.
document.addEventListener('change', (e) => {
  const name = e.target.dataset?.tick;
  if (name) store.setDay(ctx().key, { [name]: e.target.checked });
});
