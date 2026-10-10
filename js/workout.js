// The Workout screen, built for a phone that stays in the bag:
//   1. On arrival: the session sheet. Every lift on one screen with today's weight. Nothing to tap.
//   2. Afterwards: one tap, "Full session" or "Minimum".
//   3. Then the recap: per lift, every set with its weight and reps, saved with one button.
//      That is what the jump rule sets next time's weights from.
//
// A day's workout is stored as:
//   { session, minimum, finished, rirLo, half, lifts: { [exerciseId]: { sets: [{ kg, reps }], alt, planned, top } } }
// planned is the sets prescribed that day, top the top of the rep range that day. A recap saved
// before sets were logged one by one is { kg, reps, alt, planned, top }, with reps the fewest on
// any set: rules.setsOf reads both.

import * as rules from './rules.js';
import * as store from './store.js';
import { ui, ctx } from './state.js';
import { sessions, withSwaps, altKind, KINDS } from './exercises.js';
import { esc, num, longDate, CHEVRON, actions, forms, app, closeSheet, field, readNumber } from './ui.js';

const CARDIO = ['Easy bike', 'Bike intervals', 'Treadmill walk', 'Other'];
const range = ([a, b], unit = '') => (a === b ? `${a}${unit}` : `${a} to ${b}${unit}`);
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;
const restText = ([a, b]) => (b % 60 === 0 && a % 60 === 0 ? `${range([a / 60, b / 60])} min` : range([a, b], ' s'));
const video = (name) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} form`)}`;

// A lift counts as logged once one set has reps.
export const asSets = rules.setsOf;
export const logged = (lift) => asSets(lift).length > 0;

// Everything the screen needs to know about the workout on one day.
function view() {
  const c = ctx();
  const key = ui.workoutDay ?? c.key;
  const days = rules.schedule(c.plan, c.log, c.key);
  const saved = c.data.days[key]?.workout;
  const sessionId = saved?.session ?? days.find((d) => d.key === key)?.session ?? rules.nextUp(days, c.key)?.session;
  if (!sessions[sessionId]) return null;
  const phase = rules.phaseFor(key, c.plan.phases);
  const mark = c.log[key]?.type;
  const marked = mark === 'done' || mark === 'min';
  const w = saved ?? {
    session: sessionId, minimum: marked ? mark === 'min' : Boolean(ui.wantMinimum), finished: marked,
    rirLo: rules.targetRir(phase, key)[0], half: phase?.load === 'half', lifts: {},
  };
  // A day that was logged before a lift was swapped keeps showing the lift it was done with.
  const all = withSwaps(sessions[sessionId], c.plan.swaps)
    .map((ex, i) => (ex.base && logged(w.lifts?.[ex.base]) && !w.lifts?.[ex.id] ? sessions[sessionId][i] : ex));
  const lifts = (w.minimum ? all.slice(0, rules.MIN_EXERCISES) : all).map((ex, i) => {
    const last = lastTime(c, ex.id, key);
    let p = rules.progression(ex, last, c.plan.dumbbells);
    // A deload keeps the weights where they are, whatever was earned before it.
    if (phase?.load === 'half' && ['jump', 'extra', 'cap'].includes(p.type)) p = { type: 'hold', kg: p.kg, deload: true };
    return {
      ...ex, n: i + 1, last, p,
      planned: rules.setsFor(ex, phase, key, w.minimum) + (extraSet(c, phase, sessionId, ex.base ?? ex.id, w.minimum) ? 1 : 0),
      target: p.type === 'jump' ? p.to : p.kg ?? null,
      entry: w.lifts?.[ex.id],
    };
  });
  return { c, key, isToday: key === c.key, phase, w, lifts, session: c.plan.sessions[sessionId] };
}

// In the Push phase, the two muscles picked as lagging get one more set on their lift.
const extraSet = (c, phase, sessionId, liftId, minimum) => Boolean(phase?.extraSet) && !minimum &&
  (c.plan.pushExtra ?? []).some((m) => c.plan.extraSetChoices[m]?.session === sessionId && c.plan.extraSetChoices[m]?.lift === liftId);

// The last time this lift was done before `key`. Skips days the alternative was used, and
// deload days, which are lighter on purpose and say nothing about what you can lift.
function lastTime(c, id, key) {
  const past = Object.keys(c.data.days).filter((k) => k < key).sort().reverse();
  for (const k of past) {
    const w = c.data.days[k].workout;
    const lift = w?.lifts?.[id];
    if (logged(lift) && !lift.alt && !w.half) {
      return { sets: asSets(lift), planned: lift.planned, rirLo: w.rirLo, top: lift.top };
    }
  }
  return null;
}

// Strength scores for one lift, oldest first, leaving out deload and minimum sessions.
function scores(c, id, key) {
  return Object.keys(c.data.days).filter((k) => k < key).sort()
    .map((k) => c.data.days[k].workout)
    .filter((w) => w && !w.half && !w.minimum && logged(w.lifts?.[id]) && !w.lifts[id].alt)
    .map((w) => rules.bestSet(asSets(w.lifts[id])));
}

// Why today's weight is what it is, in one or two sentences.
function reason(v, ex) {
  const { p } = ex;
  const [lo, hi] = ex.reps;
  const note = (title, text, warn = false) => `<div class="note${warn ? ' warn' : ''}"><b>${title}</b>${text}</div>`;
  let html = '';
  if (p.type === 'start') html = note('First time', 'Pick a weight that leaves 3 or 4 reps in the tank on the first set.');
  else if (p.type === 'body') html = note('Reps only', 'There is no weight to add here. Build up the reps inside the range.');
  else if (p.deload) html = note('Deload', `Same weight as before, ${p.kg} kg. Fewer sets, and stop well short of your limit.`);
  else if (p.type === 'hold') html = note('Same weight', `Stay at ${p.kg} kg. When every set reaches ${ex.last?.top ?? hi} reps, the weight goes up.`);
  else if (p.type === 'jump') html = note('Jump earned', `Last time every set reached the top of the range, so today is ${p.to} kg. Work back up from ${lo} reps.`);
  else if (p.type === 'extra') html = note('Nearly there', `The next step up is ${p.to} kg, a big jump from ${p.kg} kg. Reach ${p.need} reps on every set first.`);
  else if (p.type === 'cap') html = note('Heaviest dumbbell', `You have earned a jump, but ${p.kg} kg is the heaviest dumbbell.${ex.alt ? ` Switch to the alternative so this can keep getting heavier: ${esc(ex.alt)}.` : ''}`);
  // Sets at different weights are judged at one of them. Say which, so the sheet's weight is no surprise.
  if (p.kg && new Set(ex.last?.sets.map((s) => s.kg)).size > 1) {
    html += note('More than one weight last time', `The sheet goes by the weight you did the most sets with, ${p.kg} kg. A heavier set counts as done. A lighter one means the weight stays for now. One weight for every set is easiest to build on.`);
  }
  if (rules.wentBackwards(scores(v.c, ex.id, v.key))) {
    html += note('Two steps back', 'This lift has gone backwards two sessions in a row. Check sleep and food first. If those are fine, take an early deload week.', true);
  }
  return html;
}

// Dumbbell weights are for one dumbbell, barbell weights include the bar.
const unit = (ex) => (ex.kind === 'dumbbell' ? 'kg each' : 'kg');
const targetText = (ex) =>
  ex.kind === 'body' ? ['BW', 'bodyweight']
    : ex.target ? [ex.target, {
      jump: `${unit(ex)}, up from ${ex.p.kg}`,
      extra: `${unit(ex)}, aim for ${ex.p.need} reps`,
      cap: `${unit(ex)}, see the alternative`,
    }[ex.p.type] ?? unit(ex)]
    : ['?', 'find a weight'];

// One lift on the sheet. Tapping it shows the details, but nothing needs tapping.
function sheetRow(v, ex) {
  const open = ui.openLift === ex.id;
  const [big, small] = targetText(ex);
  return `
    <div class="sheet-lift${open ? ' open' : ''}" id="lift-${ex.id}">
      <button type="button" class="sheet-head" data-act="open-lift" data-ex="${ex.id}" aria-expanded="${open}">
        <span class="lift-n">${ex.n}</span>
        <span class="lift-text"><b>${esc(ex.name)}</b><small>${ex.planned} x ${range(ex.reps)}${ex.per ? ` ${ex.per}` : ''}, rest ${restText(ex.rest)}</small></span>
        <span class="target${ex.p.type === 'jump' ? ' up' : ''}"><b>${big}</b><small>${small}</small></span>
      </button>
      ${open ? `
        <div class="unfold${ui.fresh === ex.id ? ' fresh' : ''}"><div class="sheet-more">
          ${ex.note ? `<div class="muted" style="font-size:14px">${esc(ex.note)}</div>` : ''}
          ${ex.last ? `<div class="muted" style="font-size:14px">Last time: ${rules.setsText(ex.last.sets)}.</div>` : ''}
          ${reason(v, ex)}
          ${ex.alt ? `<div class="note"><b>If it is busy</b>${esc(ex.alt)}. <a class="link" href="${video(ex.alt.split(',')[0])}" target="_blank" rel="noopener">Form video for this</a></div>` : ''}
          <div class="pair">
            <a class="btn compact" href="${video(ex.name)}" target="_blank" rel="noopener">Form video</a>
            <button type="button" class="btn compact" data-act="start-rest" data-sec="${ex.rest[1]}">Rest ${clock(ex.rest[1])}</button>
          </div>
          ${swapPart(ex)}
        </div></div>` : ''}
    </div>`;
}

// Swapping a lift the gym does not have, for good. The listed alternative is filled in to start with.
function swapPart(ex) {
  if (ex.base) return `<button type="button" class="link" data-act="unswap-lift" data-id="${ex.base}">Go back to the original lift</button>`;
  const guess = ex.alt.split(',')[0];
  return `
    <details>
      <summary class="link">Your gym does not have this? Swap it</summary>
      <div class="unfold"><form class="stack" data-form="swap-lift" novalidate>
        <input type="hidden" name="id" value="${ex.id}">
        <label class="field"><span>Do this instead</span>
          <input name="name" type="text" maxlength="60" autocomplete="off" value="${esc(guess)}" required>
        </label>
        <label class="field"><span>It uses</span>
          <select name="kind">${Object.entries(KINDS).map(([k, label]) =>
            `<option value="${k}"${k === (guess ? altKind(guess) : ex.kind) ? ' selected' : ''}>${label}</option>`).join('')}</select>
          <small>This sets how the weight goes up. The new lift starts with no history.</small>
        </label>
        <button class="btn compact">Swap from now on</button>
      </form></div>
    </details>`;
}

// One lift in the recap: the weight, and the fewest reps on any set.
// ----- The recap: typed first, saved with the button -----
// What is in the boxes but not saved yet is the draft: { key, lifts: { [id]: { rows: [[kg, reps]], alt } } }.
// It is kept here and on the device, so a redraw, a sync from the other device, or the app being
// closed before Save does not lose what was typed.
const DRAFT_KEY = 'daily-log-recap-draft';
const MAX_SETS = 8;

function draftFor(key) {
  if (ui.recap?.key === key) return ui.recap;
  let kept = null;
  try { kept = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { /* none, or storage blocked */ }
  ui.recap = kept && kept.key === key && kept.lifts && typeof kept.lifts === 'object' ? kept : null;
  return ui.recap;
}
function dropDraft() {
  ui.recap = null;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked */ }
}
// Copies what is in the boxes into the draft.
function keepDraft(form) {
  const lifts = {};
  for (const box of form.querySelectorAll('[data-sets]')) {
    lifts[box.dataset.sets] = {
      rows: [...box.querySelectorAll('[data-f="reps"]')].map((r) => [kgBox(box, r.dataset.set)?.value ?? '', r.value]),
      alt: Boolean(box.closest('.recap-row').querySelector('[data-alt]')?.checked),
    };
  }
  ui.recap = { key: form.dataset.day, lifts };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(ui.recap)); } catch { /* storage blocked: still kept while the app is open */ }
  form.querySelector('[data-unsaved]').hidden = false;
  const said = form.querySelector('.form-error');
  if (said) said.hidden = true; // "Saved" is no longer true
}
const kgBox = (box, i) => box.querySelector(`[data-f="kg"][data-set="${i}"]`);

// The rows to show for one lift: what was typed, or what was saved, or one empty row per planned
// set with the sheet's weight already in it.
function rowsFor(ex, draft) {
  const typedRows = draft?.lifts?.[ex.id]?.rows;
  if (Array.isArray(typedRows) && typedRows.length) {
    return typedRows.slice(0, MAX_SETS).map((r) => [String(r?.[0] ?? ''), String(r?.[1] ?? '')]);
  }
  const saved = asSets(ex.entry);
  return Array.from({ length: Math.max(ex.planned, saved.length) },
    (_, i) => [String(saved[i]?.kg ?? saved.at(-1)?.kg ?? ex.target ?? ''), String(saved[i]?.reps ?? '')]);
}

const setRow = (ex, i, kg, reps) => `
  <span class="set-n">${i + 1}</span>
  ${ex.kind === 'body' ? '' : `<input type="text" inputmode="decimal" autocomplete="off" value="${esc(kg)}" data-f="kg" data-set="${i}" aria-label="${esc(ex.name)}, set ${i + 1}, weight in kg">`}
  <input type="text" inputmode="numeric" autocomplete="off" value="${esc(reps)}" data-f="reps" data-set="${i}" aria-label="${esc(ex.name)}, set ${i + 1}, reps">`;

// One lift in the recap: a line per set, each with its own weight and reps.
function recapRow(ex, draft) {
  const body = ex.kind === 'body';
  const typedLift = draft?.lifts?.[ex.id];
  const alt = typedLift ? Boolean(typedLift.alt) : Boolean(ex.entry?.alt);
  return `
    <div class="recap-row">
      <div class="lift-text"><b>${esc(ex.name)}</b><small>${ex.planned} x ${range(ex.reps)}${ex.target ? `, sheet said ${ex.target} kg` : ''}</small></div>
      <div class="set-grid${body ? ' body' : ''}" data-sets="${ex.id}" data-kind="${ex.kind}">
        <span></span>${body ? '' : `<span class="set-h">${ex.kind === 'dumbbell' ? 'Kg each' : 'Kg'}</span>`}<span class="set-h">Reps</span>
        ${rowsFor(ex, draft).map(([kg, reps], i) => setRow(ex, i, kg, reps)).join('')}
      </div>
      <div class="recap-foot">
        <button type="button" class="link" data-act="add-set">Add a set</button>
        ${ex.alt ? `<label class="tick"><input type="checkbox" data-alt="${ex.id}" ${alt ? 'checked' : ''}>Did the alternative</label>` : ''}
      </div>
    </div>`;
}

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
      <div class="small muted">Steps come first. On a lifting day, cardio goes after the weights.${v.phase?.load === 'ramp' ? ' Bike intervals wait until the Build phase, once lifting feels routine.' : ''}</div>
    </form>`;
}

export function workoutView() {
  const v = view();
  if (!v) return { title: 'Workout', sub: 'The plan is complete', body: '<section class="card"><div class="muted">Every session in the plan is done.</div></section>' };
  const rir = rules.targetRir(v.phase, v.key);
  const past = v.isToday ? '' : `<div class="note"><b>A past session</b>${longDate(v.key)}. <button type="button" class="link" data-act="workout-today">Back to today</button></div>`;
  const rest = `
    <div class="rest-slot${ui.rest ? ' on' : ''}" id="rest">
      <div class="rest-bar">
        <span class="small">Rest</span><span class="big" data-rest-time></span>
        <button type="button" class="btn compact" data-act="rest-more">+30 s</button>
        <button type="button" class="btn compact" data-act="rest-skip">Skip</button>
      </div>
    </div>`;

  const sheetPart = `
    ${past}
    <div class="switch-card">
      <div>
        <b>Minimum session</b>
        <div class="small muted">First ${rules.MIN_EXERCISES} lifts, 2 sets each, about 30 minutes. For bad days and exam weeks. It counts in full.</div>
      </div>
      <button type="button" role="switch" aria-checked="${v.w.minimum}" aria-label="Minimum session" class="switch" data-act="toggle-minimum"><i></i></button>
    </div>
    ${rest}
    ${v.phase?.extraSet && !v.w.minimum ? `
      <div class="card raised">
        <div class="card-title">One extra set this phase</div>
        <div class="muted" style="font-size:14px">Pick the two muscles that are lagging. Each gets one more set a week. The sheet below already counts it.</div>
        <div class="chips">${Object.keys(v.c.plan.extraSetChoices).map((m) =>
          `<button type="button" class="chip${(v.c.plan.pushExtra ?? []).includes(m) ? ' on' : ''}" data-act="pick-extra" data-muscle="${m}" aria-pressed="${(v.c.plan.pushExtra ?? []).includes(m)}">${m}</button>`).join('')}</div>
      </div>` : ''}
    <section class="card sheet-card">
      <span class="card-title">The session</span>
      <span class="card-tag">${v.lifts.length} lifts</span>
      <div class="muted" style="font-size:14px">Effort: leave ${range(rir)} reps in the tank on every set. Read it once, then put the phone away.</div>
      <div>${v.lifts.map((ex) => sheetRow(v, ex)).join('')}</div>
    </section>
    <div class="card raised">
      <div class="card-title">When you are done</div>
      <div class="pair">
        ${v.w.minimum ? '' : '<button type="button" class="btn primary" data-act="finish-workout" data-minimum="false">Full session</button>'}
        <button type="button" class="btn${v.w.minimum ? ' primary' : ''}" data-act="finish-workout" data-minimum="true">Minimum</button>
      </div>
      <div class="small muted">One tap marks the day. The recap after it takes a minute and can wait until you are home.</div>
    </div>`;

  const filledIn = v.lifts.filter((ex) => logged(ex.entry)).length;
  const draft = v.w.finished ? draftFor(v.key) : null;
  const recapPart = `
    ${past}
    <div class="note"><b>${v.w.minimum ? 'Minimum session' : 'Full session'} saved</b>${filledIn === v.lifts.length
      ? 'Recap complete. Next time\'s weights are set from it.'
      : 'The recap below sets next time\'s weights. Fill it in when you can.'}
      <button type="button" class="link" data-act="reopen-workout">Not done after all? Reopen it</button></div>
    <form class="card" data-form="recap" data-day="${v.key}" novalidate>
      <span class="card-title">Recap</span>
      <span class="card-tag">${filledIn} of ${v.lifts.length} saved</span>
      <div class="muted" style="font-size:14px">For each set: the weight you used and the reps you got. Did more sets than the sheet said? Add a set. Leave the reps empty for a set or a lift you skipped.</div>
      <div>${v.lifts.map((ex) => recapRow(ex, draft)).join('')}</div>
      <div class="small warn-ink" data-unsaved ${draft ? '' : 'hidden'}>Not saved yet. <button type="button" class="link" data-act="drop-recap">Throw these changes away</button></div>
      <button class="btn primary">Save recap</button>
      <div class="small muted">Nothing here is saved until you tap Save recap.</div>
    </form>`;

  return {
    title: v.session.name,
    sub: `${v.session.about}${v.phase ? `, ${v.phase.name.toLowerCase()}` : ''}`,
    body: (v.w.finished ? recapPart : sheetPart) + cardioCard(v),
  };
}

// ----- Saving -----

// Reads the stored workout for the day on screen, or starts one.
function current() {
  const v = view();
  return { v, w: structuredClone(v.w) };
}
const put = (v, w, quiet = false) => store.setDay(v.key, { workout: w }, quiet);
const typed = (s) => {
  const n = rules.typedNumber(s);
  return n !== null && n <= 1000 ? n : null;
};

// Typing in the recap only fills the draft. A weight typed into one set carries down to the sets
// after it that still held the same weight, so a change of weight is typed once.
document.addEventListener('focusin', (e) => {
  if (e.target.matches?.('[data-sets] [data-f="kg"]')) e.target.dataset.was = e.target.value;
});
document.addEventListener('input', (e) => {
  const form = e.target.closest?.('[data-form="recap"]');
  if (!form) return;
  const t = e.target;
  if (t.dataset.f === 'kg') {
    const box = t.closest('[data-sets]');
    for (const later of box.querySelectorAll('[data-f="kg"]')) {
      if (Number(later.dataset.set) > Number(t.dataset.set) && later.value === t.dataset.was) later.value = t.value;
    }
    t.dataset.was = t.value;
  }
  keepDraft(form);
});

actions['add-set'] = (el) => {
  const box = el.closest('.recap-row').querySelector('[data-sets]');
  const n = box.querySelectorAll('[data-f="reps"]').length;
  if (n >= MAX_SETS) return;
  const ex = { kind: box.dataset.kind, name: el.closest('.recap-row').querySelector('.lift-text b').textContent };
  // The new set starts at the weight of the one before it.
  box.insertAdjacentHTML('beforeend', setRow(ex, n, kgBox(box, n - 1)?.value ?? '', ''));
  box.querySelector(`[data-f="reps"][data-set="${n}"]`).focus();
  keepDraft(el.closest('form'));
};
actions['drop-recap'] = () => { dropDraft(); app.redraw(); };

forms.recap = (fd, form) => {
  const { v, w } = current();
  const lifts = { ...w.lifts };
  for (const ex of v.lifts) {
    const box = [...form.querySelectorAll('[data-sets]')].find((b) => b.dataset.sets === ex.id);
    if (!box) continue;
    const sets = [];
    for (const r of box.querySelectorAll('[data-f="reps"]')) {
      if (r.value.trim() === '') continue; // a set that was not done
      const at = `${ex.name}, set ${Number(r.dataset.set) + 1}`;
      const reps = typed(r.value);
      if (reps === null || reps < 1 || !Number.isInteger(reps)) return `${esc(at)}: the reps need to be a whole number, 1 or more.`;
      if (ex.kind === 'body') { sets.push({ reps }); continue; }
      const kg = typed(kgBox(box, r.dataset.set)?.value ?? '');
      if (!(kg > 0)) return `${esc(at)}: type the weight you used.`;
      sets.push({ kg, reps });
    }
    const alt = Boolean(box.closest('.recap-row').querySelector('[data-alt]')?.checked);
    if (sets.length) lifts[ex.id] = { sets, planned: ex.planned, top: ex.reps[1], ...(alt ? { alt: true } : {}) };
    else delete lifts[ex.id];
  }
  w.lifts = lifts;
  dropDraft();
  put(v, w);
  return { done: 'Saved. The next sheet sets its weights from this.' };
};

// Two muscles at most. Picking a third drops the oldest pick.
actions['pick-extra'] = (el) => {
  const now = ctx().plan.pushExtra ?? [];
  const m = el.dataset.muscle;
  store.setPlan({ pushExtra: now.includes(m) ? now.filter((x) => x !== m) : [...now, m].slice(-2) });
};
forms['swap-lift'] = (fd) => {
  const name = String(fd.get('name')).trim().slice(0, 60);
  const kind = String(fd.get('kind'));
  if (!name || !KINDS[kind]) return 'Type the name of the lift you will do instead.';
  ui.openLift = null;
  store.setPlan({ swaps: { ...ctx().plan.swaps, [fd.get('id')]: { name, kind } } });
};
actions['unswap-lift'] = (el) => {
  const { [el.dataset.id]: gone, ...swaps } = ctx().plan.swaps ?? {};
  ui.openLift = null;
  store.setPlan({ swaps });
};
actions['open-lift'] = (el) => { ui.openLift = ui.openLift === el.dataset.ex ? null : el.dataset.ex; ui.fresh = ui.openLift; app.redraw(); };
actions['toggle-minimum'] = () => {
  const { v, w } = current();
  w.minimum = !w.minimum;
  ui.wantMinimum = w.minimum;
  ui.openLift = null;
  put(v, w);
};
actions['finish-workout'] = (el) => {
  const { v, w } = current();
  w.minimum = el.dataset.minimum === 'true';
  w.finished = true;
  ui.rest = null;
  ui.openLift = null;
  ui.nextEnter = 'from-right'; // on to the recap
  store.setDay(v.key, { workout: w, session: { type: w.minimum ? 'min' : 'done' } });
  scrollTo(0, 0);
};
actions['reopen-workout'] = () => {
  const { v, w } = current();
  w.finished = false;
  ui.nextEnter = 'from-left'; // back to the sheet
  store.setDay(v.key, { workout: w, session: null });
};
actions['workout-today'] = () => { ui.workoutDay = null; ui.openLift = null; ui.nextEnter = 'from-right'; app.redraw(); };
// From Today and from the day sheet.
actions['start-workout'] = (el) => {
  ui.workoutDay = el.dataset.day ?? null;
  ui.wantMinimum = el.dataset.minimum === 'true';
  ui.openLift = null;
  closeSheet();
  if (ui.wantMinimum) {
    const { v, w } = current();
    if (!w.minimum && !w.finished) { w.minimum = true; put(v, w, true); }
  }
  if (location.hash === '#workout') { ui.nextEnter = 'from-left'; app.redraw(); }
  else location.hash = 'workout';
};

forms.cardio = (fd) => {
  const minutes = readNumber(fd, 'minutes');
  if (!minutes || minutes > 600) return 'Type how many minutes, up to 600.';
  const v = view() ?? { key: ctx().key, c: ctx() };
  const list = v.c.data.days[v.key]?.cardio ?? [];
  const type = CARDIO.includes(fd.get('type')) ? fd.get('type') : 'Other';
  store.setDay(v.key, { cardio: [...list, { id: Date.now().toString(36), type, minutes: Math.round(minutes) }] });
};
actions['remove-cardio'] = (el) => {
  const c = ctx();
  const key = ui.workoutDay ?? c.key;
  store.setDay(key, { cardio: (c.data.days[key]?.cardio ?? []).filter((x) => x.id !== el.dataset.id) });
};

// ----- Rest timer -----
// Optional. Counts against the clock, so it is still right after the phone was locked.
// It cannot buzz while the phone is locked: a web app is paused in the background.

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
    bar.classList.remove('on'); // the last time stays on it while it slides away
    return;
  }
  bar.classList.add('on');
  bar.classList.toggle('over', left <= 0);
  bar.querySelector('[data-rest-time]').textContent = left > 0 ? clock(left) : 'Rest over';
}
setInterval(tick, 250);
export const refreshRest = tick;
