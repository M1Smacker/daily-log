// First-run setup and the Settings screen. Both use the same form for your numbers.

import * as rules from './rules.js';
import * as store from './store.js';
import { ctx } from './state.js';
import { esc, num, fmt, shortDate, forms, actions, field, readNumber, openSheet, closeSheet } from './ui.js';
import { plan as basePlan } from './plan.js';
import { VERSION } from './version.js';
import { sessions } from './exercises.js';

function numbersForm(p, button) {
  const t = p?.targets ?? {};
  return `
    <form class="card" data-form="profile" novalidate>
      <span class="card-title">About you</span>
      <div class="field-grid">
        ${field('heightCm', 'Height', p?.heightCm, { unit: 'cm' })}
        ${field('startKg', 'Starting weight', p?.startKg, { unit: 'kg' })}
        ${field('goalKg', 'Goal weight', p?.goalKg, { unit: 'kg' })}
      </div>
      <div class="rule"></div>
      <div class="eyebrow">Daily targets</div>
      <div class="field-grid">
        ${field('kcal', 'Calories', t.kcal, { unit: 'kcal', decimal: false })}
        ${field('protein', 'Protein', t.protein, { unit: 'g', decimal: false })}
        ${field('carbs', 'Carbs', t.carbs, { unit: 'g', decimal: false })}
        ${field('fat', 'Fat', t.fat, { unit: 'g', decimal: false })}
        ${field('fibre', 'Fibre', t.fibre, { unit: 'g', decimal: false })}
        ${field('waterL', 'Water', t.waterMl ? t.waterMl / 1000 : '', { unit: 'L' })}
      </div>
      <div class="small muted">These stay in your own data. They are never part of the app's public code.</div>
      <div class="form-error" role="alert" hidden></div>
      <button class="btn primary">${button}</button>
    </form>`;
}

export const setupBody = () => `
  <div class="muted" style="font-size:16px">A few numbers to set the app up. You can change any of them later in Settings.</div>
  ${numbersForm(null, 'Start')}`;

// When each phase starts, and the goal date. The first phase is the plan's first day and stays put.
function datesForm(c) {
  const { phases, end } = c.plan;
  const moved = end !== basePlan.end || phases.some((p, i) => p.start !== basePlan.phases[i].start);
  const row = (name, label, value) => `
    <label class="field date-row"><span>${label}</span>
      <input name="${name}" type="date" value="${value}" required>
    </label>`;
  return `
    <form class="card" data-form="dates" novalidate>
      <span class="card-title">Plan dates</span>
      <div class="muted" style="font-size:14px">The day each phase starts. A phase runs until the day before the next one starts. To move the diet break over your exams, change its date and the date of the phase after it.</div>
      <div class="field date-row"><span>${phases[0].name}</span><span class="muted">${shortDate(phases[0].start)}, the plan's first day</span></div>
      ${phases.slice(1).map((p, i) => row(`start${i + 1}`, p.name, p.start)).join('')}
      <div class="rule"></div>
      ${row('end', 'Goal date', end)}
      <div class="small muted">The goal date is where the weight line ends. Training carries on past it until the goal is reached.</div>
      <div class="form-error" role="alert" hidden></div>
      <button class="btn">Save dates</button>
      ${moved ? '<button type="button" class="btn quiet" data-act="reset-dates">Put the original dates back</button>' : ''}
    </form>`;
}

export function settingsBody() {
  const c = ctx();
  return `
    ${numbersForm(c.profile, 'Save changes')}
    <form class="card" data-form="rollover" novalidate>
      <span class="card-title">Day rollover</span>
      <label class="field"><span>A new day starts at</span>
        <select name="hour">${[0, 1, 2, 3, 4, 5, 6].map((h) =>
          `<option value="${h}"${h === c.plan.rolloverHour ? ' selected' : ''}>${h === 0 ? 'Midnight' : `${h}:00 am`}</option>`).join('')}</select>
        <small>Anything logged before this counts towards the day before.</small>
      </label>
      <button class="btn">Save</button>
    </form>
    ${datesForm(c)}
    <form class="card" data-form="gym" novalidate>
      <span class="card-title">Your gym</span>
      <label class="field"><span>Dumbbells <i>kg</i></span>
        <input name="dumbbells" type="text" autocomplete="off" value="${esc(c.plan.dumbbells.join(', '))}" required>
        <small>Every dumbbell weight your gym has, with a comma between each. Use a dot for halves, like 7.5. A dumbbell lift goes up to the next weight on this list.</small>
      </label>
      <div class="form-error" role="alert" hidden></div>
      <button class="btn">Save</button>
      ${Object.entries(c.plan.swaps ?? {}).map(([id, s]) => `
        <div class="row cardio-row"><span><b>${esc(s.name)}</b><br><small class="muted">in place of ${esc(LIFTS[id] ?? id)}</small></span>
          <button type="button" class="btn compact quiet" data-act="unswap-lift" data-id="${esc(id)}">Undo</button></div>`).join('')}
      <div class="small muted">To swap a lift your gym does not have, tap it on the Workout screen.</div>
    </form>
    <form class="card" data-form="lookups" novalidate>
      <span class="card-title">Food lookups</span>
      <div class="muted" style="font-size:14px">The Food screen can search the USDA food list for plain foods like fish, fruit and nuts. USDA asks for a free key. <a class="link" href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noopener">Get a key</a></div>
      <label class="field"><span>USDA key</span>
        <input name="usdaKey" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="80" value="${esc(c.plan.usdaKey ?? '')}">
        <small>Kept in your private data, not in the app's public code. It is also in your backup files. A lookup sends USDA the words you searched for and nothing else. A barcode scan sends Open Food Facts the barcode number and nothing else.</small>
      </label>
      <label class="field"><span>Google AI key</span>
        <input name="geminiKey" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="200" value="${esc(c.plan.geminiKey ?? '')}">
        <small>For filling in a food from a photo of its nutrition label. Free from <a class="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>. Kept in your private data like the key above. The photo of the label is sent to Google and nothing else is. On the free plan Google may use it to improve its service.</small>
      </label>
      <div class="form-error" role="alert" hidden></div>
      <button class="btn">Save</button>
    </form>
    <section class="card">
      <span class="card-title">The plan</span>
      <a class="btn" href="#guide">Open the guide</a>
      <div class="small muted">Face and stomach fat cannot be targeted. Both slim down as overall body fat falls.</div>
      <div class="small muted">Nothing in this app is medical advice. If you feel dizzy, unusually tired or your study focus drops, eat at maintenance for a week and see a doctor.</div>
    </section>
    <section class="card">
      <span class="card-title">Account</span>
      ${store.account.cloud ? `
        <div class="muted" style="font-size:14px">Signed in. Your data is in your own private database and on this phone for offline use.</div>
        <label class="field"><span>Your user id</span>
          <input type="text" readonly value="${esc(store.account.user?.uid ?? '')}" aria-label="Your user id">
          <small>The security rules are pinned to this id, so no other account can read or write.</small>
        </label>
        <div class="status" data-sync></div>
        <button type="button" class="btn" data-act="sign-out">Sign out</button>`
      : '<div class="muted" style="font-size:14px">No login is set up yet, so everything is saved on this device only. Use the backup file on the Progress screen to keep a copy.</div>'}
    </section>
    <section class="card">
      <span class="card-title">Phone sign-in</span>
      ${!store.account.cloud ? '<div class="muted" style="font-size:14px">Needs a login to be set up first.</div>'
      : store.account.user?.hasPassword
        ? '<div class="muted" style="font-size:14px">This account has a password. On your phone, sign in with your Google email address and that password.</div>'
        : `<form class="stack" data-form="add-password" novalidate>
            <div class="muted" style="font-size:14px">Google sign-in does not work on an iPhone for this app. Set a password here once, then sign in on the phone with your Google email address and this password. It is the same account and the same data.</div>
            <label class="field"><span>New password</span>
              <input name="password" type="password" autocomplete="new-password" minlength="10" required>
              <small>At least 10 characters. Let your browser or phone save it.</small>
            </label>
            <label class="field"><span>Same password again</span>
              <input name="again" type="password" autocomplete="new-password" required>
            </label>
            <button class="btn primary">Save password</button>
          </form>`}
    </section>
    <section class="card">
      <span class="card-title">Backups</span>
      <div class="muted" style="font-size:14px">The app keeps one copy of everything per day, for the last ${store.account.cloud ? '14 days' : '3 days on this device'}. If something goes wrong, you can go back to any of them.</div>
      <button type="button" class="btn" data-act="show-backups">Show the automatic backups</button>
      <div data-backups></div>
      <div class="rule"></div>
      <label class="field"><span>Restore from a backup file</span>
        <input type="file" accept=".json,application/json" data-backup-file>
        <small>The file saved by "Backup file" on the Progress screen.</small>
      </label>
      <div class="form-error" role="alert" data-backup-msg hidden></div>
    </section>
    <div class="status plain">Version ${VERSION}</div>`;
}

const LIFTS = Object.fromEntries(Object.values(sessions).flat().map((e) => [e.id, e.name]));

// ----- Backups -----

const backupMsg = (text, ok = false) => {
  const box = document.querySelector('[data-backup-msg]');
  if (!box) return;
  box.hidden = false;
  box.classList.toggle('ok', ok);
  box.textContent = text;
};

let offered = []; // the copies last listed, so Restore can find the one that was tapped
let pendingText = null; // the backup waiting for the confirm tap

actions['show-backups'] = async () => {
  const box = document.querySelector('[data-backups]');
  box.innerHTML = '<div class="small muted">Looking.</div>';
  try {
    offered = await store.listBackups();
  } catch {
    box.innerHTML = '';
    return backupMsg('Could not load the backups. Check your connection and try again.');
  }
  box.innerHTML = offered.length ? offered.map((b, i) => `
    <div class="row cardio-row">
      <span><b>${b.id === 'before-restore' ? 'Before the last restore' : esc(fmt(b.id, { weekday: 'short', day: 'numeric', month: 'short' }))}</b><br>
        <small class="muted">${num(b.days)} ${b.days === 1 ? "day" : "days"} logged, ${num(Math.max(1, b.bytes / 1024))} KB</small></span>
      <button type="button" class="btn compact" data-act="ask-restore" data-i="${i}">Restore</button>
    </div>`).join('') : '<div class="small muted">None yet. The first one is made the day after you start using the app.</div>';
};

// Every restore goes through the same confirm sheet, whatever it came from.
function askRestore(text, label) {
  const read = store.readBackup(text);
  if (read.error) return backupMsg(read.error);
  pendingText = text;
  const days = Object.keys(read.data.days).sort();
  openSheet(`
    <div class="sheet-body">
      <div class="card-title">Restore this backup?</div>
      <div class="muted" style="font-size:14px">${esc(label)}: ${num(days.length)} ${days.length === 1 ? "day" : "days"} logged${days.length ? `, from ${esc(days[0])} to ${esc(days.at(-1))}` : ''}.</div>
      <div class="note warn"><b>This replaces everything</b>All food, weights, sessions and settings in the app become what is in this backup. What you have now is kept first as "Before the last restore", so you can come back to it.</div>
      <button type="button" class="btn primary" data-act="do-restore">Restore it</button>
      <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
    </div>`);
}

actions['ask-restore'] = (el) => {
  const b = offered[Number(el.dataset.i)];
  if (b) askRestore(b.json, b.id === 'before-restore' ? 'The copy from before the last restore' : `Automatic backup from ${b.id}`);
};

document.addEventListener('change', async (e) => {
  if (!e.target.matches?.('[data-backup-file]')) return;
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5000000) return backupMsg('That file is too big to be a backup from this app.');
  askRestore(await file.text(), `The file ${file.name}`);
  e.target.value = '';
});

actions['do-restore'] = async () => {
  closeSheet();
  const text = pendingText;
  pendingText = null;
  if (!text) return;
  const result = await store.restore(text);
  backupMsg(result.error ?? 'Restored. Everything in the app is now from that backup.', Boolean(result.ok));
};

forms.profile = (fd, form) => {
  const n = (name) => readNumber(fd, name);
  const profile = {
    heightCm: n('heightCm'), startKg: n('startKg'), goalKg: n('goalKg'),
    targets: {
      kcal: n('kcal'), protein: n('protein'), carbs: n('carbs'), fat: n('fat'), fibre: n('fibre'),
      waterMl: n('waterL') === null ? null : Math.round(n('waterL') * 1000),
    },
  };
  const missing = [profile.heightCm, profile.startKg, profile.goalKg, ...Object.values(profile.targets)].some((v) => !v);
  if (missing) return 'Every box needs a number above zero.';
  const problem = rules.profileProblem(profile);
  if (problem) return problem;

  // Warn once about risky targets or an unsafe pace, then let a second tap save them anyway.
  const warnings = [...rules.targetWarnings(profile.targets), ...rules.paceWarnings(profile.startKg, profile.goalKg, ctx().plan)];
  const seen = warnings.join('|');
  if (warnings.length && form.dataset.warned !== seen) {
    form.dataset.warned = seen;
    form.querySelector('button.primary').textContent = 'Save anyway';
    return warnings.map(esc).join('<br>') + '<br>Tap Save anyway to keep these numbers, or change them.';
  }
  store.setProfile(profile);
  if (location.hash === '#settings') return { done: 'Saved.' };
};

forms.gym = (fd) => {
  const dumbbells = rules.readDumbbells(fd.get('dumbbells'));
  if (!dumbbells) return 'Type at least two weights as numbers, like 5, 7.5, 10.';
  store.setPlan({ dumbbells });
  return { done: 'Saved.' };
};

forms.dates = (fd, form) => {
  const c = ctx();
  const starts = c.plan.phases.map((p, i) => (i ? String(fd.get(`start${i}`)) : c.plan.start));
  const end = String(fd.get('end'));
  const problem = rules.phaseDatesProblem(c.plan, starts, end);
  if (problem) return problem;
  // A longer diet break or an earlier goal date makes the loss faster. Warn once, as the numbers
  // form does, then let a second tap save it. A warning the plan already had is not repeated.
  const pace = (plan) => rules.paceWarnings(c.profile.startKg, c.profile.goalKg, plan).join(' ');
  const seen = pace({ ...c.plan, end, phases: rules.movePhases(c.plan.phases, starts) });
  if (seen && seen !== pace(c.plan) && form.dataset.warned !== seen) {
    form.dataset.warned = seen;
    return `${esc(seen)}<br>Tap Save dates again to keep these dates, or change them.`;
  }
  store.setPlan({ phaseStarts: starts, end });
  return { done: 'Saved. The calendar, the weight line and the workouts follow these dates now.' };
};

// Two taps, so a slip does not undo dates that were set on purpose.
actions['reset-dates'] = (el) => {
  if (el.dataset.sure !== '1') {
    el.dataset.sure = '1';
    el.textContent = 'Tap again to put them back';
    return;
  }
  store.setPlan({ phaseStarts: null, end: null });
};

forms.lookups = (fd) => {
  const usdaKey = String(fd.get('usdaKey')).trim();
  if (usdaKey && !/^[A-Za-z0-9]{20,80}$/.test(usdaKey)) return 'That does not look like a USDA key. It is a long run of letters and numbers.';
  const geminiKey = String(fd.get('geminiKey')).trim();
  // Google has changed the shape of its keys before, so only the obvious slips are refused.
  if (geminiKey && !/^\S{20,200}$/.test(geminiKey)) return 'That does not look like a Google AI key. It is one long run of characters with no spaces. Copy it again from Google AI Studio.';
  store.setPlan({ usdaKey: usdaKey || null, geminiKey: geminiKey || null });
  return { done: `Saved. USDA key: ${usdaKey ? 'yes' : 'none'}. Google AI key: ${geminiKey ? 'yes' : 'none'}.` };
};

forms.rollover = (fd) => {
  store.setPlan({ rolloverHour: Number(fd.get('hour')) });
  return { done: 'Saved.' };
};

forms['add-password'] = async (fd) => {
  const password = String(fd.get('password'));
  if (password.length < 10) return 'Use at least 10 characters.';
  if (password !== String(fd.get('again'))) return 'The two passwords are not the same.';
  const problem = await store.addPassword(password);
  return problem ?? undefined;
};
