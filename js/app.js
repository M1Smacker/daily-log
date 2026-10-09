import { plan as basePlan } from './plan.js';
import * as rules from './rules.js';
import { targets, today, log as sampleLog } from './sample.js';

// Held in memory for now. Core Tracker moves this to Firestore.
const state = {
  plan: structuredClone(basePlan),
  log: structuredClone(sampleLog),
  calendarOpen: false,
  gap: { firstKey: null, offers: 0 }, // long-gap offers already answered
};

const GAP_SESSIONS = 4; // missed in a row before offering to push the phases back
const GAP_SHIFT_DAYS = 7;
const REASONS = ['Sick', 'Exams', 'Travel', 'Other'];

const view = document.getElementById('view');
const sheet = document.getElementById('sheet');
const num = (n) => n.toLocaleString('en-GB');
const pct = (part, whole) => Math.min(100, (part / whole) * 100).toFixed(1);
const fmt = (key, opts) =>
  new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
const shortDate = (key) => fmt(key, { day: 'numeric', month: 'short' });
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATE_WORD = { done: 'done', min: 'minimum done', missed: 'missed', planned: 'planned', rest: 'rest day' };
const TICK = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const SETTINGS = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
const CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

// ?today=2026-11-03 previews another date, to check how the plan re-flows.
const todayKey = () =>
  new URLSearchParams(location.search).get('today') ??
  rules.dayKey(new Date(), state.plan.rolloverHour, state.plan.utcOffsetHours);

const sessionOf = (d) => state.plan.sessions[d.session];

function header(key, title) {
  const phase = rules.phaseFor(key, state.plan.phases);
  return `
    <header class="head">
      <div>
        <div class="date">${fmt(key, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>${title}</h1>
      </div>
      <div class="head-side">
        ${phase ? `<span class="pill">${phase.name}</span>` : ''}
        <a class="icon-btn" href="#settings" aria-label="Settings">${SETTINGS}</a>
      </div>
    </header>`;
}

// One day, in the strip or the calendar. Days up to today can be tapped to mark them.
function dayCell(d, key, inStrip) {
  const label = d.state === 'missed' ? 'Missed' : d.session ? sessionOf(d).short : 'Rest';
  const ticked = inStrip && (d.state === 'done' || d.state === 'min');
  const inner = `
    ${inStrip ? `<span class="dow">${DOW[d.dow]}</span>` : ''}
    <span class="dot">${ticked ? TICK : d.dayNum}</span>
    <span class="label">${label}</span>`;
  const cls = `day ${d.state}${d.isToday ? ' is-today' : ''}`;
  if (d.key > key) return `<div class="${cls}">${inner}</div>`;
  const aria = `${fmt(d.key, { weekday: 'long', day: 'numeric', month: 'long' })}, ${d.session ? sessionOf(d).name + ', ' : ''}${STATE_WORD[d.state]}`;
  return `<button type="button" class="${cls}" data-day="${d.key}" aria-label="${aria}">${inner}</button>`;
}

function calendar(days, key) {
  const byKey = new Map(days.map((d) => [d.key, d]));
  const lastMonth = state.plan.end.slice(0, 7);
  let html = '';
  for (let m = state.plan.start.slice(0, 7); m <= lastMonth; ) {
    const [y, mo] = m.split('-').map(Number);
    const first = `${m}-01`;
    const length = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const cells = Array(rules.weekday(first)).fill(null); // weeks start on Sunday
    for (let i = 0; i < length; i++) cells.push(rules.addDays(first, i));

    html += `<h3 class="month" id="month-${m}">${fmt(first, { month: 'long', year: 'numeric' })}</h3><div class="cal-grid">`;
    html += DOW.map((d) => `<span class="cal-dow">${d}</span>`).join('');
    for (let w = 0; w < cells.length; w += 7) {
      const week = cells.slice(w, w + 7);
      for (const p of state.plan.phases) {
        if (week.includes(p.start)) {
          html += `<div class="phase-line">${p.name}, ${shortDate(p.start)} to ${p.end ? shortDate(p.end) : 'goal'}</div>`;
        }
      }
      html += week.map((k) => {
        if (!k) return '<span></span>';
        if (byKey.has(k)) return dayCell(byKey.get(k), key, false);
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

function weekCard(days, key) {
  const open = state.calendarOpen;
  const strip = rules.weekStrip(days, key, state.plan.weekStartDow).map((d) => dayCell(d, key, true)).join('');
  return `
    <section class="week-card" aria-label="${open ? 'Full plan' : 'This week'}">
      ${open ? calendar(days, key) : `<div class="strip">${strip}</div>`}
      <button type="button" class="fold${open ? ' open' : ''}" data-act="toggle-calendar" aria-expanded="${open}">
        ${open ? 'Back to this week' : 'Show the full plan'}${CHEVRON}
      </button>
    </section>`;
}

function gapOffer(run) {
  const answered = state.gap.firstKey === run.firstKey ? state.gap.offers : 0;
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

function nextSession(days, key, run) {
  const todayDay = days.find((d) => d.key === key);
  const next = rules.nextUp(days, key);
  const trained = todayDay && (todayDay.state === 'done' || todayDay.state === 'min');
  const nextLine = next
    ? `Next up: ${sessionOf(next).name} on ${fmt(next.key, { weekday: 'long' })}.`
    : 'That was the last session in the plan.';

  if (trained) {
    return `
      <section class="card">
        <div class="eyebrow">Done today${todayDay.state === 'min' ? ', minimum session' : ''}</div>
        <div class="session-name">${sessionOf(todayDay).name}</div>
        <div class="muted" style="font-size:14px">${nextLine}</div>
        <button type="button" class="btn" data-act="clear-today">Undo</button>
      </section>`;
  }
  if (!next) return '';
  const s = sessionOf(next);
  const when = next.key === key ? 'today' : fmt(next.key, { weekday: 'long' });
  return `
    <section class="card">
      <div class="eyebrow">Next session, ${when}</div>
      <div class="session-name">${s.name}</div>
      <div class="muted" style="font-size:14px">${s.about}. ${s.exercises} exercises, about ${s.minutes} minutes.</div>
      ${run.count >= 2 ? '<div class="note">The last two sessions were missed. A minimum session counts in full.</div>' : ''}
      <div class="pair">
        <button type="button" class="btn primary" data-act="mark-today" data-type="done">Mark done</button>
        <button type="button" class="btn" data-act="mark-today" data-type="min">Did the minimum</button>
      </div>
      <div class="small muted">A missed day never doubles up. The same session just stays next in line.</div>
    </section>`;
}

function macro(name, key, cls = '') {
  return `
    <div class="macro">
      <div class="row"><span>${name}</span><span class="muted">${num(today[key])} of ${num(targets[key])} g</span></div>
      <div class="bar ${cls}"><i style="width:${pct(today[key], targets[key])}%"></i></div>
    </div>`;
}

function calories() {
  const gap = rules.biggestGap(targets, today);
  const gapName = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' }[gap];
  return `
    <section class="card kcal">
      <div class="row"><span class="card-title">Calories</span><span class="kcal-left">${num(rules.left(targets.kcal, today.kcal))} left</span></div>
      <div><span class="big">${num(today.kcal)}</span><span class="muted"> of ${num(targets.kcal)} kcal</span></div>
      <div class="bar tall"><i style="width:${pct(today.kcal, targets.kcal)}%"></i></div>
      <div class="macros">
        ${macro('Protein', 'protein')}
        ${macro('Carbs', 'carbs', 'carbs')}
        ${macro('Fat', 'fat', 'fat')}
      </div>
      <div class="row small muted">
        <span>${gap ? `${gapName} is the gap today.` : 'All three macros are on target.'}</span>
        <span>Fibre ${today.fibre} of ${targets.fibre} g</span>
      </div>
    </section>`;
}

function smallCards(key) {
  const steps = rules.stepTarget(key, state.plan.start, state.plan.steps);
  const litres = (ml) => (ml / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return `
    <div class="grid2">
      <section class="card mini">
        <span class="card-title">Steps</span>
        <span class="big">${num(today.steps)}</span>
        <span class="small muted">of ${num(steps)} today</span>
        <div class="bar"><i style="width:${pct(today.steps, steps)}%"></i></div>
        <button type="button" class="btn compact">Add steps</button>
      </section>
      <section class="card mini">
        <span class="card-title">Water</span>
        <span class="big">${litres(today.waterMl)} L</span>
        <span class="small muted">of ${litres(targets.waterMl)} L today</span>
        <div class="bar carbs"><i style="width:${pct(today.waterMl, targets.waterMl)}%"></i></div>
        <button type="button" class="btn compact">+250 ml</button>
      </section>
      <section class="card mini">
        <span class="card-title">Weight</span>
        <span class="big ${today.weightKg ? '' : 'muted'}">${today.weightKg ? `${today.weightKg} kg` : 'Not yet'}</span>
        <span class="small muted">Morning, before food or water.</span>
        <button type="button" class="btn compact">Add weight</button>
      </section>
      <section class="card mini">
        <span class="card-title">Supplements</span>
        <label class="tick"><input type="checkbox">Creatine</label>
        <label class="tick"><input type="checkbox">Vitamin D</label>
      </section>
    </div>`;
}

function renderToday(key) {
  const days = rules.schedule(state.plan, state.log, key);
  const run = rules.missedRun(days, key);
  view.innerHTML =
    header(key, 'Today') + weekCard(days, key) + gapOffer(run) + nextSession(days, key, run) +
    calories() + smallCards(key) +
    '<div class="status">Sample numbers. Nothing is saved yet.</div>';
}

function renderPlaceholder(key, title) {
  view.innerHTML = header(key, title) +
    '<section class="card"><div class="muted">Not built yet. Only the Today screen exists so far.</div></section>';
}

// The sheet for marking one day.
function openSheet(k) {
  const key = todayKey();
  const d = rules.schedule(state.plan, state.log, key).find((x) => x.key === k);
  const planned = Boolean(state.plan.weekdays[d.dow]);
  const status = d.state === 'missed'
    ? `${sessionOf(d).name}, missed${d.reason ? ` (${d.reason})` : d.auto ? ', nothing was logged' : ''}`
    : d.session ? `${sessionOf(d).name}, ${STATE_WORD[d.state]}` : 'Rest day';
  sheet.innerHTML = `
    <form method="dialog" class="sheet-body">
      <div>
        <div class="card-title">${fmt(k, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div class="muted" style="font-size:14px">${status}</div>
      </div>
      <button type="button" class="btn primary" data-set="done" data-day="${k}">Done</button>
      <button type="button" class="btn" data-set="min" data-day="${k}">Did the minimum</button>
      ${planned ? `
        <button type="button" class="btn" data-set="missed" data-day="${k}">Missed</button>
        <div class="small muted">Or a miss with a reason, if you want to note one:</div>
        <div class="chips">
          ${REASONS.map((r) => `<button type="button" class="chip" data-set="missed" data-reason="${r}" data-day="${k}">${r}</button>`).join('')}
        </div>` : '<div class="small muted">Training on a rest day takes the next session in line.</div>'}
      ${state.log[k] ? `<button type="button" class="btn" data-set="clear" data-day="${k}">Clear this mark</button>` : ''}
      <button class="btn quiet">Close</button>
    </form>`;
  sheet.showModal();
}

function setEntry(k, type, reason) {
  if (type === 'clear') delete state.log[k];
  else state.log[k] = reason ? { type, reason } : { type };
  render(false);
}

const TITLES = { workout: 'Workout', food: 'Food', progress: 'Progress', settings: 'Settings' };

function render(toTop = true) {
  const tab = location.hash.slice(1) || 'today';
  const key = todayKey();
  if (TITLES[tab]) renderPlaceholder(key, TITLES[tab]);
  else renderToday(key);
  for (const a of document.querySelectorAll('.tabs a')) {
    if (a.dataset.tab === (TITLES[tab] ? tab : 'today')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (toTop) scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act], [data-set], [data-day]');
  if (!el) return;
  const key = todayKey();
  if (el.dataset.set) {
    sheet.close();
    setEntry(el.dataset.day, el.dataset.set, el.dataset.reason);
  } else if (el.dataset.day) {
    openSheet(el.dataset.day);
  } else if (el.dataset.act === 'toggle-calendar') {
    state.calendarOpen = !state.calendarOpen;
    render(false);
    const target = state.calendarOpen ? document.getElementById(`month-${key.slice(0, 7)}`) : view;
    target?.scrollIntoView({ block: 'start' });
  } else if (el.dataset.act === 'mark-today') {
    setEntry(key, el.dataset.type);
  } else if (el.dataset.act === 'clear-today') {
    setEntry(key, 'clear');
  } else if (el.dataset.act === 'gap-push' || el.dataset.act === 'gap-keep') {
    const run = rules.missedRun(rules.schedule(state.plan, state.log, key), key);
    state.gap = { firstKey: run.firstKey, offers: Math.floor(run.count / GAP_SESSIONS) };
    if (el.dataset.act === 'gap-push') {
      state.plan.phases = rules.shiftPhases(state.plan.phases, key, GAP_SHIFT_DAYS);
      state.plan.end = rules.addDays(state.plan.end, GAP_SHIFT_DAYS);
    }
    render(false);
  }
});

// Tapping the dimmed area around the sheet closes it.
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

addEventListener('hashchange', () => render());
render();
