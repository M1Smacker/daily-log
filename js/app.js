// The shell: which screen is showing, the frame around it, and one listener each
// for taps and form saves. The screens themselves live in their own files.

import * as rules from './rules.js';
import * as store from './store.js';
import { ui, ctx } from './state.js';
import { view, sheet, esc, shortDate, longDate, SETTINGS, CHEVRON_RIGHT, BACK, CHEVRON, actions, forms, app, closeSheet } from './ui.js';
import { todayBody } from './today.js';
import { foodBody } from './food.js';
import { setupBody, settingsBody } from './settings.js';
import { workoutView, refreshRest } from './workout.js';
import { progressBody } from './progress.js';
import { topics } from './guide.js';
import { startPwa } from './pwa.js';

// Every screen: glass controls that float at the top, then the page, which animates in.
function frame(c, title, body, { sub, back = false, bare = false } = {}) {
  const phase = rules.phaseFor(c.key, c.plan.phases);
  const pill = phase
    ? `<a class="pill" href="#guide" aria-label="${phase.name}, open the guide">${phase.name}${CHEVRON_RIGHT}</a>`
    : '<span></span>';
  const backBtn = `<a class="icon-btn" href="#today" aria-label="Back to Today">${BACK}</a>`;
  const settings = `<a class="icon-btn" href="#settings" aria-label="Settings">${SETTINGS}</a>`;
  view.innerHTML = `
    ${bare ? '' : `<div class="topbar">${back ? backBtn : pill}${title === 'Settings' ? pill : settings}</div>`}
    <div class="page ${ui.enter}">
      <header class="head">
        <div>
          <div class="date">${sub ?? longDate(c.key)}</div>
          <h1>${title}</h1>
        </div>
      </header>
      ${body}
    </div>`;
}

const topic = (title, body, extra = '', open = false) => `
  <details class="topic"${open ? ' open' : ''}>
    <summary><span>${title}${extra}</span>${CHEVRON}</summary>
    <div class="unfold"><div class="topic-body">${body}</div></div>
  </details>`;

function guideBody(c) {
  const current = rules.phaseFor(c.key, c.plan.phases);
  const phases = c.plan.phases.map((p) => topic(
    p.name,
    `<p>${p.why}</p>
     <dl>
       <dt>Sets</dt><dd>${p.sets}${p.load === 'ramp' && c.plan.rampSets === 3 ? ' You have this phase set to 3 sets on every lift, in Settings.' : ''}</dd>
       <dt>Effort</dt><dd>${p.effort}</dd>
       <dt>Food</dt><dd>${p.food}</dd>
     </dl>`,
    `${p === current ? '<span class="here">You are here</span>' : ''}<span class="when">${shortDate(p.start)} to ${p.end ? shortDate(p.end) : 'goal'}</span>`,
    p === current,
  )).join('');
  const rest = topics.map((g) =>
    `<div class="guide-group">${g.group}</div>` + g.items.map((t) => topic(t.title, t.body)).join('')).join('');
  return `<div class="guide"><div class="guide-group">The phases</div>${phases}${rest}</div>`;
}

// Which side a page comes in from. Tabs slide sideways, Guide and Settings rise up.
const TAB_ORDER = ['today', 'workout', 'food', 'progress'];
function enterFrom(prev, next) {
  const a = TAB_ORDER.indexOf(prev);
  const b = TAB_ORDER.indexOf(next);
  if (b === -1) return 'from-below';
  if (a === -1) return 'from-above';
  return b > a ? 'from-right' : 'from-left';
}

// nav is true when the page changed, false when the same page is just redrawn.
function render(nav = true) {
  const c = ctx();
  const tabs = document.querySelector('.tabs');

  // With a Firebase config, nothing shows until the login has been checked and you are signed in.
  const acc = store.account;
  if (acc.cloud && (!acc.ready || !acc.user)) {
    tabs.hidden = true;
    ui.enter = '';
    const body = !acc.ready
      ? '<div class="muted" style="font-size:16px">Loading your data.</div>'
      : `<div class="muted" style="font-size:16px">Your data is private to your own account. Sign in to open it.</div>
         ${acc.error ? `<div class="form-error" role="alert">${esc(acc.error)}</div>` : ''}
         ${acc.error?.startsWith('Could not load') ? '' : `
           <form class="card" data-form="sign-in" novalidate>
             <span class="card-title">Sign in</span>
             <label class="field"><span>Email</span>
               <input name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" required>
             </label>
             <label class="field"><span>Password</span>
               <input name="password" type="password" autocomplete="current-password" required>
             </label>
             <button class="btn primary">Sign in</button>
           </form>
           <button type="button" class="btn" data-act="sign-in">Sign in with Google</button>
           <div class="small muted">Google sign-in works on a computer. On an iPhone, use the email and password: set the password once in Settings on a computer.</div>`}`;
    frame(c, 'Daily log', body, { sub: acc.ready ? 'Sign in' : 'One moment', bare: true });
    return;
  }

  // Nothing works without your numbers, so the first run is the setup screen and nothing else.
  if (!c.profile) {
    tabs.hidden = true;
    ui.enter = '';
    // No profile on this phone is not the same as no profile at all. Until the server has
    // answered, wait: filling in the setup form now would overwrite the real numbers later.
    if (acc.cloud && !acc.confirmed && !acc.error) {
      frame(c, 'Daily log', '<div class="muted" style="font-size:16px">Loading your data. The first time on a device, this needs a connection.</div>', { sub: 'One moment', bare: true });
      return;
    }
    // If saved data could not be used, say so here: otherwise it looks like a fresh start.
    // The user id is shown here too: it is needed for the security rules before anything can be saved.
    const problem = acc.error
      ? `<div class="note warn"><b>Heads up</b>${esc(acc.error)}${acc.user ? `<br>Your user id: <span data-uid>${esc(acc.user.uid)}</span>` : ''}</div>`
      : '';
    frame(c, 'Welcome', problem + setupBody(), { sub: 'First, your numbers', bare: true });
    return;
  }
  tabs.hidden = false;

  const hash = location.hash.slice(1);
  const tab = ['workout', 'food', 'progress', 'settings', 'guide'].includes(hash) ? hash : 'today';
  // Leaving the Workout tab drops any past session that was open, so it always comes back on today.
  if (nav && tab !== 'workout' && ui.tab === 'workout') ui.workoutDay = null;
  // The same for an earlier day on the Food tab, so food is never logged on the wrong day by accident.
  if (nav && tab !== 'food' && ui.tab === 'food') ui.food.day = null;
  // A tab change comes in from its side. A screen change inside a tab says which side itself.
  ui.enter = nav && ui.tab && ui.tab !== tab ? enterFrom(ui.tab, tab) : (!nav && ui.nextEnter) || '';
  ui.nextEnter = null;
  ui.tab = tab;

  if (tab === 'today') frame(c, 'Today', todayBody());
  else if (tab === 'food') frame(c, 'Food', foodBody());
  else if (tab === 'settings') frame(c, 'Settings', settingsBody(), { sub: 'Your numbers and the plan', back: true });
  else if (tab === 'guide') frame(c, 'Guide', guideBody(c), { sub: 'How the plan works', back: true });
  else if (tab === 'workout') {
    const w = workoutView();
    frame(c, w.title, w.body, { sub: w.sub });
    refreshRest();
  } else frame(c, 'Progress', progressBody(), { sub: `Since ${longDate(c.plan.start)}` });

  // Guide and Settings are not tabs, so nothing is lit for them.
  const index = TAB_ORDER.indexOf(tab);
  [...tabs.querySelectorAll('a')].forEach((a, i) => {
    if (i === index) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (index >= 0) tabs.style.setProperty('--i', index);
  tabs.classList.toggle('none', index < 0);
  paintStatus();
  ui.fresh = null; // the part that just opened has been drawn opening, once
  if (nav) scrollTo(0, 0);
}

app.redraw = () => render(false);
actions['sign-in'] = () => store.signIn();
forms['sign-in'] = async (fd, form) => {
  const email = String(fd.get('email')).trim();
  const password = String(fd.get('password'));
  if (!email || !password) return 'Type your email and your password.';
  const button = form.querySelector('button');
  button.disabled = true;
  const problem = await store.signInEmail(email, password);
  button.disabled = false;
  return problem ?? undefined;
};
actions['sign-out'] = () => store.signOut();

// Where the data is right now, in plain words. Shown at the bottom of Today.
function syncStatus() {
  const acc = store.account;
  if (acc.error) return { text: acc.error, cls: 'warn' };
  if (!acc.cloud) return { text: 'Saved on this device only.', cls: 'warn' };
  return acc.pending
    ? { text: 'Saved on your phone. It syncs when you are online.', cls: 'warn' }
    : { text: 'All synced.', cls: 'ok' };
}
function paintStatus() {
  const el = document.querySelector('[data-sync]');
  if (!el) return;
  const s = syncStatus();
  el.textContent = s.text;
  el.className = `status ${s.cls}`;
}
store.hooks.status = paintStatus;
addEventListener('online', paintStatus);
addEventListener('offline', paintStatus);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) actions[el.dataset.act]?.(el);
});

// A form handler returns nothing when it saved, a string to show as a problem,
// or { done: 'message' } to confirm on a form that stays on screen.
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  let result;
  try {
    result = await forms[form.dataset.form]?.(new FormData(form), form);
  } catch (err) {
    // A fault in a form must not look like a save. Say so, and leave the form open.
    console.error(err);
    result = 'Something went wrong there. Check whether it saved, then try again.';
  }
  if (typeof result === 'string' || result?.done) {
    // Saving redraws the screen, so the message goes on the form that is on screen now.
    const live = form.isConnected ? form : document.querySelector(`[data-form="${form.dataset.form}"]`);
    if (!live) return; // the screen moved on, so there is nowhere to show it
    let box = live.querySelector('.form-error');
    if (!box) {
      box = Object.assign(document.createElement('div'), { className: 'form-error' });
      box.setAttribute('role', 'alert');
      live.querySelector('button.btn').before(box);
    }
    box.hidden = false;
    box.classList.toggle('ok', Boolean(result.done));
    box.innerHTML = result.done ? esc(result.done) : result;
  } else if (sheet.contains(form)) closeSheet();
});

// Tapping the dimmed area around the sheet closes it.
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

// ----- Small motion helpers -----
// A fold-out (a guide topic, a swap form) opens with its height: mark it just before it shows.
document.addEventListener('click', (e) => {
  const details = e.target.closest?.('summary')?.parentElement;
  if (details && !details.open) details.querySelector(':scope > .unfold')?.classList.add('fresh');
});
// Once something has finished opening it is ordinary again, and nothing inside it stays clipped.
document.addEventListener('animationend', (e) => e.target.classList?.remove('fresh'));
// iPhones only show a button as pressed when the page listens for touches.
document.addEventListener('touchstart', () => {}, { passive: true });

// The app stays open in the background for days on a phone. When it comes back to the front,
// or the clock passes the rollover, redraw so "today" is really today. Without this a morning
// weigh-in would land on yesterday.
let shownDay = null;
function refreshIfDayChanged() {
  const key = ctx().key;
  if (shownDay && key !== shownDay) {
    ui.workoutDay = null;
    ui.food.day = null;
    ui.calendarOpen = false;
    render(false);
  }
  shownDay = key;
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfDayChanged(); });
setInterval(refreshIfDayChanged, 30000);

store.init(() => render(false));
addEventListener('hashchange', () => render());
render();
shownDay = ctx().key;
startPwa();
