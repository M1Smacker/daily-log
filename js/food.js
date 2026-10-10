// The Food screen. Today is four meals, each with its own Add button. Adding opens one screen:
// search, then Recent, My foods, Meals and Recipes. From there a food can also be made, a recipe
// built from saved foods, or calories typed straight in.
//
// A logged entry is { id, foodId?, name, serving, meal, amount, unit: 'g' | 'serving', kcal, protein, ... }.
// It carries its own numbers, so editing or removing a saved food never changes what was logged.

import * as rules from './rules.js';
import * as store from './store.js';
import { ui, ctx as appCtx } from './state.js';
import { sheet, esc, num, shortDate, longDate, actions, forms, app, openSheet, field, readNumber } from './ui.js';
import * as lookup from './lookup.js';
import { foods as preloaded } from './foods.js';

// The Food screen can show an earlier day (ui.food.day), for a meal that was forgotten.
// Everything below reads and saves through this, so `key` and `day` are the day on screen
// and `today` is the real one.
const ctx = () => {
  const c = appCtx();
  const key = ui.food.day && ui.food.day < c.key ? ui.food.day : c.key;
  return { ...c, today: c.key, key, day: c.data.days[key] ?? {} };
};

const MEALS = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snacks', dinner: 'Dinner' };
const LISTS = { recent: 'Recent', mine: 'My foods', meals: 'Meals', recipes: 'Recipes' };
// Where a food's numbers came from. Shown wherever the food is picked.
const SOURCES = {
  usda: 'USDA', off: 'Open Food Facts', web: 'From the web, approximate',
  plan: 'From your plan, approximate', own: 'You typed it', label: 'Read from the pack, checked by you',
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
      <span class="card-title">${c.key === c.today ? 'Left today' : 'Left that day'}</span>
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
    return (hits.length ? hits.map((f) => foodRow(f)).join('') : none('No saved food matches. Use New food below to add it.')) + lookupHtml(c, q);
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

// Under the search results: looking the same words up outside the app.
// ui.food.found holds the last lookup: { q, loading, error, foods }.
function lookupHtml(c, q) {
  if (q.length < 2) return '';
  const found = ui.food.found?.q === q ? ui.food.found : null;
  const button = c.plan.usdaKey
    ? `<button type="button" class="btn compact" data-act="usda-search">Search USDA for "${esc(q)}"</button>`
    : '<div class="small muted">To search the USDA food list as well, add your free key in Settings.</div>';
  if (!found) return `<div class="lookup">${button}</div>`;
  if (found.loading) return '<div class="lookup"><div class="small muted">Looking.</div></div>';
  if (found.error) return `<div class="lookup"><div class="form-error" role="alert">${esc(found.error)}</div>${button}</div>`;
  return `<div class="lookup"><div class="eyebrow">From USDA, per 100 g</div>${found.foods.length
    ? found.foods.map((f, i) => `
      <div class="food-row">
        <button type="button" class="entry" data-act="pick-found" data-i="${i}">
          <span><b>${esc(f.name)}</b><small>100 g</small></span>
          <span class="entry-nums"><b>${num(f.kcal)} kcal</b><small>${protein(f)}</small></span>
        </button>
      </div>`).join('')
    : '<div class="small muted">USDA has nothing under those words. Try a plainer name, like "salmon" or "almonds".</div>'}</div>`;
}

const repaintList = () => { const box = document.querySelector('[data-food-list]'); if (box) box.innerHTML = listHtml(ctx()); };

actions['usda-search'] = async () => {
  const c = ctx();
  const q = ui.food.search.trim().toLowerCase();
  if (q.length < 2 || !c.plan.usdaKey) return;
  ui.food.found = { q, loading: true };
  repaintList();
  try {
    ui.food.found = { q, foods: await lookup.searchUsda(q, c.plan.usdaKey, c.key) };
  } catch (e) {
    ui.food.found = { q, error: e.message };
  }
  repaintList();
};

// A food picked from a lookup is saved to My foods, so it is there next time without the internet.
actions['pick-found'] = (el) => {
  const f = ui.food.found?.foods?.[Number(el.dataset.i)];
  if (!f) return;
  ui.food.pick = { id: f.id, unit: 'g', amount: f.amount };
  ui.food.search = '';
  if (!ctx().foods.some((x) => x.id === f.id)) store.setFood(f.id, f);
  else app.redraw();
  openPick();
};

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
      ${picking ? '' : `<div class="small muted">${c.key === c.today ? '' : `${longDate(c.key)}. `}So far: ${num(sum.kcal)} kcal, ${num(sum.protein)} g protein</div>`}
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
      <div class="pair">
        <button type="button" class="btn compact" data-act="scan">Scan a barcode</button>
        <button type="button" class="btn compact" data-act="quick-add">Quick add</button>
      </div>`}`;
}

export function foodBody() {
  const c = ctx();
  if (ui.food.recipe && !ui.food.picking) return recipeScreen(c);
  if (ui.food.adding || ui.food.picking) return addScreen(c);
  const eaten = rules.totals(c.day.food ?? []);
  return dayNav(c) + leftToday(c, eaten) + Object.keys(MEALS).map((id) => mealCard(c, id)).join('') +
    `<div class="row total"><span>Total</span><span>${num(eaten.kcal)} kcal, ${num(eaten.protein)} g protein</span></div>`;
}

// Step back to an earlier day and forward again, never past today.
function dayNav(c) {
  const past = c.key !== c.today;
  return `
    <div class="day-nav">
      <button type="button" class="btn compact narrow" data-act="food-day" data-dir="-1" aria-label="The day before">&lsaquo;</button>
      <b>${past ? longDate(c.key) : 'Today'}</b>
      <button type="button" class="btn compact narrow" data-act="food-day" data-dir="1" aria-label="The day after" ${past ? '' : 'disabled'}>&rsaquo;</button>
    </div>
    ${past ? '<div class="note warn"><b>An earlier day</b>Anything you add or change here goes on this day, not today. <button type="button" class="link" data-act="food-today">Back to today</button></div>' : ''}`;
}
actions['food-day'] = (el) => {
  const c = ctx();
  const next = rules.addDays(c.key, Number(el.dataset.dir));
  ui.food.day = next >= c.today ? null : next;
  app.redraw();
};
actions['food-today'] = () => { ui.food.day = null; app.redraw(); };

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
    repaintList();
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

// Sugar, saturated fat and salt, for foods that came with them. Shown, never counted.
const EXTRA = { sugar: 'sugar', satFat: 'saturated fat', salt: 'salt' };
const extraText = (f) => {
  const parts = Object.entries(EXTRA).filter(([k]) => f.extra?.[k] != null).map(([k, label]) => `${label} ${f.extra[k]} g`);
  return parts.length ? `. In ${esc(f.serving.split(',')[0])}: ${parts.join(', ')}` : '';
};

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
        <div class="small muted">${source(f)}${extraText(f)}</div>
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
      <button type="button" class="btn quiet" data-act="delete-food" data-id="${esc(f.id)}">Remove from My foods</button>
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

// ----- Barcodes: the camera, or the number typed in -----
// Your own foods are checked first, so a product you have saved is found without the internet.

let stream = null; // the running camera, so it can be stopped
let scanner = null; // the barcode reader, made the first time it is needed
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const SCAN_EVERY_MS = 60; // a pause between looks, so taps and typing are never held up
// The back camera at full HD. A barcode can then be read from far enough away to stay in focus.
const CAMERA = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } };

const loadScript = (src) => new Promise((ok, fail) => {
  document.head.append(Object.assign(document.createElement('script'), { src, onload: ok, onerror: fail }));
});
// The phone's own reader when it has one. Otherwise ZXing-C++, compiled to run in the browser:
// the same engine behind most scanner apps, kept inside this app (vendor/).
async function makeScanner() {
  if ('BarcodeDetector' in window) {
    try {
      const can = await window.BarcodeDetector.getSupportedFormats();
      if (FORMATS.every((f) => can.includes(f))) return new window.BarcodeDetector({ formats: FORMATS });
    } catch { /* use the built-in one below */ }
  }
  await loadScript('vendor/barcode-detector.js');
  const api = window.BarcodeDetectionAPI;
  const wasm = new URL('vendor/zxing_reader.wasm', document.baseURI).href;
  api.prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasm : prefix + path) } });
  return new api.BarcodeDetector({ formats: FORMATS });
}
const getScanner = () => (scanner ??= makeScanner().catch((e) => { scanner = null; throw e; }));

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}
sheet.addEventListener('close', stopCamera);

// Zoom in a little and keep refocusing, on phones that let a web page ask. Holding the phone
// further back is what keeps a small barcode sharp.
function tuneCamera(track) {
  const caps = track.getCapabilities?.() ?? {};
  const want = {};
  if (caps.zoom?.max >= 2) want.zoom = Math.max(caps.zoom.min ?? 1, 2);
  if (caps.focusMode?.includes?.('continuous')) want.focusMode = 'continuous';
  if (Object.keys(want).length) track.applyConstraints({ advanced: [want] }).catch(() => {});
}

async function startCamera() {
  const form = sheet.querySelector('[data-form="barcode"]');
  const video = sheet.querySelector('[data-scan-video]');
  const say = (text) => { const el = sheet.querySelector('[data-scan-msg]'); if (el) el.textContent = text; };
  const typeIt = 'Type the number under the barcode instead.';
  if (!navigator.mediaDevices?.getUserMedia) return say(`This browser cannot use the camera here. ${typeIt}`);
  let detector;
  try {
    detector = await getScanner();
  } catch {
    return say(`The scanner could not load. ${typeIt}`);
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia(CAMERA);
  } catch {
    return say(`The camera is blocked or missing. ${typeIt}`);
  }
  if (!form.isConnected || !sheet.open) return stopCamera();
  const mine = stream;
  video.srcObject = stream;
  await video.play().catch(() => {});
  tuneCamera(stream.getVideoTracks()[0]);
  say('Point the camera at the barcode and hold it back until it is sharp.');

  // Looks take turns: the middle band of the picture (less to search, so quicker), then the whole
  // picture (in case the barcode is held off to one side).
  const crop = document.createElement('canvas');
  const pen = crop.getContext('2d', { willReadFrequently: true });
  const mark = sheet.querySelector('[data-scan-mark]');
  // Draws the outline around the barcode where it was seen. The picture is cropped to fill its
  // box (object-fit: cover), so a place in the picture is scaled and shifted the same way.
  const outline = (box) => {
    if (!box) { mark.hidden = true; return; }
    const frame = video.getBoundingClientRect();
    const scale = Math.max(frame.width / video.videoWidth, frame.height / video.videoHeight);
    const dx = (frame.width - video.videoWidth * scale) / 2, dy = (frame.height - video.videoHeight * scale) / 2;
    const pad = 6;
    Object.assign(mark.style, {
      left: `${box.x * scale + dx - pad}px`, top: `${box.y * scale + dy - pad}px`,
      width: `${box.width * scale + pad * 2}px`, height: `${box.height * scale + pad * 2}px`,
    });
    mark.hidden = false;
  };
  let turn = 0;
  let last = null;
  const look = async () => {
    if (stream !== mine) return; // stopped, or the sheet was closed
    let codes = [];
    let ox = 0, oy = 0; // where the searched part sits in the whole picture
    if (video.videoWidth) {
      try {
        if (turn++ % 2) codes = await detector.detect(video);
        else {
          const w = video.videoWidth, h = video.videoHeight;
          const cw = Math.round(w * 0.8), ch = Math.round(h * 0.4);
          ox = (w - cw) / 2;
          oy = (h - ch) / 2;
          crop.width = cw;
          crop.height = ch;
          pen.drawImage(video, ox, oy, cw, ch, 0, 0, cw, ch);
          codes = await detector.detect(crop);
        }
      } catch { /* a frame that could not be read: try the next one */ }
    }
    const hit = codes.find((x) => lookup.isBarcode(x.rawValue));
    const code = hit?.rawValue ?? null;
    const b = hit?.boundingBox;
    outline(b ? { x: b.x + ox, y: b.y + oy, width: b.width, height: b.height } : null);
    // The same number twice in a row, so one misread frame never becomes a wrong food.
    if (code && code === last && stream === mine && form.isConnected) {
      mark.classList.add('got');
      await new Promise((r) => setTimeout(r, 300)); // long enough to see what was read
      if (stream !== mine || !form.isConnected) return;
      stopCamera();
      form.querySelector('[name="code"]').value = code;
      return form.requestSubmit();
    }
    last = code;
    setTimeout(look, SCAN_EVERY_MS);
  };
  look();
}

actions.scan = () => {
  openSheet(`
    <form class="sheet-body" data-form="barcode" novalidate>
      <div>
        <div class="card-title">Scan a barcode</div>
        <div class="muted" style="font-size:14px">For packaged food. The numbers come from Open Food Facts, a free list filled in by volunteers, so check them against the label the first time.</div>
      </div>
      <div class="scan-box"><video class="scan-video" playsinline muted data-scan-video></video><i data-scan-mark hidden></i></div>
      <div class="small muted" data-scan-msg>Starting the camera.</div>
      ${ctx().plan.geminiKey ? '<button type="button" class="btn compact" data-act="scan-table">No barcode? Read the nutrition table</button>' : ''}
      <label class="field"><span>Or type the number</span>
        <input name="code" type="text" inputmode="numeric" autocomplete="off" maxlength="14">
      </label>
      <button class="btn primary">Look it up</button>
      <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
    </form>`);
  // Opening a sheet puts the cursor in its first box. Here that is the number box, and the camera
  // starting up hides the keyboard again, which leaves an iPhone with a box that looks empty but
  // already has the cursor, so tapping it does nothing. Take the cursor out, and a tap works.
  document.activeElement?.blur();
  startCamera();
};


// The same camera can read the nutrition table: one tap takes the picture that is on screen and
// sends it to the label reader. It is a tap, not automatic, because every picture read counts
// against the free daily limit.
actions['scan-table'] = async (el) => {
  const video = sheet.querySelector('[data-scan-video]');
  const say = (text) => { const m = sheet.querySelector('[data-scan-msg]'); if (m) m.textContent = text; };
  if (!video?.videoWidth) return say('The camera is not ready yet. Give it a second, then tap again.');
  const typed = String(sheet.querySelector('[name="code"]')?.value ?? '').replace(/\s/g, '');
  const shot = Object.assign(document.createElement('canvas'), { width: video.videoWidth, height: video.videoHeight });
  shot.getContext('2d').drawImage(video, 0, 0);
  // Hold the picture still, and say so over it: this is the one being read.
  video.pause();
  sheet.querySelector('[data-scan-mark]').hidden = true;
  sheet.querySelector('.scan-box').insertAdjacentHTML('beforeend', '<div class="scan-wait">Reading the table. A few seconds.</div>');
  el.disabled = true;
  say('The picture is held still while it is read.');
  let read = null;
  let problem = '';
  try {
    read = await lookup.readLabel(shot.toDataURL('image/jpeg', 0.9).split(',')[1], ctx().plan.geminiKey);
    if (!read.found) problem = 'No numbers could be read from that picture. Take a photo with the button above, closer and flatter, or type them.';
  } catch (e) {
    problem = e.message;
  }
  if (!sheet.open || !el.isConnected) return; // the sheet was closed while it was reading
  stopCamera();
  openLabel(read?.name ?? '', lookup.isBarcode(typed) ? typed : '');
  const form = sheet.querySelector('[data-form="label"]');
  const msg = form.querySelector('[data-label-msg]');
  if (problem) {
    msg.textContent = problem;
    msg.className = 'small warn-ink';
    return;
  }
  fillLabel(form, read);
  msg.textContent = read.found < 4
    ? 'Some boxes are filled in. The rest could not be read: type those from the pack, and check the others.'
    : 'Filled in from the picture. Check every number against the pack before you save.';
  msg.className = 'small ok-ink';
};

forms.barcode = async (fd, form) => {
  const c = ctx();
  const code = String(fd.get('code')).replace(/\s/g, '');
  if (!lookup.isBarcode(code)) return 'A barcode number is 8 to 14 digits.';
  let f = c.foods.find((x) => x.barcode === code);
  if (!f) {
    const button = form.querySelector('button.primary');
    button.disabled = true;
    try {
      f = await lookup.findBarcode(code, c.key);
    } catch (e) {
      return e.message;
    } finally {
      button.disabled = false;
    }
    // Not on the list, or listed without calories: the numbers come from the label instead.
    if (!f || f.kcal === null) {
      const name = f && !f.name.startsWith('Product ') ? f.name : '';
      setTimeout(() => openLabel(name, code), 0);
      return;
    }
    store.setFood(f.id, f);
  }
  const food = f;
  setTimeout(() => { ui.food.pick = { id: food.id, unit: unitsOf(food)[0], amount: startAmount(food, unitsOf(food)[0]) }; openPick(); }, 0);
};

// ----- A scanned product that is not on the list: copy the label -----
// The boxes follow the order of a nutrition label, top to bottom, so it is read once and typed once.

function openLabel(name, code) {
  const opt = { unit: 'g', required: false };
  openSheet(`
    <form class="sheet-body" data-form="label" novalidate>
      <div>
        <div class="card-title">Copy the label</div>
        <div class="muted" style="font-size:14px">${code
          ? 'This barcode is not on the list with its numbers. Take them from the pack once, and the next scan finds it here.'
          : 'Take the numbers from the nutrition table on the pack.'}</div>
      </div>
      ${ctx().plan.geminiKey ? `
        <label class="btn photo-btn">Photograph the label
          <input type="file" accept="image/*" capture="environment" data-label-photo hidden>
        </label>
        <div class="small muted" data-label-msg>One photo of the whole table, flat and sharp. The boxes below fill in for you to check.</div>`
      : '<div class="small muted">To fill this in from a photo of the label, add a free Google AI key in Settings.</div>'}
      <input type="hidden" name="barcode" value="${esc(code)}">
      ${textField('name', 'Name', name)}
      ${field('per', 'The numbers are for', 100, { unit: 'g', hint: 'Most labels say per 100 g. If yours only says per serving, type the serving weight.' })}
      <div class="field-grid">
        ${field('energy', 'Energy', '')}
        <label class="field"><span>Energy is in</span>
          <select name="energyUnit"><option value="kcal">kcal</option><option value="kj">kJ</option></select>
        </label>
        ${field('fat', 'Total fat', '', { unit: 'g' })}
        ${field('satFat', 'Saturated fat', '', opt)}
        ${field('carbs', 'Carbohydrate', '', { unit: 'g' })}
        ${field('sugar', 'Sugars', '', opt)}
        ${field('fibre', 'Fibre', '', opt)}
        ${field('protein', 'Protein', '', { unit: 'g' })}
        ${field('salt', 'Salt', '', opt)}
        ${field('amount', 'You usually eat', '', opt)}
      </div>
      <div class="small muted">Saturated fat, sugars, fibre and salt can be left empty. If the label gives sodium in mg, leave salt empty.</div>
      <button class="btn primary">Save and add</button>
      <button type="button" class="btn quiet" data-act="close-sheet">Cancel</button>
    </form>`);
}

// A photo of the label, made small enough to send quickly but still sharp enough to read.
async function photoBase64(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

// Fills the boxes from what was read. Only boxes with a reading are touched, and nothing is saved.
function fillLabel(form, v) {
  for (const k of ['per', 'energy', 'energyUnit', 'fat', 'satFat', 'carbs', 'sugar', 'fibre', 'protein', 'salt']) {
    if (v[k] !== null && v[k] !== undefined) form.querySelector(`[name="${k}"]`).value = v[k];
  }
  const name = form.querySelector('[name="name"]');
  if (!name.value.trim() && v.name) name.value = v.name;
  form.dataset.scanned = '1';
}

document.addEventListener('change', async (e) => {
  if (!e.target.matches?.('[data-label-photo]')) return;
  const file = e.target.files?.[0];
  const form = e.target.closest('form');
  const say = (text, cls = '') => { const el = form.querySelector('[data-label-msg]'); el.textContent = text; el.className = `small ${cls || 'muted'}`; };
  e.target.value = '';
  if (!file) return;
  say('Reading the label.');
  try {
    const v = await lookup.readLabel(await photoBase64(file), ctx().plan.geminiKey);
    if (!form.isConnected) return;
    if (!v.found) return say('No numbers could be read from that photo. Try again closer, flatter and in better light.', 'warn-ink');
    fillLabel(form, v);
    say(v.found < 4
      ? 'Some boxes are filled in. The rest could not be read: type those from the pack, and check the others.'
      : 'Filled in from the photo. Check every number against the pack before you save.', 'ok-ink');
  } catch (err) {
    if (form.isConnected) say(err.message, 'warn-ink');
  }
});

forms.label = (fd, form) => {
  const name = String(fd.get('name')).trim();
  const n = Object.fromEntries(['per', 'energy', 'fat', 'satFat', 'carbs', 'sugar', 'fibre', 'protein', 'salt', 'amount'].map((k) => [k, readNumber(fd, k)]));
  if (!name) return 'Give it a name.';
  if (!n.per || n.per > 2000) return 'Say how many grams the label numbers are for. It is usually 100.';
  if (!n.energy || [n.fat, n.carbs, n.protein].includes(null)) return 'Energy, total fat, carbohydrate and protein all need a number. Use 0 if there is none.';
  const kcal = Math.round(fd.get('energyUnit') === 'kj' ? n.energy / 4.184 : n.energy);
  if (kcal > MAX_KCAL || Math.max(n.fat, n.carbs, n.protein) > n.per) return 'One of those numbers is too big for that weight. Check for a slip.';
  // Calories far from what the macros add up to usually mean a slip, or kJ typed as kcal.
  const fromMacros = n.protein * 4 + n.carbs * 4 + n.fat * 9;
  if (kcal > 50 && (fromMacros > kcal * 1.6 || fromMacros < kcal * 0.5) && form.dataset.warned !== String(fromMacros)) {
    form.dataset.warned = String(fromMacros);
    return `Those numbers add up to about ${Math.round(fromMacros)} kcal, but the energy comes to ${kcal} kcal. Check whether the label says kJ. If it is right, tap Save and add again.`;
  }
  const id = `my-${newId()}`;
  const extra = Object.fromEntries(['sugar', 'satFat', 'salt'].filter((k) => n[k] !== null).map((k) => [k, n[k]]));
  const food = {
    id, name, serving: `${n.per} g`, byGrams: true, grams: n.per, amount: n.amount && n.amount <= MAX_AMOUNT ? n.amount : n.per,
    kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fibre: n.fibre, source: form.dataset.scanned ? 'label' : 'own',
    ...(Object.keys(extra).length ? { extra } : {}),
  };
  const barcode = String(fd.get('barcode') ?? '');
  if (lookup.isBarcode(barcode)) food.barcode = barcode;
  store.setFood(id, food);
  setTimeout(() => { ui.food.pick = { id, unit: 'g', amount: food.amount }; openPick(); }, 0);
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
  const from = f;
  openSheet(`
    <form class="sheet-body" data-form="food" data-id="${esc(f.id ?? '')}" novalidate>
      <div class="card-title">${f.id ? 'Edit food' : 'New food'}</div>
      ${f.id ? '' : '<button type="button" class="link" data-act="open-label">Have the pack? Copy its label instead</button>'}
      ${from.barcode ? `<input type="hidden" name="barcode" value="${esc(from.barcode)}">` : ''}
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

actions['open-label'] = () => openLabel(ui.food.search, '');

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
  const barcode = String(fd.get('barcode') ?? '');
  if (lookup.isBarcode(barcode)) food.barcode = barcode;
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
  // Two taps, so a slip does not lose a food. What was already logged stays logged either way.
  if (el.dataset.sure !== '1') {
    el.dataset.sure = '1';
    el.textContent = 'Tap again to remove it';
    return;
  }
  sheet.close();
  ui.food.pick = null;
  ui.food.recipe = null;
  // A preloaded food cannot be deleted from the code, so it is hidden instead. Anything else is deleted.
  store.setFood(id, preloaded.some((f) => f.id === id) ? { id, hidden: true } : null);
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
