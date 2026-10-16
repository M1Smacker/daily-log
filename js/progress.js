// The Progress screen: weight against the plan, waist, sessions, phases, the stall check,
// lifts, photo reminders, the week in numbers, and getting your data out.

import * as rules from './rules.js';
import * as store from './store.js';
import { ctx } from './state.js';
import { sessions } from './exercises.js';
import { logged, asSets } from './workout.js';
import { esc, num, fmt, shortDate, litres, actions, forms, openSheet, field, readNumber } from './ui.js';
import { weekCardHtml, briefingCardHtml, coachForExport } from './coach-ui.js';
import { exportText, csvText } from './export-text.js';
import { dayFacts, isJudgeable } from './coach.js';
import { DAY as COACH_DAY, WEEK as COACH_WEEK } from './coach-constants.js';

const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LIFT_NAMES = Object.fromEntries(Object.values(sessions).flat().map((e) => [e.id, e.name]));
// A swapped lift's id is the original id, then '~', then the new name in lower case.
const liftName = (id) => LIFT_NAMES[id] ?? (id.includes('~') ? id.split('~')[1].replace(/-/g, ' ').replace(/^./, (ch) => ch.toUpperCase()) : id);
const dayKcal = (d) => rules.totals(d.food ?? []);
// A day's food counts towards an average only when enough was logged to judge it: the same rule
// the Coach uses, so the numbers on this screen and the Coach's never disagree.
const countsAsDay = (food) => isJudgeable(dayFacts(food));
const ENOUGH = `at least ${COACH_DAY.judgeMinKcal.toLocaleString('en-GB')} kcal and ${COACH_DAY.judgeMinMeals} meals`;

// ----- Weight -----

function weightChart(c) {
  const { plan, profile, data } = c;
  const W = 320, H = 150, L = 30, R = 8, T = 10, B = 22;
  const span = rules.diffDays(plan.end, plan.start);
  const logged = Object.keys(data.days).filter((k) => data.days[k].weightKg && k >= plan.start && k <= plan.end).sort();
  const all = [profile.startKg, profile.goalKg, ...logged.map((k) => data.days[k].weightKg)];
  const lo = Math.floor(Math.min(...all) - 1);
  const hi = Math.ceil(Math.max(...all) + 1);
  const x = (k) => (L + (rules.diffDays(k, plan.start) / span) * (W - L - R)).toFixed(1);
  const y = (kg) => (T + ((hi - kg) / (hi - lo)) * (H - T - B)).toFixed(1);

  // The plan line only bends where a maintenance phase starts and ends.
  const bends = [plan.start, ...plan.phases.filter((p) => p.maintenance).flatMap((p) => [rules.addDays(p.start, -1), p.end]), plan.end]
    .filter((k) => k >= plan.start && k <= plan.end);
  const planPts = bends.map((k) => `${x(k)},${y(rules.planWeight(k, plan, profile.startKg, profile.goalKg))}`).join(' ');
  const avgPts = logged.map((k) => [k, rules.weightAverage(data.days, k)]).filter(([, a]) => a !== null)
    .map(([k, a]) => `${x(k)},${y(a)}`).join(' ');

  const step = hi - lo > 12 ? 5 : 2;
  let grid = '';
  for (let kg = Math.ceil(lo / step) * step; kg <= hi; kg += step) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(kg)}" y2="${y(kg)}" class="grid"/><text x="${L - 6}" y="${Number(y(kg)) + 4}" text-anchor="end">${kg}</text>`;
  }
  let months = '';
  for (let m = plan.start.slice(0, 7); m <= plan.end.slice(0, 7); ) {
    const first = `${m}-01`;
    if (first > plan.start) months += `<text x="${x(first)}" y="${H - 6}" text-anchor="middle">${fmt(first, { month: 'short' })}</text>`;
    const [yy, mm] = m.split('-').map(Number);
    m = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, '0')}`;
  }
  const label = `Weight chart. The plan goes from ${profile.startKg} kg to ${profile.goalKg} kg by ${shortDate(plan.end)}. ${logged.length} weigh-ins logged.`;
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
      ${grid}${months}
      <polyline points="${planPts}" class="plan-line"/>
      ${logged.map((k) => `<circle cx="${x(k)}" cy="${y(data.days[k].weightKg)}" r="2" class="dot"/>`).join('')}
      ${avgPts ? `<polyline points="${avgPts}" class="avg-line"/>` : ''}
      ${c.key >= plan.start && c.key <= plan.end ? `<line x1="${x(c.key)}" x2="${x(c.key)}" y1="${T}" y2="${H - B}" class="today-line"/>` : ''}
    </svg>
    <div class="legend left">
      <span><i class="swatch dashed"></i>Plan, flat in the diet break</span>
      <span><i class="swatch solid"></i>7-day average</span>
      <span><i class="key planned"></i>Each weigh-in</span>
    </div>`;
}

function weightCard(c) {
  const avg = rules.weightAverage(c.data.days, c.key);
  const planned = rules.planWeight(c.key, c.plan, c.profile.startKg, c.profile.goalKg);
  const count = [0, 1, 2, 3, 4, 5, 6].filter((i) => c.data.days[rules.addDays(c.key, -i)]?.weightKg).length;
  const diff = avg === null ? null : Math.round((avg - planned) * 10) / 10;
  const short = rules.MIN_WEIGH_INS - count;
  const pace = rules.planPace(c.profile.startKg, c.profile.goalKg, c.plan);
  const versus = diff === null ? `The average needs ${short} more weigh-in${short === 1 ? '' : 's'} in the last 7 days.`
    : Math.abs(diff) < 0.3 ? `Right on the plan line (${planned} kg).`
    : `${Math.abs(diff)} kg ${diff > 0 ? 'above' : 'below'} the plan line (${planned} kg).`;
  return `
    <section class="card">
      <span class="card-title">Weight</span>
      <span class="card-tag">7-day average</span>
      <div><span class="big huge${avg === null ? ' muted' : ''}">${avg ?? c.profile.startKg} kg</span>${avg === null ? '<span class="muted"> starting weight</span>' : ''}</div>
      <div class="muted" style="font-size:14px">${versus} Goal ${c.profile.goalKg} kg around ${shortDate(c.plan.end)}${pace ? `, at ${pace.text}` : ''}.</div>
      ${weightChart(c)}
      <div class="small muted">The first week or two usually drops extra water. One weigh-in means little, so read the average. This number needs ${rules.MIN_WEIGH_INS} mornings in 7 days. The Coach's weekly read needs ${COACH_WEEK.weighIns} in the week itself, which is why the two can differ.</div>
    </section>`;
}

// ----- Waist, sessions -----

function waistCard(c) {
  const keys = Object.keys(c.data.days).filter((k) => c.data.days[k].waistCm && k <= c.key).sort();
  const latest = keys.at(-1);
  const first = keys[0];
  const change = latest && first !== latest ? Math.round((c.data.days[latest].waistCm - c.data.days[first].waistCm) * 10) / 10 : null;
  return `
    <section class="card mini">
      <span class="card-title">Waist</span>
      <span class="big ${latest ? '' : 'muted'}">${latest ? `${Number(c.data.days[latest].waistCm)} cm` : 'Not yet'}</span>
      <span class="small muted sub">${latest
        ? `${shortDate(latest)}${change !== null ? `, ${change > 0 ? '+' : ''}${change} cm since the first` : ''}`
        : 'Once a week, at the belly button, after breathing out.'}</span>
      <button type="button" class="btn compact" data-act="open-waist">Add waist</button>
    </section>`;
}

function sessionsCard(c, days) {
  const week = rules.weekStrip(days, c.key, c.plan.weekStartDow);
  const done = week.filter((d) => d.state === 'done' || d.state === 'min').length;
  const planned = week.filter((d) => d.session).length;
  const missed = week.filter((d) => d.state === 'missed').length;
  return `
    <section class="card mini">
      <span class="card-title">Sessions</span>
      <span class="big">${done} of ${Math.max(planned, done)}</span>
      <div class="dots">${Array.from({ length: Math.max(planned, done) }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('')}</div>
      <span class="small muted sub">This week, ${DOW_LONG[c.plan.weekStartDow]} to ${DOW_LONG[(c.plan.weekStartDow + 6) % 7]}${missed ? `, ${missed} missed` : ', nothing missed'}.</span>
    </section>`;
}

// ----- Phases, stall check -----

function phasesCard(c) {
  const current = rules.phaseFor(c.key, c.plan.phases);
  return `
    <section class="card">
      <span class="card-title">Phases</span>
      <div>
        ${c.plan.phases.map((p) => `
          <a class="phase-row${p === current ? ' on' : ''}" href="#guide">
            <i></i><span>${p.name}</span><small>${shortDate(p.start)} to ${p.end ? shortDate(p.end) : 'goal'}</small>
          </a>`).join('')}
      </div>
    </section>`;
}

// ----- Lifts -----

function liftsCard(c) {
  const history = {};
  for (const k of Object.keys(c.data.days).sort()) {
    const w = c.data.days[k].workout;
    for (const [id, lift] of Object.entries(w?.lifts ?? {})) {
      if (!logged(lift) || lift.alt || w.half) continue;
      const sets = asSets(lift);
      // The best set of the day. Bodyweight lifts have no weight, so their line follows the
      // fewest reps on any set.
      const weighted = sets.some((s) => s.kg > 0);
      const best = weighted ? sets.reduce((a, s) => (rules.bestSet([s]) > rules.bestSet([a]) ? s : a)) : { reps: Math.min(...sets.map((s) => s.reps)) };
      (history[id] ??= []).push({ key: k, top: best, score: weighted ? rules.bestSet(sets) : best.reps });
    }
  }
  const rows = Object.entries(history).filter(([, h]) => h.length >= 2).map(([id, h]) => {
    const scores = h.map((x) => x.score);
    const lo = Math.min(...scores), hi = Math.max(...scores);
    const pts = scores.map((s, i) => `${(i / (scores.length - 1)) * 76 + 2},${hi === lo ? 12 : (22 - ((s - lo) / (hi - lo)) * 20).toFixed(1)}`).join(' ');
    const show = (t) => (t.kg ? `${t.kg} x ${t.reps}` : `${t.reps} reps`);
    return `
      <div class="lift-line">
        <span><b>${esc(liftName(id))}</b><small>${show(h[0].top)} to ${show(h.at(-1).top)}, ${h.length} sessions</small></span>
        <svg viewBox="0 0 80 24" width="80" height="24" aria-hidden="true"><polyline points="${pts}" class="avg-line"/></svg>
      </div>`;
  }).join('');
  return `
    <section class="card">
      <span class="card-title">Lifts</span>
      ${rows || '<div class="muted">One line per lift. Each appears after your second session of that lift.</div>'}
    </section>`;
}

// ----- Photos, the week -----

function photosCard(c) {
  const taken = c.day.photos;
  const due = rules.nextPhotoDay(taken ? rules.addDays(c.key, 1) : c.key, c.plan.photos);
  const today = due === c.key;
  return `
    <section class="card">
      <span class="card-title">Progress photos</span>
      <span class="card-tag">${today ? 'Due today' : `Due ${fmt(due, { weekday: 'short', day: 'numeric', month: 'short' })}`}</span>
      <div class="muted" style="font-size:14px">Every 2 weeks: front, side and back, in the same light and the same spot.</div>
      <div class="note">The photos stay in your phone's locked album. This app only reminds you and never stores them.</div>
      ${today ? '<button type="button" class="btn compact" data-act="photos-taken">I took them</button>' : ''}
    </section>`;
}

// One line per plan week, newest first. Plain numbers with no colours: it is a record, not a score.
function weeksTable(c, days) {
  const list = rules.weeks(c.data.days, days, c.key, c.plan.weekStartDow, c.plan.start, 6, countsAsDay);
  if (!list.length) return '';
  const change = (w) => (w.change === null ? '-' : `${w.change > 0 ? '+' : ''}${w.change} kg`);
  return `
    <div class="rule"></div>
    <div class="eyebrow">Week by week</div>
    <table class="weeks">
      <thead><tr><th scope="col">Week from</th><th scope="col">Kcal</th><th scope="col">Protein</th><th scope="col">Gym</th><th scope="col">Weight</th></tr></thead>
      <tbody>${list.map((w) => `
        <tr>
          <th scope="row">${w.running ? 'This week' : shortDate(w.first)}<small>${w.foodDays} ${w.foodDays === 1 ? 'day' : 'days'} counted</small></th>
          <td>${w.kcal === null ? '-' : num(w.kcal)}</td>
          <td>${w.protein === null ? '-' : `${num(w.protein)} g`}</td>
          <td>${w.done} of ${w.planned}</td>
          <td>${change(w)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="small muted">Weeks run ${fmt(list[0].first, { weekday: 'long' })} to ${fmt(list[0].last, { weekday: 'long' })}. Kcal and protein are a day's average over the finished days with enough logged to count (${ENOUGH}), against targets of ${num(c.targets.kcal)} kcal and ${num(c.targets.protein)} g. Weight is how far your 7-day average moved in the week.</div>`;
}

function weekCard(c, days) {
  const last7 = [0, 1, 2, 3, 4, 5, 6].map((i) => c.data.days[rules.addDays(c.key, -i)] ?? {});
  // Food is averaged over the seven finished days before today, and only the ones with enough
  // logged: today is still being eaten, and a half-logged day would drag the average down.
  const fed = [1, 2, 3, 4, 5, 6, 7].map((i) => c.data.days[rules.addDays(c.key, -i)] ?? {}).filter((d) => d.food?.length && countsAsDay(d.food));
  const withProtein = fed.filter((d) => !rules.unknownIn(d.food).includes('protein'));
  const avg = (list, f) => (list.length ? list.reduce((a, d) => a + f(d), 0) / list.length : null);
  const walked = last7.filter((d) => d.steps != null);
  const cell = (value, label) => `<div><div class="big">${value}</div><div class="small muted">${label}</div></div>`;
  const kcal = avg(fed, (d) => dayKcal(d).kcal);
  const protein = avg(withProtein, (d) => dayKcal(d).protein);
  const steps = avg(walked, (d) => d.steps);
  return `
    <section class="card">
      <span class="card-title">Last 7 days</span>
      <div class="left-grid">
        ${cell(kcal === null ? '-' : num(kcal), 'kcal a day')}
        ${cell(protein === null ? '-' : `${num(protein)} g`, 'protein')}
        ${cell(steps === null ? '-' : num(steps), 'steps')}
        ${cell(last7.filter((d) => d.session?.type === 'done' || d.session?.type === 'min').length, 'sessions')}
      </div>
      <div class="small muted">Food is averaged over the finished days with enough logged (${ENOUGH}): ${fed.length} of the last 7. Steps were logged on ${walked.length} of 7.</div>
      ${weeksTable(c, days)}
    </section>`;
}

// When a backup file was last saved from this device, as a short phrase.
function lastExport() {
  let at = null;
  try { at = localStorage.getItem('daily-log-last-export'); } catch { /* storage blocked */ }
  if (!at) return 'You have not saved a backup file from this device yet.';
  const days = rules.diffDays(new Date().toISOString().slice(0, 10), at);
  return `Last backup file: ${days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.${days > 14 ? ' Worth saving a fresh one.' : ''}`;
}

const dataCard = () => `
  <section class="card">
    <span class="card-title">Your data</span>
    <div class="pair">
      <button type="button" class="btn compact" data-act="copy-claude">Copy everything for Claude</button>
      <button type="button" class="btn compact" data-act="copy-claude-short">Copy a short version</button>
    </div>
    <div class="small muted">Everything: how complete your log is, your plan, what the Coach says in full sentences, every day of the last two weeks (a day with nothing logged says so), every weigh-in, all weeks, and each lift first against latest. The short version is the first part and the days. Paste it into the Claude app and ask anything.</div>
    <div class="pair">
      <button type="button" class="btn compact" data-act="export" data-kind="json">Backup file</button>
      <button type="button" class="btn compact" data-act="export" data-kind="csv">Spreadsheet</button>
    </div>
    <div class="small muted">${lastExport()} A file kept in your phone's Files or iCloud survives even if the account is lost. Restore it from Settings.</div>
    <div class="form-error ok" role="status" data-data-msg hidden></div>
  </section>`;

export function progressBody() {
  const c = ctx();
  const days = rules.schedule(c.plan, c.log, c.key);
  return weightCard(c) + `<div class="grid2">${waistCard(c)}${sessionsCard(c, days)}</div>` +
    briefingCardHtml(c) + weekCardHtml(c) + weekCard(c, days) + liftsCard(c) + phasesCard(c) + photosCard(c) + dataCard();
}

// ----- Handlers -----

actions['open-waist'] = () => openSheet(`
  <form class="sheet-body" data-form="waist" novalidate>
    <div>
      <div class="card-title">Waist</div>
      <div class="muted" style="font-size:14px">Same morning each week, at the belly button, relaxed, after breathing out.</div>
    </div>
    ${field('value', 'Waist', ctx().day.waistCm, { unit: 'cm' })}
    <button class="btn primary">Save</button>
    <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
  </form>`);

forms.waist = (fd) => {
  const n = readNumber(fd, 'value');
  if (n === null || n < 40 || n > 200) return 'Type your waist in centimetres, for example 94.5.';
  store.setDay(ctx().key, { waistCm: Math.round(n * 10) / 10 });
};

actions['photos-taken'] = () => store.setDay(ctx().key, { photos: true });

const say = (text) => {
  const box = document.querySelector('[data-data-msg]');
  if (box) { box.hidden = false; box.textContent = text; }
};

function download(name, type, text) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// One row per day that has anything logged.

actions.export = (el) => {
  const c = ctx();
  if (el.dataset.kind === 'json') {
    download(`daily-log-${c.key}.json`, 'application/json', JSON.stringify(c.data, null, 2));
    try { localStorage.setItem('daily-log-last-export', new Date().toISOString().slice(0, 10)); } catch { /* storage blocked */ }
  }
  else download(`daily-log-${c.key}.csv`, 'text/csv', csvText(c));
  say(el.dataset.kind === 'json' ? 'Backup file saved. It holds everything in the app.' : 'Spreadsheet saved, one row per day.');
};

// "Copy my data for Claude": the text is built in export-text.js from what the Coach worked out.
// full: false is the short version, for a quick question.
export const claudeText = (c, full = true) => exportText(c, coachForExport(c), { full });

for (const [act, full] of [['copy-claude', true], ['copy-claude-short', false]]) {
  actions[act] = async () => {
    const text = claudeText(ctx(), full);
    try {
      await navigator.clipboard.writeText(text);
      say(full ? 'Copied everything. Paste it into the Claude app and ask your question.' : 'Copied the short version. Paste it into the Claude app and ask your question.');
    } catch {
      // Clipboard blocked: show the text so it can be copied by hand.
      openSheet(`<div class="sheet-body"><div class="card-title">Copy this</div>
        <textarea class="copy-box" readonly>${esc(text)}</textarea>
        <button type="button" class="btn quiet" data-act="close-sheet">Close</button></div>`);
    }
  };
}
