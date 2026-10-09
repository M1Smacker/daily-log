// The Progress screen: weight against the plan, waist, sessions, phases, the stall check,
// lifts, photo reminders, the week in numbers, and getting your data out.

import * as rules from './rules.js';
import * as store from './store.js';
import { ctx } from './state.js';
import { sessions } from './exercises.js';
import { esc, num, fmt, shortDate, litres, actions, forms, openSheet, field, readNumber } from './ui.js';

const LIFT_NAMES = Object.fromEntries(Object.values(sessions).flat().map((e) => [e.id, e.name]));
const filled = (lift) => (lift?.sets ?? []).filter((s) => s?.reps > 0);
const dayKcal = (d) => rules.totals(d.food ?? []);

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
      <span><i class="swatch dashed"></i>Plan</span>
      <span><i class="swatch solid"></i>7-day average</span>
      <span><i class="key planned"></i>Each weigh-in</span>
    </div>`;
}

function weightCard(c) {
  const avg = rules.weightAverage(c.data.days, c.key);
  const planned = rules.planWeight(c.key, c.plan, c.profile.startKg, c.profile.goalKg);
  const count = [0, 1, 2, 3, 4, 5, 6].filter((i) => c.data.days[rules.addDays(c.key, -i)]?.weightKg).length;
  const diff = avg === null ? null : Math.round((avg - planned) * 10) / 10;
  const versus = diff === null ? `The average needs ${3 - count} more weigh-in${3 - count === 1 ? '' : 's'} this week.`
    : Math.abs(diff) < 0.3 ? `Right on the plan line (${planned} kg).`
    : `${Math.abs(diff)} kg ${diff > 0 ? 'above' : 'below'} the plan line (${planned} kg).`;
  return `
    <section class="card">
      <span class="card-title">Weight</span>
      <span class="card-tag">7-day average</span>
      <div><span class="big huge${avg === null ? ' muted' : ''}">${avg ?? c.profile.startKg} kg</span>${avg === null ? '<span class="muted"> starting weight</span>' : ''}</div>
      <div class="muted" style="font-size:14px">${versus} Goal ${c.profile.goalKg} kg around ${shortDate(c.plan.end)}, at about 0.6 to 0.8 kg a week.</div>
      ${weightChart(c)}
      <div class="small muted">The first week or two usually drops extra water. One weigh-in means little, so read the average.</div>
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
      <span class="big ${latest ? '' : 'muted'}">${latest ? `${c.data.days[latest].waistCm} cm` : 'Not yet'}</span>
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
      <span class="small muted sub">This week${missed ? `, ${missed} missed` : ', nothing missed'}.</span>
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

function stallCard(c) {
  const s = rules.stallCheck(c.data.days, c.key, c.plan.start);
  const atFloor = c.targets.kcal - rules.STALL_CUT_KCAL < rules.KCAL_FLOOR;
  const text = {
    'need-data': ['Needs more weigh-ins', 'It compares weekly averages, so it needs at least three weigh-ins a week for three weeks.'],
    ok: ['On track', `Your average dropped ${s.drop} kg in the last week. Nothing to change.`],
    fast: ['Losing too fast', `Your average dropped ${s.drop} kg in a week. More than 1 kg a week starts to eat muscle, so add ${rules.STALL_CUT_KCAL} kcal a day.`],
    recomp: ['Probably recomposing', 'The scale is flat but your waist is shrinking. That usually means fat is going and muscle is coming. Leave everything alone for another week.'],
    stall: ['Stalled for two weeks', (atFloor
      ? `Your calories are already close to the ${num(rules.KCAL_FLOOR)} kcal floor, so add ${num(rules.STALL_ADD_STEPS)} steps a day.`
      : `Cut ${rules.STALL_CUT_KCAL} kcal a day from carbs or fat, never protein, or add ${num(rules.STALL_ADD_STEPS)} steps a day.`)
      + (s.waistKnown ? '' : ' Measure your waist too: if it is shrinking, you may just be recomposing.')],
  }[s.status];
  return `
    <section class="card">
      <span class="card-title">Stall check</span>
      <div class="note${s.status === 'stall' || s.status === 'fast' ? ' warn' : ''}"><b>${text[0]}</b>${text[1]}</div>
      <div class="small muted">It looks at your 7-day average each week. Flat for two weeks with no waist change is a stall. Losing more than 1 kg a week is too fast.</div>
    </section>`;
}

// ----- Lifts -----

function liftsCard(c) {
  const history = {};
  for (const k of Object.keys(c.data.days).sort()) {
    const w = c.data.days[k].workout;
    for (const [id, lift] of Object.entries(w?.lifts ?? {})) {
      const sets = filled(lift);
      if (!sets.length || lift.alt) continue;
      const top = sets.reduce((a, b) => ((b.kg ?? 0) * (1 + b.reps / 30) > (a.kg ?? 0) * (1 + a.reps / 30) ? b : a));
      (history[id] ??= []).push({ key: k, top, score: rules.bestSet(sets) });
    }
  }
  const rows = Object.entries(history).filter(([, h]) => h.length >= 2).map(([id, h]) => {
    const scores = h.map((x) => x.score);
    const lo = Math.min(...scores), hi = Math.max(...scores);
    const pts = scores.map((s, i) => `${(i / (scores.length - 1)) * 76 + 2},${hi === lo ? 12 : (22 - ((s - lo) / (hi - lo)) * 20).toFixed(1)}`).join(' ');
    const show = (t) => (t.kg ? `${t.kg} x ${t.reps}` : `${t.reps} reps`);
    return `
      <div class="lift-line">
        <span><b>${esc(LIFT_NAMES[id] ?? id)}</b><small>${show(h[0].top)} to ${show(h.at(-1).top)}, ${h.length} sessions</small></span>
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

function weekCard(c) {
  const last7 = [0, 1, 2, 3, 4, 5, 6].map((i) => c.data.days[rules.addDays(c.key, -i)] ?? {});
  const fed = last7.filter((d) => d.food?.length);
  const avg = (list, f) => (list.length ? list.reduce((a, d) => a + f(d), 0) / list.length : null);
  const walked = last7.filter((d) => d.steps != null);
  const cell = (value, label) => `<div><div class="big">${value}</div><div class="small muted">${label}</div></div>`;
  const kcal = avg(fed, (d) => dayKcal(d).kcal);
  const protein = avg(fed, (d) => dayKcal(d).protein);
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
      <div class="small muted">Averages over the days you logged: food on ${fed.length} of 7, steps on ${walked.length} of 7.</div>
    </section>`;
}

const dataCard = `
  <section class="card">
    <span class="card-title">Your data</span>
    <button type="button" class="btn compact" data-act="copy-claude">Copy my data for Claude</button>
    <div class="small muted">Copies your plan and the last two weeks. Paste it into the Claude app and ask anything.</div>
    <div class="pair">
      <button type="button" class="btn compact" data-act="export" data-kind="json">Backup file</button>
      <button type="button" class="btn compact" data-act="export" data-kind="csv">Spreadsheet</button>
    </div>
    <div class="form-error ok" role="status" data-data-msg hidden></div>
  </section>`;

export function progressBody() {
  const c = ctx();
  const days = rules.schedule(c.plan, c.log, c.key);
  return weightCard(c) + `<div class="grid2">${waistCard(c)}${sessionsCard(c, days)}</div>` +
    stallCard(c) + weekCard(c) + liftsCard(c) + phasesCard(c) + photosCard(c) + dataCard;
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
function csv(c) {
  const head = ['date', 'weight_kg', 'waist_cm', 'steps', 'water_l', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'session', 'cardio_min', 'creatine', 'vitamin_d'];
  const rows = Object.keys(c.data.days).sort().map((k) => {
    const d = c.data.days[k];
    const t = dayKcal(d);
    const ate = d.food?.length;
    return rules.csvLine([
      k, d.weightKg, d.waistCm, d.steps, d.waterMl != null ? d.waterMl / 1000 : '',
      ate ? t.kcal : '', ate ? t.protein : '', ate ? t.carbs : '', ate ? t.fat : '', ate ? t.fibre : '',
      d.session ? `${d.workout?.session ?? ''} ${d.session.type}`.trim() : '',
      (d.cardio ?? []).reduce((a, x) => a + x.minutes, 0) || '',
      d.creatine ? 'yes' : '', d.vitaminD ? 'yes' : '',
    ]);
  });
  return [rules.csvLine(head), ...rows].join('\n');
}

actions.export = (el) => {
  const c = ctx();
  if (el.dataset.kind === 'json') download(`daily-log-${c.key}.json`, 'application/json', JSON.stringify(c.data, null, 2));
  else download(`daily-log-${c.key}.csv`, 'text/csv', csv(c));
  say(el.dataset.kind === 'json' ? 'Backup file saved. It holds everything in the app.' : 'Spreadsheet saved, one row per day.');
};

// A plain-text summary to paste into the Claude app.
export function claudeText(c) {
  const p = c.profile, t = p.targets;
  const phase = rules.phaseFor(c.key, c.plan.phases);
  const avg = rules.weightAverage(c.data.days, c.key);
  const lines = [
    'This is data from my own fitness tracker. Please use it to answer my question.',
    '',
    `Today: ${c.key}${phase ? `, ${phase.name}` : ''}. Plan runs ${c.plan.start} to ${c.plan.end}.`,
    `Me: ${p.heightCm} cm, started at ${p.startKg} kg, goal ${p.goalKg} kg.`,
    `Daily targets: ${t.kcal} kcal, ${t.protein} g protein, ${t.carbs} g carbs, ${t.fat} g fat, ${t.fibre} g fibre, ${litres(t.waterMl)} L water.`,
    `Weight: 7-day average ${avg ?? 'not enough weigh-ins yet'} kg, plan line says ${rules.planWeight(c.key, c.plan, p.startKg, p.goalKg)} kg.`,
    `Stall check: ${rules.stallCheck(c.data.days, c.key, c.plan.start).status}.`,
    '',
    'Plan rules: lose about 0.6 to 0.8 kg a week. Four sessions a week in the order Upper A, Lower A, Upper B, Lower B.',
    'Keep a weight until every set hits the top of the rep range, then make the smallest jump. A missed session stays next in line.',
    `Never go below ${rules.KCAL_FLOOR} kcal. If the average is flat for two weeks and the waist is too, cut ${rules.STALL_CUT_KCAL} kcal or add ${rules.STALL_ADD_STEPS} steps.`,
    '',
    'Last 14 days (date, weight kg, kcal, protein g, carbs g, fat g, steps, water L, session):',
  ];
  for (let i = 13; i >= 0; i--) {
    const k = rules.addDays(c.key, -i);
    const d = c.data.days[k];
    if (!d) continue;
    const m = dayKcal(d);
    const ate = d.food?.length;
    lines.push([k, d.weightKg ?? '-', ate ? m.kcal : '-', ate ? m.protein : '-', ate ? m.carbs : '-', ate ? m.fat : '-',
      d.steps ?? '-', d.waterMl != null ? litres(d.waterMl) : '-',
      d.session ? `${d.workout?.session ?? ''} ${d.session.type}${d.session.reason ? ` (${d.session.reason})` : ''}`.trim() : '-'].join(', '));
  }
  const recent = Object.keys(c.data.days).sort().reverse().filter((k) => c.data.days[k].workout).slice(0, 4);
  if (recent.length) lines.push('', 'Recent sessions (lift: kg x reps, reps in reserve):');
  for (const k of recent.reverse()) {
    const w = c.data.days[k].workout;
    lines.push(`${k} ${w.session}${w.minimum ? ' (minimum)' : ''}`);
    for (const [id, lift] of Object.entries(w.lifts)) {
      const sets = filled(lift).map((s) => `${s.kg ?? 'BW'} x ${s.reps}${s.rir != null ? ` @${s.rir}` : ''}`).join(', ');
      if (sets) lines.push(`  ${LIFT_NAMES[id] ?? id}${lift.alt ? ' (alternative used)' : ''}: ${sets}`);
    }
  }
  return lines.join('\n');
}

actions['copy-claude'] = async () => {
  const text = claudeText(ctx());
  try {
    await navigator.clipboard.writeText(text);
    say('Copied. Paste it into the Claude app and ask your question.');
  } catch {
    // Clipboard blocked: show the text so it can be copied by hand.
    openSheet(`<div class="sheet-body"><div class="card-title">Copy this</div>
      <textarea class="copy-box" readonly>${esc(text)}</textarea>
      <button type="button" class="btn quiet" data-act="close-sheet">Close</button></div>`);
  }
};
