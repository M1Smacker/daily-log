// The shell: which screen is showing, the frame around it, and one listener each
// for taps and form saves. The screens themselves live in their own files.

import * as rules from './rules.js';
import * as store from './store.js';
import { ui, ctx } from './state.js';
import { view, sheet, esc, shortDate, longDate, SETTINGS, CHEVRON_RIGHT, BACK, CHEVRON, actions, forms, app } from './ui.js';
import { todayBody } from './today.js';
import { foodBody, filterChips } from './food.js';
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
    <div class="topic-body">${body}</div>
  </details>`;

function guideBody(c) {
  const current = rules.phaseFor(c.key, c.plan.phases);
  const phases = c.plan.phases.map((p) => topic(
    p.name,
    `<p>${p.why}</p>
     <dl>
       <dt>Sets</dt><dd>${p.sets}</dd>
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

  // Nothing works without your numbers, so the first run is the setup screen and nothing else.
  if (!c.profile) {
    tabs.hidden = true;
    ui.enter = '';
    frame(c, 'Welcome', setupBody(), { sub: 'First, your numbers', bare: true });
    return;
  }
  tabs.hidden = false;

  const hash = location.hash.slice(1);
  const tab = ['workout', 'food', 'progress', 'settings', 'guide'].includes(hash) ? hash : 'today';
  ui.enter = nav && ui.tab && ui.tab !== tab ? enterFrom(ui.tab, tab) : '';
  ui.tab = tab;

  if (tab === 'today') frame(c, 'Today', todayBody());
  else if (tab === 'food') { frame(c, 'Food', foodBody()); filterChips(); }
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
  if (nav) scrollTo(0, 0);
}

app.redraw = () => render(false);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) actions[el.dataset.act]?.(el);
});

// A form handler returns nothing when it saved, a string to show as a problem,
// or { done: 'message' } to confirm on a form that stays on screen.
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const result = forms[form.dataset.form]?.(new FormData(form), form);
  if (typeof result === 'string' || result?.done) {
    // Saving redraws the screen, so the message goes on the form that is on screen now.
    const live = form.isConnected ? form : document.querySelector(`[data-form="${form.dataset.form}"]`);
    let box = live.querySelector('.form-error');
    if (!box) {
      box = Object.assign(document.createElement('div'), { className: 'form-error' });
      box.setAttribute('role', 'alert');
      live.querySelector('button.btn').before(box);
    }
    box.hidden = false;
    box.classList.toggle('ok', Boolean(result.done));
    box.innerHTML = result.done ? esc(result.done) : result;
  } else if (sheet.contains(form)) sheet.close();
});

// Tapping the dimmed area around the sheet closes it.
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

store.init(() => render(false));
addEventListener('hashchange', () => render());
render();
startPwa();
