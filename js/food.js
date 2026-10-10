// The Food screen. Today is four meals, each with its own Add button. Adding opens one screen:
// search, then Recent, My foods, Meals and Recipes. From there a food can also be made, a recipe
// built from saved foods, or calories typed straight in.
//
// A logged entry is { id, foodId?, name, serving, meal, amount, unit: 'g' | 'serving', kcal, protein, ... }.
// It carries its own numbers, so editing or removing a saved food never changes what was logged.

import * as rules from './rules.js';
import * as store from './store.js';
import { ui, ctx } from './state.js';
import { sheet, esc, num, shortDate, actions, forms, app, openSheet, field, readNumber } from './ui.js';

const MEALS = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snacks', dinner: 'Dinner' };
const LISTS = { recent: 'Recent', mine: 'My foods', meals: 'Meals', recipes: 'Recipes' };
// Where a food's numbers came from. Shown wherever the food is picked.
const SOURCES = {
  usda: 'USDA', off: 'Open Food Facts', web: 'From the web, approximate',
  plan: 'From your plan, approximate', own: 'You typed it',
};
const GRAM_STEP = 10;
const SERVING_STEP = 0.5;
const MAX_AMOUNT = 5000; // grams or servings: anything above is a typo
const MAX_KCAL = 10000;

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const defaultMeal = (c) => rules.mealFor(rules.localHour(new Date(), c.plan.utcOffsetHours));
const meal = (c) => (MEALS[ui.food.meal] ? ui.food.meal : defaultMeal(c));
const amountText = (e) =>
  e.unit === 'g' ? `${num(e.amount)} g` : !e.serving ? 'Typed in' : e.amount === 1 ? esc(e.serving) : `${e.amount} x ${esc(e.serving)}`;
// A number the food does not have is shown as unknown, never as zero.
const grams = (v) => (v == null ? '?' : `${num(v)} g`);
const protein = (p) => (p.protein == null ? 'protein not known' : `${num(p.protein)} g protein`);
const source = (f) => (f.recipe ? 'Your recipe' : SOURCES[f.source] ?? SOURCES[f.id?.startsWith('my-') ? 'own' : 'plan']);
// A food with a known weight per serving can be logged either way. The first unit is the usual one.
const unitsOf = (f) => (!f.grams ? ['serving'] : f.byGrams ? ['g', 'serving'] : ['serving', 'g']);
const startAmount = (f, unit) => (unit === 'g' ? (f.byGrams ? f.amount ?? f.grams : f.grams) : f.byGrams ? 1 : f.amount ?? 1);
const entryFrom = (f, amount, unit, mealId) => ({
  id: newId(), foodId: f.id, name: f.name, serving: f.serving, meal: mealId, amount, unit, ...rules.portionBy(f, amount, unit),
});

// ----- Today: what is left, then the four meals -----

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

const entryRow = (e) => `
  <button type="button" class="entry" data-act="open-entry" data-id="${esc(e.id)}">
    <span><b>${esc(e.name)}</b><small>${amountText(e)}</small></span>
    <span class="entry-nums"><b>${num(e.kcal)} kcal</b><small>${protein(e)}</small></span>
  </button>`;

function mealCard(c, id) {
  const list = (c.day.food ?? []).filter((e) => e.meal === id);
  const sum = rules.totals(list);
  return `
    <section class="card">
      <span class="card-title">${MEALS[id]}</span>
      ${list.length ? `<span class="card-tag">${num(sum.kcal)} kcal, ${num(sum.protein)} g protein</span>` : ''}
      ${list.length ? `<div>${list.map(entryRow).join('')}</div>` : ''}
      <button type="button" class="btn compact" data-act="open-add" data-meal="${id}">Add to ${MEALS[id].toLowerCase()}</button>
    </section>`;
}

// ----- The Add screen -----

const foodRow = (f, last) => {
  const p = last ? rules.portionBy(f, last.amount, last.unit) : f;
  const what = last ? amountText({ ...last, serving: f.serving }) : esc(f.serving);
  return `
    <div class="food-row">
      <button type="button" class="entry" data-act="pick-food" data-id="${esc(f.id)}">
        <span><b>${esc(f.name)}</b><small>${what}</small></span>
        <span class="entry-nums"><b>${num(p.kcal)} kcal</b><small>${protein(p)}</small></span>
      </button>
      ${last && !ui.food.picking ? `<button type="button" class="btn compact narrow" data-act="quick-log" data-id="${esc(f.id)}" aria-label="Add ${esc(f.name)} again">+</button>` : ''}
    </div>`;
};

// The list under the search box. It is redrawn on its own while typing, so the keyboard stays up.
function listHtml(c) {
  const none = (text) => `<div class="muted" style="font-size:14px">${text}</div>`;
  const q = ui.food.search.trim().toLowerCase();
  const byName = [...c.foods].sort((a, b) => a.name.localeCompare(b.name));
  if (q) {
    const hits = byName.filter((f) => f.name.toLowerCase().includes(q));
    return hits.length ? hits.map((f) => foodRow(f)).join('') : none('No saved food matches. Use New food below to add it.');
  }
  const list = ui.food.picking && ['meals', 'recipes'].includes(ui.food.list) ? 'mine' : ui.food.list;
  if (list === 'mine') return byName.map((f) => foodRow(f)).join('');
  if (list === 'recipes') {
    const recipes = byName.filter((f) => f.recipe);
    return recipes.length ? recipes.map((f) => foodRow(f)).join('')
      : none('No recipes yet. A recipe is a dish built from your saved foods, like a pot of daal. Use New recipe below.');
  }
  if (list === 'meals') {
    const past = rules.pastMeals(c.data.days, c.key, meal(c));
    return past.length ? past.map((m) => {
      const sum = rules.totals(m.entries);
      return `
        <div class="food-row">
          <span class="entry as-text"><span><b>${esc(shortDate(m.key))}</b><small>${m.entries.map((e) => esc(e.name)).join(', ')}</small></span>
            <span class="entry-nums"><b>${num(sum.kcal)} kcal</b><small>${num(sum.protein)} g protein</small></span></span>
          <button type="button" class="btn compact" data-act="add-meal" data-key="${m.key}">Add all</button>
        </div>`;
    }).join('') : none(`No earlier ${MEALS[meal(c)].toLowerCase()} in the last two weeks. Once you have logged one, it shows here to add again in one tap.`);
  }
  const recent = rules.recentFoods(c.data.days, c.key)
    .map((r) => [c.foods.find((f) => f.id === r.foodId), r])
    .filter(([f, r]) => f && (r.unit !== 'g' || f.grams));
  return recent.length ? recent.map(([f, r]) => foodRow(f, r)).join('')
    : none('Nothing logged lately. Your saved foods are under My foods.');
}

function addScreen(c) {
  const picking = ui.food.picking;
  const id = meal(c);
  const sum = rules.totals((c.day.food ?? []).filter((e) => e.meal === id));
  const tabs = Object.entries(LISTS).filter(([k]) => !picking || ['recent', 'mine'].includes(k));
  const on = tabs.some(([k]) => k === ui.food.list) ? ui.food.list : 'mine';
  return `
    <div class="add-head">
      <button type="button" class="link" data-act="${picking ? 'recipe-back' : 'close-add'}">${picking ? 'Back to the recipe' : 'Done'}</button>
      <div class="food-name">${picking ? 'Pick an ingredient' : `Add to ${MEALS[id].toLowerCase()}`}</div>
      ${picking ? '' : `<div class="small muted">So far: ${num(sum.kcal)} kcal, ${num(sum.protein)} g protein</div>`}
    </div>
    <input class="search" type="search" placeholder="Search your foods" aria-label="Search your foods" value="${esc(ui.food.search)}" data-search>
    <div class="seg n${tabs.length}" role="group" aria-label="Which list">
      ${tabs.map(([k, name]) => `<button type="button" data-act="pick-list" data-list="${k}" aria-pressed="${k === on}">${name}</button>`).join('')}
    </div>
    <section class="card"><div data-food-list>${listHtml(c)}</div></section>
    ${picking ? '' : `
      <div class="pair">
        <button type="button" class="btn compact" data-act="edit-food">New food</button>
        <button type="button" class="btn compact" data-act="new-recipe">New recipe</button>
      </div>
      <button type="button" class="btn compact" data-act="quick-add">Quick add calories</button>`}`;
}

export function foodBody() {
  const c = ctx();
  if (ui.food.recipe && !ui.food.picking) return recipeScreen(c);
  if (ui.food.adding || ui.food.picking) return addScreen(c);
  const eaten = rules.totals(c.day.food ?? []);
  return leftToday(c, eaten) + Object.keys(MEALS).map((id) => mealCard(c, id)).join('') +
    `<div class="row total"><span>Total</span><span>${num(eaten.kcal)} kcal, ${num(eaten.protein)} g protein</span></div>`;
}

actions['open-add'] = (el) => {
  ui.food = { ...ui.food, meal: el.dataset.meal, adding: true, search: '' };
  app.redraw();
  scrollTo(0, 0);
};
actions['close-add'] = () => { ui.food = { ...ui.food, adding: false, search: '' }; app.redraw(); scrollTo(0, 0); };
actions['pick-list'] = (el) => { ui.food.list = el.dataset.list; ui.food.search = ''; app.redraw(); };

document.addEventListener('input', (e) => {
  if (e.target.matches('[data-search]')) {
    ui.food.search = e.target.value;
    const box = document.querySelector('[data-food-list]');
    if (box) box.innerHTML = listHtml(ctx());
  } else if (e.target.matches('[data-amount]')) {
    const n = Number(e.target.value.replace(',', '.'));
    if (!ui.food.pick || !Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return;
    ui.food.pick.amount = n;
    paintPick();
  } else if (e.target.matches('[data-recipe]') && ui.food.recipe) {
    ui.food.recipe[e.target.dataset.recipe] = e.target.value;
    const per = document.querySelector('[data-recipe-per]');
    if (per) per.innerHTML = recipeSummary(ui.food.recipe);
  }
});

// ----- The amount sheet: one food, how much, which unit -----

const pickedFood = () => ctx().foods.find((f) => f.id === ui.food.pick?.id);

function paintPick() {
  const f = pickedFood();
  if (!f) return;
  const p = rules.portionBy(f, ui.food.pick.amount, ui.food.pick.unit);
  for (const el of sheet.querySelectorAll('[data-live]')) el.textContent = p[el.dataset.live] == null ? '?' : num(p[el.dataset.live]);
}

function openPick() {
  const c = ctx();
  const f = pickedFood();
  if (!f) return;
  const { amount, unit } = ui.food.pick;
  const p = rules.portionBy(f, amount, unit);
  const units = unitsOf(f);
  const cell = (m, label, cls = '') =>
    `<div><div class="big ${cls}"><span data-live="${m}">${p[m] == null ? '?' : num(p[m])}</span>${m === 'kcal' ? '' : ' g'}</div><div class="small muted">${label}</div></div>`;
  openSheet(`
    <div class="sheet-body">
      <div>
        <div class="card-title">${esc(f.name)}</div>
        <div class="muted" style="font-size:14px">${esc(f.serving)}: ${num(f.kcal)} kcal, ${protein(f)}</div>
        <div class="small muted">${source(f)}</div>
      </div>
      ${units.length > 1 ? `
        <div class="seg n2" role="group" aria-label="Unit">
          ${units.map((u) => `<button type="button" data-act="pick-unit" data-unit="${u}" aria-pressed="${u === unit}">${u === 'g' ? 'Grams' : 'Servings'}</button>`).join('')}
        </div>` : ''}
      <div class="stepper">
        <span class="muted">${unit === 'g' ? 'Amount' : 'Servings'}</span>
        <div>
          <button type="button" class="btn compact narrow" data-act="step-amount" data-dir="-1" aria-label="Less">&minus;</button>
          <input type="text" inputmode="decimal" value="${amount}" data-amount aria-label="${unit === 'g' ? 'Amount in grams' : 'Number of servings'}">
          ${unit === 'g' ? '<span class="muted">g</span>' : ''}
          <button type="button" class="btn compact narrow" data-act="step-amount" data-dir="1" aria-label="More">+</button>
        </div>
      </div>
      <div class="left-grid inset">${cell('kcal', 'kcal')}${cell('protein', 'protein', 'protein-ink')}${cell('carbs', 'carbs')}${cell('fat', 'fat')}</div>
      <button type="button" class="btn primary" data-act="add-food">${ui.food.picking ? 'Add to the recipe' : `Add to ${MEALS[meal(c)].toLowerCase()}`}</button>
      <button type="button" class="btn quiet" data-act="edit-food" data-id="${esc(f.id)}">${f.recipe ? 'Edit this recipe' : 'Edit this food'}</button>
      <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
    </div>`);
}

actions['pick-food'] = (el) => {
  const c = ctx();
  const f = c.foods.find((x) => x.id === el.dataset.id);
  if (!f) return;
  // Start from the amount used last time, when there was one.
  const last = rules.recentFoods(c.data.days, c.key).find((r) => r.foodId === f.id && (r.unit !== 'g' || f.grams));
  const unit = last?.unit ?? unitsOf(f)[0];
  ui.food.pick = { id: f.id, unit, amount: last?.amount ?? startAmount(f, unit) };
  openPick();
};
actions['pick-unit'] = (el) => {
  const f = pickedFood();
  if (!f || !unitsOf(f).includes(el.dataset.unit)) return;
  ui.food.pick = { id: f.id, unit: el.dataset.unit, amount: startAmount(f, el.dataset.unit) };
  openPick();
};
actions['step-amount'] = (el) => {
  const pick = ui.food.pick;
  if (!pick) return;
  const step = pick.unit === 'g' ? GRAM_STEP : SERVING_STEP;
  pick.amount = Math.min(MAX_AMOUNT, Math.max(step, Math.round(((Number(pick.amount) || 0) + Number(el.dataset.dir) * step) * 10) / 10));
  sheet.querySelector('[data-amount]').value = pick.amount;
  paintPick();
};

const log = (c, entries) => store.setDay(c.key, { food: [...(c.day.food ?? []), ...entries] });

actions['add-food'] = () => {
  const c = ctx();
  const f = pickedFood();
  const { amount, unit } = ui.food.pick ?? {};
  if (!f || !(amount > 0) || amount > MAX_AMOUNT) return;
  const entry = entryFrom(f, amount, unit, meal(c));
  ui.food.pick = null;
  ui.food.search = '';
  sheet.close();
  if (ui.food.picking) {
    ui.food.recipe.items.push(entry);
    ui.food.picking = false;
    app.redraw();
  } else log(c, [entry]);
};
// The + on a recent food: the same amount as last time, in one tap.
actions['quick-log'] = (el) => {
  const c = ctx();
  const f = c.foods.find((x) => x.id === el.dataset.id);
  const last = rules.recentFoods(c.data.days, c.key).find((r) => r.foodId === el.dataset.id);
  if (f && last) log(c, [entryFrom(f, last.amount, last.unit, meal(c))]);
};
actions['add-meal'] = (el) => {
  const c = ctx();
  const id = meal(c);
  const entries = (c.data.days[el.dataset.key]?.food ?? []).filter((e) => e.meal === id);
  if (entries.length) log(c, entries.map((e) => ({ ...e, id: newId() })));
};

// ----- Quick add: calories typed straight in -----

actions['quick-add'] = () => openSheet(`
  <form class="sheet-body" data-form="quick" novalidate>
    <div>
      <div class="card-title">Quick add</div>
      <div class="muted" style="font-size:14px">For when you know the calories but the food is not saved. Leave protein, carbs or fat empty if you do not know them.</div>
    </div>
    <label class="field"><span>What was it</span>
      <input name="name" type="text" maxlength="80" autocomplete="off" placeholder="Optional">
    </label>
    <div class="field-grid">
      ${field('kcal', 'Calories', '', { unit: 'kcal' })}
      ${field('protein', 'Protein', '', { unit: 'g', required: false })}
      ${field('carbs', 'Carbs', '', { unit: 'g', required: false })}
      ${field('fat', 'Fat', '', { unit: 'g', required: false })}
    </div>
    <button class="btn primary">Add to ${MEALS[meal(ctx())].toLowerCase()}</button>
    <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
  </form>`);

forms.quick = (fd) => {
  const c = ctx();
  const n = Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map((k) => [k, readNumber(fd, k)]));
  if (!n.kcal || n.kcal > MAX_KCAL) return 'Type the calories, as a number above zero.';
  if (Math.max(n.protein ?? 0, n.carbs ?? 0, n.fat ?? 0) > 1000) return 'One of those numbers is too big. Check for a slip.';
  log(c, [{ id: newId(), name: String(fd.get('name')).trim() || 'Quick add', serving: '', meal: meal(c), amount: 1, unit: 'serving', ...n, fibre: null }]);
};

// ----- Editing a logged entry -----

actions['open-entry'] = (el) => {
  const e = (ctx().day.food ?? []).find((x) => x.id === el.dataset.id);
  if (!e) return;
  openSheet(`
    <form class="sheet-body" data-form="entry" data-id="${esc(e.id)}" novalidate>
      <div>
        <div class="card-title">${esc(e.name)}</div>
        <div class="muted" style="font-size:14px">${num(e.kcal)} kcal, ${protein(e)}, ${grams(e.carbs)} carbs, ${grams(e.fat)} fat</div>
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
    // Scale what was logged. The saved food may have been edited since, and this entry is a record.
    return { ...e, ...rules.portionBy(e, amount / e.amount, 'serving'), amount, meal: MEALS[fd.get('meal')] ? fd.get('meal') : e.meal };
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
  if (f.recipe) return openRecipe(f);
  openSheet(`
    <form class="sheet-body" data-form="food" data-id="${esc(f.id ?? '')}" novalidate>
      <div class="card-title">${f.id ? 'Edit food' : 'New food'}</div>
      ${textField('name', 'Name', f.name ?? ui.food.search)}
      ${textField('serving', 'One serving is', f.serving, 'For example "1 plate" or "100 g, from the pack".')}
      <div class="field-grid">
        ${field('kcal', 'Calories', f.kcal, { unit: 'kcal' })}
        ${field('protein', 'Protein', f.protein, { unit: 'g' })}
        ${field('carbs', 'Carbs', f.carbs, { unit: 'g' })}
        ${field('fat', 'Fat', f.fat, { unit: 'g' })}
        ${field('fibre', 'Fibre', f.fibre, { unit: 'g', required: false })}
        ${field('grams', 'Grams in a serving', f.grams, { unit: 'g', required: false })}
      </div>
      <div class="small muted">Fill in the grams if you want to be able to log this food by weight.</div>
      <button class="btn primary">Save food</button>
      ${f.id ? `<button type="button" class="btn" data-act="delete-food" data-id="${esc(f.id)}">Remove this food</button>` : ''}
      <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
    </form>`);
};

forms.food = (fd, form) => {
  const c = ctx();
  const old = c.foods.find((x) => x.id === form.dataset.id);
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
  // Numbers that were changed by hand are yours now, whatever the food started as.
  const food = { id, name, serving, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fibre: n.fibre, amount: 1, source: 'own' };
  // A food that was logged by weight stays that way. A new one with grams can be logged either way.
  if (n.grams) Object.assign(food, { grams: n.grams }, old?.byGrams ? { byGrams: true, amount: old.amount ?? n.grams } : {});
  ui.food.search = '';
  store.setFood(id, food);
  // A new food is nearly always made to be logged right now, so open it once this sheet has closed.
  if (!old && (ui.food.adding || ui.food.picking)) {
    setTimeout(() => { const unit = unitsOf(food)[0]; ui.food.pick = { id, unit, amount: startAmount(food, unit) }; openPick(); }, 0);
  }
};

actions['delete-food'] = (el) => {
  const id = el.dataset.id;
  sheet.close();
  ui.food.pick = null;
  ui.food.recipe = null;
  // A preloaded food cannot be deleted from the code, so it is hidden instead.
  store.setFood(id, id.startsWith('my-') ? null : { id, hidden: true });
};

// ----- Recipes: a dish built from saved foods -----
// Stored as a food whose numbers are for one serving, with the ingredients kept in food.recipe
// so it can be edited later: { servings, potGrams, items: [entries] }.

function openRecipe(f) {
  sheet.close();
  ui.food.pick = null;
  ui.food.recipe = f
    ? { id: f.id, name: f.name, servings: f.recipe.servings, potGrams: f.recipe.potGrams ?? '', items: structuredClone(f.recipe.items) }
    : { id: null, name: '', servings: 1, potGrams: '', items: [] };
  app.redraw();
  scrollTo(0, 0);
}
actions['new-recipe'] = () => openRecipe(null);

const asNumber = (v) => { const n = Number(String(v).trim().replace(',', '.')); return String(v).trim() !== '' && Number.isFinite(n) && n > 0 ? n : null; };

function recipeSummary(r) {
  const servings = asNumber(r.servings);
  if (!r.items.length || !servings) return 'Add the ingredients and say how many servings it makes.';
  const whole = rules.totals(r.items);
  const one = rules.recipeServing(r.items, servings);
  return `Whole dish: ${num(whole.kcal)} kcal. <b>One serving: ${num(one.kcal)} kcal, ${protein(one)}, ${grams(one.carbs)} carbs, ${grams(one.fat)} fat.</b>`;
}

function recipeScreen() {
  const r = ui.food.recipe;
  return `
    <div class="add-head">
      <button type="button" class="link" data-act="close-recipe">Cancel</button>
      <div class="food-name">${r.id ? 'Edit recipe' : 'New recipe'}</div>
    </div>
    <form class="card" data-form="recipe" novalidate>
      <span class="card-title">The dish</span>
      <label class="field"><span>Name</span>
        <input type="text" maxlength="80" autocomplete="off" value="${esc(r.name)}" data-recipe="name" required>
      </label>
      <div class="field-grid">
        <label class="field"><span>Servings it makes</span>
          <input type="text" inputmode="decimal" autocomplete="off" value="${esc(r.servings)}" data-recipe="servings" required>
        </label>
        <label class="field"><span>Cooked weight <i>g</i></span>
          <input type="text" inputmode="decimal" autocomplete="off" value="${esc(r.potGrams)}" data-recipe="potGrams">
        </label>
      </div>
      <div class="small muted">The cooked weight is optional. Weigh the finished dish once and you can log it by grams afterwards.</div>
      <div class="rule"></div>
      <div class="eyebrow">Ingredients</div>
      ${r.items.length ? r.items.map((e, i) => `
        <div class="food-row">
          <span class="entry as-text"><span><b>${esc(e.name)}</b><small>${amountText(e)}</small></span>
            <span class="entry-nums"><b>${num(e.kcal)} kcal</b><small>${protein(e)}</small></span></span>
          <button type="button" class="btn compact quiet" data-act="recipe-remove" data-i="${i}">Remove</button>
        </div>`).join('') : '<div class="muted" style="font-size:14px">None yet. Remember the oil or ghee.</div>'}
      <button type="button" class="btn compact" data-act="recipe-add">Add an ingredient</button>
      <div class="note" data-recipe-per>${recipeSummary(r)}</div>
      <div class="form-error" role="alert" hidden></div>
      <button class="btn primary">Save recipe</button>
      ${r.id ? `<button type="button" class="btn" data-act="delete-food" data-id="${esc(r.id)}">Remove this recipe</button>` : ''}
    </form>`;
}

actions['close-recipe'] = () => { ui.food.recipe = null; ui.food.picking = false; app.redraw(); scrollTo(0, 0); };
actions['recipe-add'] = () => { ui.food.picking = true; ui.food.search = ''; app.redraw(); scrollTo(0, 0); };
actions['recipe-back'] = () => { ui.food.picking = false; ui.food.search = ''; app.redraw(); };
actions['recipe-remove'] = (el) => { ui.food.recipe.items.splice(Number(el.dataset.i), 1); app.redraw(); };

forms.recipe = () => {
  const r = ui.food.recipe;
  const name = String(r.name).trim();
  const servings = asNumber(r.servings);
  const potGrams = asNumber(r.potGrams);
  if (!name) return 'Give the recipe a name.';
  if (!servings || servings > 100) return 'Say how many servings it makes, as a number from 1 to 100.';
  if (!r.items.length) return 'Add at least one ingredient.';
  if (String(r.potGrams).trim() && (!potGrams || potGrams > 50000)) return 'The cooked weight should be in grams, or left empty.';
  const id = r.id ?? `my-${newId()}`;
  const food = {
    id, name, serving: `1 serving of ${servings}`, amount: 1, source: 'own',
    ...rules.recipeServing(r.items, servings),
    recipe: { servings, potGrams, items: r.items },
  };
  if (potGrams) food.grams = Math.round(potGrams / servings);
  ui.food = { ...ui.food, recipe: null, picking: false, list: 'recipes' };
  store.setFood(id, food);
  scrollTo(0, 0);
};
