import { plan } from './plan.js';
import * as rules from './rules.js';
import { targets, today, done } from './sample.js';

const view = document.getElementById('view');
const num = (n) => n.toLocaleString('en-GB');
const pct = (part, whole) => Math.min(100, (part / whole) * 100).toFixed(1);
const longDate = (key, opts) =>
  new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TICK = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const SETTINGS = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';

function header(key, title) {
  const phase = rules.phaseFor(key, plan.phases);
  return `
    <header class="head">
      <div>
        <div class="date">${longDate(key, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>${title}</h1>
      </div>
      <div class="head-side">
        ${phase ? `<span class="pill">${phase.name}</span>` : ''}
        <a class="icon-btn" href="#settings" aria-label="Settings">${SETTINGS}</a>
      </div>
    </header>`;
}

function weekStrip(key) {
  const days = rules.weekStrip(key, plan, done).map((d) => `
    <div class="day ${d.state}">
      <span class="dow">${DOW[d.dow]}</span>
      <span class="dot">${d.state === 'done' ? TICK : d.dayNum}</span>
      <span class="label">${d.session ? plan.sessions[d.session].short : 'Rest'}</span>
    </div>`);
  return `<section class="week" aria-label="This week">${days.join('')}</section>`;
}

function nextSession(key) {
  const s = plan.sessions[rules.nextSession(plan.cycle, Object.keys(done).length)];
  const day = rules.nextPlannedDay(key, plan.weekdays);
  const when = day === key ? 'today' : longDate(day, { weekday: 'long' });
  return `
    <section class="card">
      <div class="eyebrow">Next session, ${when}</div>
      <div class="session-name">${s.name}</div>
      <div class="muted" style="font-size:14px">${s.about}. ${s.exercises} exercises, about ${s.minutes} minutes.</div>
      <div class="pair">
        <button type="button" class="btn primary">Mark done</button>
        <button type="button" class="btn">Did the minimum</button>
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
  const steps = rules.stepTarget(key, plan.start, plan.steps);
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
  view.innerHTML =
    header(key, 'Today') + weekStrip(key) + nextSession(key) + calories() + smallCards(key) +
    '<div class="status">Sample numbers. Nothing is saved yet.</div>';
}

function renderPlaceholder(key, title) {
  view.innerHTML = header(key, title) +
    '<section class="card"><div class="muted">Not built yet. Only the Today screen exists so far.</div></section>';
}

const TITLES = { workout: 'Workout', food: 'Food', progress: 'Progress', settings: 'Settings' };

function render() {
  const tab = location.hash.slice(1) || 'today';
  const key = rules.dayKey(new Date(), plan.rolloverHour, plan.utcOffsetHours);
  if (TITLES[tab]) renderPlaceholder(key, TITLES[tab]);
  else renderToday(key);
  for (const a of document.querySelectorAll('.tabs a')) {
    if (a.dataset.tab === (TITLES[tab] ? tab : 'today')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  scrollTo(0, 0);
}

addEventListener('hashchange', render);
render();
