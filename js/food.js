// The Food screen: what is left today, pick a saved food, set the amount, add it to a meal.

import * as rules from './rules.js';
import * as store from './store.js';
import { ui, ctx } from './state.js';
import { sheet, esc, num, actions, forms, app, openSheet, field, readNumber } from './ui.js';

const MEALS = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const GRAM_STEP = 10;
const SERVING_STEP = 0.5;
const MAX_AMOUNT = 5000; // grams or servings: anything above is a typo
const MAX_KCAL = 10000;

const amountText = (e) =>
  e.unit === 'g' ? `${num(e.amount)} g` : e.amount === 1 ? esc(e.serving) : `${e.amount} x ${esc(e.serving)}`;
const defaultMeal = (c) => rules.mealFor(rules.localHour(new Date(), c.plan.utcOffsetHours));

function leftToday(c, eaten) {
  const t = c.targets;
  const cell = (value, unit, label, cls = '') => {
    const v = Math.round(value);
    return `<div><div class="big ${cls}">${v < 0 ? `+${num(-v)}` : num(v)}${unit}</div><div class="small muted">${label}${v < 0 ? ' over' : ''}</div></div>`;
  };
  return `
    <section class="card">
      <span class="card-title">Left today</span>
      <div class="left-grid">
        ${cell(t.kcal - eaten.kcal, '', 'kcal')}
        ${cell(t.protein - eaten.protein, ' g', 'protein', 'protein-ink')}
        ${cell(t.carbs - eaten.carbs, ' g', 'carbs')}
        ${cell(t.fat - eaten.fat, ' g', 'fat')}
      </div>
      <a class="link" href="#guide">Not sure what to eat? Sample days and swaps</a>
    </section>`;
}

function picker(c) {
  const chips = c.foods.map((f) => `
    <button type="button" class="chip${f.id === ui.food.id ? ' on' : ''}" data-act="pick-food" data-id="${esc(f.id)}"
      data-name="${esc(f.name.toLowerCase())}">${esc(f.name)}</button>`).join('');
  return `
    <section class="card">
      <span class="card-title">Your foods</span>
      <input class="search" type="search" placeholder="Search your foods" aria-label="Search your foods" value="${esc(ui.food.search)}" data-search>
      <div class="chips">
        ${chips}
        <button type="button" class="chip dashed" data-act="edit-food">New food</button>
      </div>
      <div class="small muted" data-no-match hidden>No saved food matches. Use New food to add it.</div>
    </section>`;
}

const liveCells = (p) => `
  <div><div class="big" data-live="kcal">${num(p.kcal)}</div><div class="small muted">kcal</div></div>
  <div><div class="big protein-ink"><span data-live="protein">${num(p.protein)}</span> g</div><div class="small muted">protein</div></div>
  <div><div class="big"><span data-live="carbs">${num(p.carbs)}</span> g</div><div class="small muted">carbs</div></div>
  <div><div class="big"><span data-live="fat">${num(p.fat)}</span> g</div><div class="small muted">fat</div></div>`;

function addPanel(c) {
  const f = c.foods.find((x) => x.id === ui.food.id);
  if (!f) return '';
  const meal = ui.food.meal ?? defaultMeal(c);
  return `
    <section class="card" id="add-panel">
      <span class="card-title">Add</span>
      <div>
        <div class="food-name">${esc(f.name)}</div>
        <div class="small muted">${esc(f.serving)}: ${num(f.kcal)} kcal, ${num(f.protein)} g protein, ${num(f.carbs)} g carbs, ${num(f.fat)} g fat</div>
      </div>
      <div class="seg" role="group" aria-label="Meal">
        ${Object.entries(MEALS).map(([id, name]) =>
          `<button type="button" data-act="pick-meal" data-meal="${id}" aria-pressed="${id === meal}">${name}</button>`).join('')}
      </div>
      <div class="stepper">
        <span class="muted">${f.byGrams ? 'Amount' : 'Servings'}</span>
        <div>
          <button type="button" class="btn compact narrow" data-act="step-amount" data-dir="-1" aria-label="Less">&minus;</button>
          <input type="text" inputmode="decimal" value="${ui.food.amount}" data-amount aria-label="${f.byGrams ? 'Amount in grams' : 'Number of servings'}">
          ${f.byGrams ? '<span class="muted">g</span>' : ''}
          <button type="button" class="btn compact narrow" data-act="step-amount" data-dir="1" aria-label="More">+</button>
        </div>
      </div>
      <div class="left-grid inset">${liveCells(rules.portion(f, ui.food.amount))}</div>
      <button type="button" class="btn primary" data-act="add-food">Add to ${MEALS[meal].toLowerCase()}</button>
      <button type="button" class="btn quiet" data-act="edit-food" data-id="${esc(f.id)}">Edit this food</button>
    </section>`;
}

function logged(c, eaten) {
  const entries = c.day.food ?? [];
  if (!entries.length) {
    return `<section class="card"><span class="card-title">Logged today</span>
      <div class="muted">Nothing yet. Pick a food above to start the day.</div></section>`;
  }
  const groups = Object.entries(MEALS).map(([id, name]) => {
    const list = entries.filter((e) => e.meal === id);
    if (!list.length) return '';
    const sum = rules.totals(list);
    return `
      <div class="meal">
        <div class="row meal-head"><span>${name}</span><span>${num(sum.kcal)} kcal, ${num(sum.protein)} g protein</span></div>
        ${list.map((e) => `
          <button type="button" class="entry" data-act="open-entry" data-id="${esc(e.id)}">
            <span><b>${esc(e.name)}</b><small>${amountText(e)}</small></span>
            <span class="entry-nums"><b>${num(e.kcal)} kcal</b><small>${num(e.protein)} g protein</small></span>
          </button>`).join('')}
      </div>`;
  }).join('');
  return `
    <section class="card">
      <span class="card-title">Logged today</span>
      ${groups}
      <div class="row total"><span>Total</span><span>${num(eaten.kcal)} kcal, ${num(eaten.protein)} g protein</span></div>
    </section>`;
}

export function foodBody() {
  const c = ctx();
  const eaten = rules.totals(c.day.food ?? []);
  return leftToday(c, eaten) + picker(c) + addPanel(c) + logged(c, eaten);
}

// ----- Picking and adding -----

actions['pick-food'] = (el) => {
  const c = ctx();
  const f = c.foods.find((x) => x.id === el.dataset.id);
  if (!f) return;
  ui.food = { ...ui.food, id: f.id, amount: f.amount ?? (f.byGrams ? f.grams : 1), meal: ui.food.meal ?? defaultMeal(c) };
  app.redraw();
  document.getElementById('add-panel')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
};

actions['pick-meal'] = (el) => { ui.food.meal = el.dataset.meal; app.redraw(); };

actions['step-amount'] = (el) => {
  const f = ctx().foods.find((x) => x.id === ui.food.id);
  if (!f) return;
  const step = f.byGrams ? GRAM_STEP : SERVING_STEP;
  const now = Number(ui.food.amount) || 0;
  ui.food.amount = Math.min(MAX_AMOUNT, Math.max(step, Math.round((now + Number(el.dataset.dir) * step) * 10) / 10));
  app.redraw();
};

// Typing an amount or a search updates the numbers in place, so the keyboard stays up.
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-amount]')) {
    const n = Number(e.target.value.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return;
    ui.food.amount = n;
    const p = rules.portion(ctx().foods.find((x) => x.id === ui.food.id), n);
    for (const el of document.querySelectorAll('[data-live]')) el.textContent = num(p[el.dataset.live]);
  } else if (e.target.matches('[data-search]')) {
    ui.food.search = e.target.value;
    filterChips();
  }
});

export function filterChips() {
  const q = ui.food.search.trim().toLowerCase();
  let shown = 0;
  for (const chip of document.querySelectorAll('.chip[data-name]')) {
    chip.hidden = !chip.dataset.name.includes(q);
    if (!chip.hidden) shown++;
  }
  const none = document.querySelector('[data-no-match]');
  if (none) none.hidden = shown > 0;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

actions['add-food'] = () => {
  const c = ctx();
  const f = c.foods.find((x) => x.id === ui.food.id);
  const amount = Number(ui.food.amount);
  if (!f || !(amount > 0) || amount > MAX_AMOUNT) return;
  const entry = {
    id: newId(), foodId: f.id, name: f.name, serving: f.serving, meal: ui.food.meal ?? defaultMeal(c),
    amount, unit: f.byGrams ? 'g' : 'serving', ...rules.portion(f, amount),
  };
  ui.food = { ...ui.food, id: null, amount: null, search: '' };
  store.setDay(c.key, { food: [...(c.day.food ?? []), entry] });
};

// ----- Editing a logged entry -----

actions['open-entry'] = (el) => {
  const e = (ctx().day.food ?? []).find((x) => x.id === el.dataset.id);
  openSheet(`
    <form class="sheet-body" data-form="entry" data-id="${esc(e.id)}" novalidate>
      <div>
        <div class="card-title">${esc(e.name)}</div>
        <div class="muted" style="font-size:14px">${num(e.kcal)} kcal, ${num(e.protein)} g protein</div>
      </div>
      ${field('amount', e.unit === 'g' ? 'Amount' : 'Servings', e.amount, { unit: e.unit === 'g' ? 'g' : '' })}
      <label class="field"><span>Meal</span>
        <select name="meal">${Object.entries(MEALS).map(([id, name]) => `<option value="${id}"${id === e.meal ? ' selected' : ''}>${name}</option>`).join('')}</select>
      </label>
      <button class="btn primary">Save</button>
      <button type="button" class="btn" data-act="delete-entry" data-id="${esc(e.id)}">Remove from today</button>
      <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
    </form>`);
};

forms.entry = (fd, form) => {
  const c = ctx();
  const amount = readNumber(fd, 'amount');
  if (!amount || amount > MAX_AMOUNT) return 'Type an amount above zero. That one looks too big to be right.';
  const food = (c.day.food ?? []).map((e) => {
    if (e.id !== form.dataset.id) return e;
    // Recalculate from the saved food when it still exists, otherwise scale what was logged.
    const f = c.foods.find((x) => x.id === e.foodId);
    const macros = f && Boolean(f.byGrams) === (e.unit === 'g')
      ? rules.portion(f, amount)
      : rules.portion({ ...e, byGrams: false }, amount / e.amount);
    return { ...e, ...macros, amount, meal: fd.get('meal') };
  });
  store.setDay(c.key, { food });
};

actions['delete-entry'] = (el) => {
  const c = ctx();
  sheet.close();
  store.setDay(c.key, { food: (c.day.food ?? []).filter((e) => e.id !== el.dataset.id) });
};

// ----- Adding or editing a saved food -----

const textField = (name, label, value, hint = '') => `
  <label class="field"><span>${label}</span>
    <input name="${name}" type="text" value="${esc(value ?? '')}" required maxlength="80" autocomplete="off">
    ${hint ? `<small>${hint}</small>` : ''}
  </label>`;

actions['edit-food'] = (el) => {
  const f = ctx().foods.find((x) => x.id === el.dataset.id) ?? {};
  openSheet(`
    <form class="sheet-body" data-form="food" data-id="${esc(f.id ?? '')}" novalidate>
      <div class="card-title">${f.id ? 'Edit food' : 'New food'}</div>
      ${textField('name', 'Name', f.name)}
      ${textField('serving', 'One serving is', f.serving, 'For example "1 plate" or "100 g, from the pack".')}
      <div class="field-grid">
        ${field('kcal', 'Calories', f.kcal, { unit: 'kcal' })}
        ${field('protein', 'Protein', f.protein, { unit: 'g' })}
        ${field('carbs', 'Carbs', f.carbs, { unit: 'g' })}
        ${field('fat', 'Fat', f.fat, { unit: 'g' })}
        ${field('fibre', 'Fibre', f.fibre, { unit: 'g', required: false })}
        ${field('grams', 'Grams in a serving', f.byGrams ? f.grams : '', { unit: 'g', required: false })}
      </div>
      <div class="small muted">Fill in the grams only if you want to log this food by weight.</div>
      <button class="btn primary">Save food</button>
      ${f.id ? `<button type="button" class="btn" data-act="delete-food" data-id="${esc(f.id)}">Remove this food</button>` : ''}
      <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
    </form>`);
};

forms.food = (fd, form) => {
  const name = String(fd.get('name')).trim();
  const serving = String(fd.get('serving')).trim();
  const n = Object.fromEntries(['kcal', 'protein', 'carbs', 'fat', 'fibre', 'grams'].map((k) => [k, readNumber(fd, k)]));
  if (!name || !serving) return 'Give the food a name and say what one serving is.';
  if ([n.kcal, n.protein, n.carbs, n.fat].includes(null)) return 'Calories, protein, carbs and fat all need a number. Use 0 if there is none.';
  if (n.kcal > MAX_KCAL || Math.max(n.protein, n.carbs, n.fat, n.fibre ?? 0) > 1000) return 'One of those numbers is too big to be one serving. Check for a slip.';
  // Calories that are far from what the macros add up to usually mean a typo in one of them.
  const fromMacros = n.protein * 4 + n.carbs * 4 + n.fat * 9;
  if (n.kcal > 50 && (fromMacros > n.kcal * 1.6 || fromMacros < n.kcal * 0.5) && form.dataset.warned !== String(fromMacros)) {
    form.dataset.warned = String(fromMacros);
    return `Those macros add up to about ${Math.round(fromMacros)} kcal, but you typed ${n.kcal}. If that is right, tap Save food again.`;
  }
  const id = form.dataset.id || `my-${newId()}`;
  const food = { id, name, serving, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fibre: n.fibre ?? 0 };
  if (n.grams) Object.assign(food, { byGrams: true, grams: n.grams, amount: n.grams });
  else food.amount = 1;
  // Select it before saving: saving redraws the screen, and the Add panel should open on it.
  ui.food = { ...ui.food, id, amount: food.amount };
  store.setFood(id, food);
};

actions['delete-food'] = (el) => {
  const id = el.dataset.id;
  sheet.close();
  if (ui.food.id === id) ui.food.id = null;
  // A preloaded food cannot be deleted from the code, so it is hidden instead.
  store.setFood(id, id.startsWith('my-') ? null : { id, hidden: true });
};
