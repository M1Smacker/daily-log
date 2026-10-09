// The Workout screen: the lifts for the session, set logging, the jump rule, the rest timer
// and a small cardio log. Sets save as they are typed, so closing the app loses nothing.
//
// A day's workout is stored as:
//   { session, minimum, finished, planned-effort (rirLo), half, lifts: { [exerciseId]: { sets, planned, alt } } }

import * as rules from './rules.js';
import * as store from './store.js';
import { ui, ctx } from './state.js';
import { sessions } from './exercises.js';
import { esc, num, longDate, TICK, CHEVRON, actions, forms, app, field, readNumber } from './ui.js';

const CARDIO = ['Easy bike', 'Bike intervals', 'Treadmill walk', 'Other'];
const range = ([a, b], unit = '') => (a === b ? `${a}${unit}` : `${a} to ${b}${unit}`);
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;
const restText = ([a, b]) => (b % 60 === 0 && a % 60 === 0 ? `${range([a / 60, b / 60])} min` : range([a, b], ' s'));
const video = (name) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} form`)}`;
const filled = (lift) => (lift?.sets ?? []).filter((s) => s?.reps > 0);

// Everything the screen needs to know about the workout on one day.
function view() {
  const c = ctx();
  const key = ui.workoutDay ?? c.key;
  const days = rules.schedule(c.plan, c.log, c.key);
  const saved = c.data.days[key]?.workout;
  const sessionId = saved?.session ?? days.find((d) => d.key === key)?.session ?? rules.nextUp(days, c.key)?.session;
  if (!sessionId) return null;
  const phase = rules.phaseFor(key, c.plan.phases);
  const w = saved ?? {
    session: sessionId, minimum: Boolean(ui.wantMinimum), finished: false,
    rirLo: rules.targetRir(phase, key)[0], half: phase?.load === 'half', lifts: {},
  };
  const all = sessions[sessionId];
  const lifts = (w.minimum ? all.slice(0, rules.MIN_EXERCISES) : all).map((ex, i) => {
    const planned = rules.setsFor(ex, phase, key, w.minimum);
    const done = filled(w.lifts[ex.id]).length;
    return { ...ex, n: i + 1, planned, logged: w.lifts[ex.id], complete: done >= planned };
  });
  return { c, key, isToday: key === c.key, phase, w, lifts, session: c.plan.sessions[sessionId] };
}

// The last time this lift was done before `key`, skipping days the alternative was used.
function lastTime(c, id, key) {
  const past = Object.keys(c.data.days).filter((k) => k < key).sort().reverse();
  for (const k of past) {
    const w = c.data.days[k].workout;
    const lift = w?.lifts?.[id];
    if (lift && !lift.alt && filled(lift).length) return { sets: filled(lift), planned: lift.planned, rirLo: w.rirLo };
  }
  return null;
}

// Strength scores for one lift, oldest first, leaving out deload and minimum sessions.
function scores(c, id, key) {
  return Object.keys(c.data.days).filter((k) => k < key).sort()
    .map((k) => c.data.days[k].workout)
    .filter((w) => w && !w.half && !w.minimum && w.lifts?.[id] && !w.lifts[id].alt && filled(w.lifts[id]).length)
    .map((w) => rules.bestSet(w.lifts[id].sets));
}

function progressNote(v, ex, last) {
  const p = rules.progression(ex, last, v.c.plan.dumbbells);
  const [lo, hi] = ex.reps;
  const note = (title, text, warn = false) =>
    `<div class="note${warn ? ' warn' : ''}"><b>${title}</b>${text}</div>`;
  let html = '';
  if (p.type === 'start') html = note('First time', 'Pick a weight that leaves 3 or 4 reps in the tank on the first set.');
  else if (p.type === 'body') html = note('Reps only', 'There is no weight to add here. Build up the reps inside the range.');
  else if (p.type === 'hold') html = note('Same weight', `Stay at ${p.kg} kg. When every set reaches ${hi} reps, the weight goes up.`);
  else if (p.type === 'jump') html = note('Jump earned', `Last time you hit ${hi} reps on every set, so today is ${p.to} kg. Work back up from ${lo} reps, then jump again.`);
  else if (p.type === 'extra') html = note('Nearly there', `The next step up is ${p.to} kg, a big jump from ${p.kg} kg. Reach ${p.need} reps on every set first.`);
  else if (p.type === 'cap') html = note('Heaviest dumbbell', `You have earned a jump, but ${p.kg} kg is the heaviest dumbbell.${ex.alt ? ` Switch to the alternative so this can keep getting heavier: ${esc(ex.alt)}.` : ''}`);
  if (rules.wentBackwards(scores(v.c, ex.id, v.key))) {
    html += note('Two steps back', 'This lift has gone backwards two sessions in a row. Check sleep and food first. If those are fine, take an early deload week.', true);
  }
  return { html, suggest: p.type === 'jump' ? p.to : p.kg ?? '' };
}

function liftCard(v, ex) {
  const last = lastTime(v.c, ex.id, v.key);
  const { html: noteHtml, suggest } = progressNote(v, ex, last);
  const body = ex.kind === 'body';
  const isoLast = !ex.main;
  const rir = rules.targetRir(v.phase, v.key);
  const rirLast = rules.targetRir(v.phase, v.key, isoLast);
  const rows = Array.from({ length: ex.planned }, (_, i) => {
    const s = ex.logged?.sets?.[i] ?? {};
    const was = last?.sets[i];
    const input = (f, value, mode, label, extra = '') =>
      `<input type="text" inputmode="${mode}" autocomplete="off" value="${value ?? ''}" data-lift="${ex.id}" data-set="${i}" data-f="${f}" aria-label="Set ${i + 1} ${label}" ${extra}>`;
    return `
      <span class="set-n">${i + 1}</span>
      <span class="set-last">${was ? `${body ? '' : `${was.kg} x `}${was.reps}` : ''}</span>
      ${body ? '<span class="set-bw">BW</span>' : input('kg', s.kg ?? suggest, 'decimal', 'weight in kilograms')}
      ${input('reps', s.reps, 'numeric', 'reps')}
      ${input('rir', s.rir, 'numeric', 'reps in reserve')}`;
  }).join('');
  const altOpen = ui.altOpen === ex.id;
  return `
    <section class="card lift" id="lift-${ex.id}">
      <span class="card-title">Lift ${ex.n} of ${v.lifts.length}</span>
      ${ex.n <= rules.MIN_EXERCISES ? '<span class="card-tag">Min</span>' : ''}
      <div>
        <div class="lift-name">${esc(ex.name)}</div>
        <div class="small muted">${ex.planned} ${ex.planned === 1 ? 'set' : 'sets'} of ${range(ex.reps)}${ex.per ? ` ${ex.per}` : ''}, rest ${restText(ex.rest)}.${ex.note ? ` ${esc(ex.note)}` : ''}</div>
      </div>
      <div class="set-grid">
        <b>Set</b><b>Last time</b><b>Kg</b><b>Reps</b><b>RIR</b>
        ${rows}
      </div>
      <div class="small muted">RIR is reps left in the tank. Aim for ${range(rir)} today${isoLast && String(rirLast) !== String(rir) ? `, and ${range(rirLast)} on the last set` : ''}.</div>
      ${noteHtml}
      <div class="pair">
        <a class="btn compact" href="${video(ex.name)}" target="_blank" rel="noopener">Form video</a>
        ${ex.alt ? `<button type="button" class="btn compact" data-act="toggle-alt" data-ex="${ex.id}" aria-expanded="${altOpen}">Alternative</button>` : ''}
      </div>
      ${altOpen ? `
        <div class="note">
          <b>If it is busy</b>${esc(ex.alt)}.
          <a class="link" href="${video(ex.alt.split(',')[0])}" target="_blank" rel="noopener">Form video for this</a>
          <label class="tick"><input type="checkbox" data-alt="${ex.id}" ${ex.logged?.alt ? 'checked' : ''}>I did the alternative today</label>
          <span class="small muted">Ticked sets stay out of this lift's history, so the jump rule is not thrown off.</span>
        </div>` : ''}
      <button type="button" class="btn compact" data-act="start-rest" data-sec="${ex.rest[1]}">Start rest, ${clock(ex.rest[1])}</button>
    </section>`;
}

const liftRow = (ex) => `
  <button type="button" class="lift-row" data-act="open-lift" data-ex="${ex.id}">
    <span class="lift-n${ex.complete ? ' done' : ''}">${ex.complete ? TICK : ex.n}</span>
    <span class="lift-text"><b>${esc(ex.name)}</b><small>${ex.planned} x ${range(ex.reps)}, rest ${restText(ex.rest)}</small></span>
    ${ex.n <= rules.MIN_EXERCISES ? '<span class="badge">Min</span>' : ''}
    ${CHEVRON}
  </button>`;

function cardioCard(v) {
  const list = v.c.data.days[v.key]?.cardio ?? [];
  return `
    <form class="card" data-form="cardio" novalidate>
      <span class="card-title">Cardio</span>
      ${list.map((x) => `
        <div class="row cardio-row"><span><b>${esc(x.type)}</b>, ${num(x.minutes)} min</span>
          <button type="button" class="btn compact quiet" data-act="remove-cardio" data-id="${esc(x.id)}">Remove</button></div>`).join('')}
      <div class="field-grid">
        <label class="field"><span>Type</span>
          <select name="type">${CARDIO.map((t) => `<option>${t}</option>`).join('')}</select>
        </label>
        ${field('minutes', 'Minutes', '', { decimal: false })}
      </div>
      <button class="btn compact">Add cardio</button>
      <div class="small muted">Steps come first. On a lifting day, cardio goes after the weights.</div>
    </form>`;
}

export function workoutView() {
  const v = view();
  if (!v) return { title: 'Workout', sub: 'The plan is complete', body: '<section class="card"><div class="muted">Every session in the plan is done.</div></section>' };
  const open = v.lifts.find((l) => l.id === ui.openLift) ?? v.lifts.find((l) => !l.complete) ?? v.lifts[0];
  const body = `
    ${v.isToday ? '' : `<div class="note"><b>Editing a past session</b>${longDate(v.key)}. <button type="button" class="link" data-act="workout-today">Back to today</button></div>`}
    <div class="switch-card">
      <div>
        <b>Minimum session</b>
        <div class="small muted">First ${rules.MIN_EXERCISES} lifts, 2 sets each, about 30 minutes. For bad days and exam weeks. It counts in full.</div>
      </div>
      <button type="button" role="switch" aria-checked="${v.w.minimum}" aria-label="Minimum session" class="switch" data-act="toggle-minimum"><i></i></button>
    </div>
    <div class="rest" id="rest" hidden>
      <span class="small">Rest</span><span class="big" data-rest-time></span>
      <button type="button" class="btn compact" data-act="rest-more">+30 s</button>
      <button type="button" class="btn compact" data-act="rest-skip">Skip</button>
    </div>
    ${v.lifts.map((ex) => (ex.id === open.id ? liftCard(v, ex) : liftRow(ex))).join('')}
    ${v.w.finished
      ? '<div class="note"><b>Session saved</b>You can still change any number above.</div>'
      : `<button type="button" class="btn primary tall" data-act="finish-workout">Finish and save session</button>`}
    ${cardioCard(v)}`;
  return { title: v.session.name, sub: `${v.session.about}${v.phase ? `, ${v.phase.name.toLowerCase()}` : ''}`, body };
}

// ----- Saving -----

// Reads the stored workout for the day on screen, or starts one.
function current() {
  const v = view();
  return { v, w: structuredClone(v.w) };
}
const put = (v, w, quiet = false) => store.setDay(v.key, { workout: w }, quiet);

// A set saves the moment a box is left. It saves quietly so the next box keeps the keyboard.
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset?.lift) {
    const { v, w } = current();
    const ex = v.lifts.find((l) => l.id === t.dataset.lift);
    const lift = w.lifts[ex.id] ??= { sets: [], planned: ex.planned };
    lift.planned = ex.planned;
    const i = Number(t.dataset.set);
    const set = lift.sets[i] ?? {};
    const n = Number(t.value.trim().replace(',', '.'));
    if (t.value.trim() === '' || !Number.isFinite(n) || n < 0) delete set[t.dataset.f];
    else set[t.dataset.f] = n;
    // The weight box may be showing a suggestion that was never typed: keep it with the reps.
    if (t.dataset.f === 'reps' && set.reps > 0 && set.kg == null) {
      const kg = Number(document.querySelector(`[data-lift="${ex.id}"][data-set="${i}"][data-f="kg"]`)?.value.replace(',', '.'));
      if (kg > 0) set.kg = kg;
    }
    lift.sets[i] = set;
    for (let j = 0; j < lift.sets.length; j++) lift.sets[j] ??= {};
    put(v, w, true);
    if (t.dataset.f === 'reps' && set.reps > 0 && v.isToday) startRest(ex.rest[1]);
  } else if (t.dataset?.alt) {
    const { v, w } = current();
    const ex = v.lifts.find((l) => l.id === t.dataset.alt);
    (w.lifts[ex.id] ??= { sets: [], planned: ex.planned }).alt = t.checked;
    put(v, w, true);
  }
});

actions['open-lift'] = (el) => {
  ui.openLift = el.dataset.ex;
  ui.altOpen = null;
  app.redraw();
  document.getElementById(`lift-${el.dataset.ex}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
};
actions['toggle-alt'] = (el) => { ui.altOpen = ui.altOpen === el.dataset.ex ? null : el.dataset.ex; app.redraw(); };
actions['toggle-minimum'] = () => {
  const { v, w } = current();
  w.minimum = !w.minimum;
  ui.wantMinimum = w.minimum;
  ui.openLift = null;
  put(v, w);
};
actions['finish-workout'] = () => {
  const { v, w } = current();
  w.finished = true;
  store.setDay(v.key, { workout: w, session: { type: w.minimum ? 'min' : 'done' } });
  ui.rest = null;
};
actions['workout-today'] = () => { ui.workoutDay = null; ui.openLift = null; app.redraw(); };
// From Today and from the day sheet.
actions['start-workout'] = (el) => {
  ui.workoutDay = el.dataset.day ?? null;
  ui.wantMinimum = el.dataset.minimum === 'true';
  ui.openLift = null;
  document.getElementById('sheet').close();
  if (ui.wantMinimum) {
    const { v, w } = current();
    if (!w.minimum) { w.minimum = true; put(v, w, true); }
  }
  location.hash = 'workout';
};

forms.cardio = (fd) => {
  const minutes = readNumber(fd, 'minutes');
  if (!minutes) return 'Type how many minutes.';
  const v = view();
  const list = v.c.data.days[v.key]?.cardio ?? [];
  store.setDay(v.key, { cardio: [...list, { id: Date.now().toString(36), type: fd.get('type'), minutes: Math.round(minutes) }] });
};
actions['remove-cardio'] = (el) => {
  const v = view();
  store.setDay(v.key, { cardio: (v.c.data.days[v.key]?.cardio ?? []).filter((x) => x.id !== el.dataset.id) });
};

// ----- Rest timer -----
// Counts against the clock, so it is still right after the phone was locked. It cannot buzz
// while the phone is locked: a web app is paused in the background.

function startRest(seconds) {
  ui.rest = { endsAt: Date.now() + seconds * 1000 };
  tick();
}
actions['start-rest'] = (el) => startRest(Number(el.dataset.sec));
actions['rest-more'] = () => { if (ui.rest) { ui.rest.endsAt = Math.max(ui.rest.endsAt, Date.now()) + 30000; tick(); } };
actions['rest-skip'] = () => { ui.rest = null; tick(); };

const OVER_SHOWS_MS = 4000;
function tick() {
  const bar = document.getElementById('rest');
  if (!bar) return;
  const left = ui.rest ? Math.ceil((ui.rest.endsAt - Date.now()) / 1000) : null;
  if (left === null || ui.rest.endsAt + OVER_SHOWS_MS < Date.now()) {
    ui.rest = null;
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  bar.classList.toggle('over', left <= 0);
  bar.querySelector('[data-rest-time]').textContent = left > 0 ? clock(left) : 'Rest over';
}
setInterval(tick, 250);
export const refreshRest = tick;
