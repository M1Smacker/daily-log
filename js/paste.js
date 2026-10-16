// Reading nutrition pasted from ChatGPT, Claude, a website or a note. Fixed rules, no AI, and the
// text never leaves the phone. Lines it does not understand are skipped, so a whole chat reply can
// be pasted. A number that is not there stays unknown (null), never a made-up zero. A range is used
// at its middle, and anything the reader had to decide is said in `notes`, so it can be checked
// before anything is saved.

import { typedNumber } from './rules.js';

// The words for each thing, after tidying: lower case, no brackets, no "total" or "of which".
const LABELS = {
  name: ['meal', 'food', 'dish', 'item', 'name', 'meal name', 'food name', 'dish name', 'description', 'title'],
  kcal: ['calories', 'calorie', 'kcal', 'kcals', 'cal', 'cals', 'energy', 'food energy', 'kilocalories'],
  protein: ['protein', 'proteins', 'prot'],
  carbs: ['carbohydrate', 'carbohydrates', 'carbs', 'carb', 'carbohydrate by difference', 'carbohydrates total'],
  netCarbs: ['net carbs', 'net carbohydrates', 'net carb', 'net carbohydrate'],
  fat: ['fat', 'fats', 'lipids', 'lipid', 'fat total'],
  satFat: ['saturated fat', 'saturated fats', 'saturates', 'sat fat', 'saturated'],
  sugar: ['sugar', 'sugars'],
  fibre: ['fibre', 'fiber', 'fibres', 'fibers', 'dietary fibre', 'dietary fiber'],
  salt: ['salt'],
  sodium: ['sodium'],
  // A weight: a bare number here is taken as grams.
  weight: ['edible serving weight', 'serving weight', 'edible weight', 'edible portion', 'edible portion weight', 'portion weight',
    'weight', 'net weight', 'cooked weight', 'meal weight', 'plate weight', 'weight eaten', 'edible serving'],
  // A serving: only counts as a weight when it says g, ml, oz or kg ("1 plate" is not a weight).
  serving: ['serving', 'serving size', 'portion', 'portion size', 'amount', 'quantity', 'size'],
};
const FIELD_OF = new Map(Object.entries(LABELS).flatMap(([f, words]) => words.map((w) => [w, f])));
const NUTRIENTS = ['kcal', 'protein', 'carbs', 'netCarbs', 'fat', 'satFat', 'sugar', 'fibre', 'salt', 'sodium'];
const SAID = { kcal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fibre: 'Fibre', sugar: 'Sugars', satFat: 'Saturated fat', salt: 'Salt' };

// A row or line that is the meal's total, not one part of it.
const TOTAL_WORDS = new Set(['total', 'totals', 'grand total', 'meal total', 'total meal', 'overall', 'overall total',
  'whole meal', 'sum', 'total for meal', 'total for the meal', 'total for whole meal', 'meal totals', 'combined',
  // A summary or recap restates the meal: a total, not another food.
  'summary', 'quick summary', 'recap', 'in total', 'altogether', 'tldr', 'tl dr', 'at a glance', 'overview', 'in short', 'all in']);
// Headings that name nothing: never used as the meal's name.
const GENERIC = /nutrition|nutrient|macro|breakdown|logging|log it|summary|estimate|copy|here|values|info|facts|per |total|approx|result|answer|table/;

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?`;
const UNIT = String.raw`kcal|kilocalories|calories|calorie|cals|cal|kj|kilojoules|grams|gram|gms|gm|g|mg|mcg|µg|ml|oz|kg|%`;
// A number, an optional second number for a range, then an optional unit. The group before the
// number keeps it from starting inside a word ("B12", "Omega-3") or another number.
const VALUE = new RegExp(String.raw`(^|[^A-Za-z\d.,])(${NUM})(?:\s*(?:-|to)\s*(${NUM}))?\s*(${UNIT})?(?![A-Za-z])`, 'gi');

const round1 = (n) => Math.round(n * 10) / 10;
const KCAL_UNITS = new Set(['kcal', 'kilocalories', 'calories', 'calorie', 'cals', 'cal']);
const WEIGHT_UNITS = { g: 1, gram: 1, grams: 1, gm: 1, gms: 1, kg: 1000, oz: 28.35, ml: 1 };

// Arabic-Indic digits to the ones the rest of the app reads.
const westernDigits = (s) => s.replace(/[٠-٩۰-۹]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10));

// One line as plain text: no markdown, bullets, emoji or "about" words. Dashes become "-".
function tidyLine(line) {
  return westernDigits(line)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[‒-―−]/g, '-')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*#+\s*/, '')
    .replace(/^\s*(?:[-*•·▪◦>]+|\d+[.)])\s+(?=\S)/, '')
    .replace(/[~≈]|\b(?:approx(?:imately)?\.?|about|around|roughly|circa|ca\.)\s*(?=[\d(])/gi, '')
    .trim();
}

// A label as a key into LABELS. Brackets are kept aside: "Energy (kcal)" names its unit there.
function tidyLabel(raw) {
  const low = raw.toLowerCase();
  const paren = [...low.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(' ');
  const bare = low.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const label = bare.replace(/\b(?:of which|total|estimated|est|content|amount of|per serving|per portion)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const field = FIELD_OF.get(label) ?? FIELD_OF.get(label.replace(/s$/, '')) ?? null;
  return { field, label, paren, total: TOTAL_WORDS.has(bare) };
}

// Whether text talks about numbers "per 100 g" (or per 100 ml).
const PER_100 = /(?:per|\/|for|each)\s*100\s*(?:g|ml|grams)\b/i;
// A heading for the whole meal, as opposed to per 100 g.
const PER_SERVING = /per (?:serving|portion|meal|plate)|whole (?:meal|plate|dish|serving|portion)|for the (?:meal|plate|whole|dish)|entire|full (?:meal|plate)|this (?:meal|plate|serving)|as eaten/i;

// The weight in some text, in grams: "625 g", "1 plate (625 g)", "12 oz". Null when there is none.
function weightIn(text, bareIsGrams) {
  let bare = null;
  for (const m of String(text).matchAll(VALUE)) {
    const unit = m[4]?.toLowerCase();
    const n = typedNumber(m[2]);
    if (n === null) continue;
    if (unit && WEIGHT_UNITS[unit]) return { grams: round1(n * WEIGHT_UNITS[unit]), drink: unit === 'ml' };
    if (!unit && bare === null) bare = n;
  }
  return bareIsGrams && bare !== null ? { grams: bare, drink: false } : null;
}

// The value of one thing, from the text after its label. Returns { v, approx, per100, note } or
// { unknown: true }, or null when nothing usable is there.
function readValue(field, text, parenUnit = '') {
  const t = String(text).trim();
  if (field === 'name') {
    const name = t.replace(/[.:;,\s]+$/, '').slice(0, 80).trim();
    return /[A-Za-z؀-ۿ]/.test(name) ? { v: name } : null;
  }
  if (field === 'weight' || field === 'serving') {
    const w = weightIn(t, field === 'weight');
    return w ? { v: w.grams, drink: w.drink } : null;
  }
  const matches = [...t.matchAll(VALUE)].map((m) => ({
    a: typedNumber(m[2]), b: m[3] ? typedNumber(m[3]) : null, unit: (m[4] ?? parenUnit.match(new RegExp(String.raw`\b(${UNIT})\b`, 'i'))?.[1] ?? '').toLowerCase(),
    after: t.slice(m.index + m[0].length),
  })).filter((m) => m.a !== null && m.unit !== '%');
  if (!matches.length) return /^(?:unknown|n\/?a|not known|not available|not listed|none listed|varies|\?|-)\s*$/i.test(t) || /^unknown\b/i.test(t) ? { unknown: true } : null;
  let pick = matches[0];
  let note = null;
  if (field === 'kcal') {
    pick = matches.find((m) => KCAL_UNITS.has(m.unit)) ?? matches.find((m) => m.unit === 'kj' || m.unit === 'kilojoules') ?? matches.find((m) => !m.unit) ?? matches[0];
    if (pick.unit === 'kj' || pick.unit === 'kilojoules') note = 'kJ';
  } else if (KCAL_UNITS.has(pick.unit) || pick.unit === 'kj') {
    // "Protein: 400 kcal" is calories from protein, not grams of it. Look for grams on the line.
    pick = matches.find((m) => !KCAL_UNITS.has(m.unit) && m.unit !== 'kj');
    if (!pick) return null;
  }
  let v = pick.b !== null && pick.b >= pick.a ? (pick.a + pick.b) / 2 : pick.a;
  const approx = pick.b !== null && pick.b > pick.a;
  if (note === 'kJ') v /= 4.184;
  if (field !== 'kcal' && ['mg'].includes(pick.unit)) v /= 1000;
  if (field !== 'kcal' && ['mcg', 'µg'].includes(pick.unit)) v /= 1e6;
  if (field !== 'kcal' && pick.unit === 'kg') v *= 1000;
  return { v, approx, range: approx ? [pick.a, pick.b] : null, per100: PER_100.test(pick.after.slice(0, 30)) || PER_100.test(parenUnit), note };
}

// "100 g protein", "1,100 kcal", "30 g of fat": a number first, then what it is.
function numberFirst(seg) {
  const m = seg.match(new RegExp(String.raw`^(${NUM})(?:\s*(?:-|to)\s*(${NUM}))?\s*(${UNIT})?\s*(?:of\s+)?([A-Za-z][A-Za-z\s]*?)?\s*(\([^)]*\))?\s*$`, 'i'));
  if (!m) return null;
  const unit = (m[3] ?? '').toLowerCase();
  const words = (m[4] ?? '').trim();
  const { field } = words ? tidyLabel(words) : { field: KCAL_UNITS.has(unit) || unit === 'kj' ? 'kcal' : null };
  if (!field || !NUTRIENTS.includes(field)) return null;
  return { field, value: readValue(field, seg.slice(0, m[0].length - (m[4] ?? '').length - (m[5] ?? '').length), m[5] ?? '') };
}

// A label, then its value: "Protein: 100 g", "Protein 100 g", "Protein - 100 g".
function labelFirst(seg) {
  const m = seg.match(/^([A-Za-z؀-ۿ][^:=]*?)\s*[:=]\s*(.*)$/) ?? seg.match(/^([A-Za-z][A-Za-z\s()/&'.]*?)\s*-?\s+(?=\d)(.*)$/);
  return m ? { raw: m[1], rest: m[2] } : null;
}

// Splits a line of several things ("Calories: 1100 | Protein: 100 g", "450 kcal, 60 g protein").
// "1,100" stays one number: a comma only splits when a space follows it.
const splitSegments = (s) => s.split(/\s*\|\s*|\s*;\s*|\s+[•·]\s+|,\s+|\s+\/\s+(?=\d)/).map((x) => x.trim()).filter(Boolean);

// Cells that each carry their own label and number ("100 g protein", "Fat: 30 g") make a line
// split by pipes, not a table: in a table the label and the number sit in different cells.
const selfContained = (cells) => cells.filter((c) => {
  if (numberFirst(c)) return true;
  const l = labelFirst(c);
  return Boolean(l && /\d/.test(l.rest) && NUTRIENTS.includes(tidyLabel(l.raw).field));
}).length >= 2;

const TABLE_ROW = (line) => line.includes('\t') || (line.match(/\|/g)?.length ?? 0) >= 2;
const cellsOf = (line) => (line.includes('\t') ? line.split('\t') : line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|')).map((c) => tidyLine(c));

/**
 * Reads pasted text. Returns:
 *   { name, kcal, protein, carbs, fat, fibre, extra: { sugar, satFat, salt }, grams, drink,
 *     per100, found, parts, notes }
 * Every number is null when it was not there. found counts the main five that were read.
 * parts lists what was added together when the paste held several foods and no total.
 */
export function readNutrition(input) {
  const vals = []; // { field, v, item, total, per100, approx, range, note }
  const items = [{ name: null, grams: null }];
  let item = 0;
  let section = null; // 'serving' or 'per100', from a heading
  let name = null;
  let weight = null;
  let drink = false;
  let headerGrams = null;
  let firstHeading = null;
  let table = null; // { kind: 'rows' | 'cols', cols: [...] } while inside a table

  const add = (field, r, extra = {}) => {
    if (!r) return;
    if (field === 'name') { name ??= r.v; return; }
    if (field === 'weight' || field === 'serving') {
      if (extra.item !== undefined && extra.item !== 0) items[extra.item].grams ??= r.v;
      else if (weight === null) { weight = r.v; drink = r.drink; }
      return;
    }
    if (r.unknown) { vals.push({ field, v: null, unknown: true, item: extra.item ?? item, total: Boolean(extra.total), per100: section === 'per100' }); return; }
    if (!Number.isFinite(r.v) || r.v < 0) return;
    vals.push({ field, v: r.v, item: extra.item ?? item, total: Boolean(extra.total), per100: Boolean(r.per100 || extra.per100 || section === 'per100'), approx: r.approx, range: r.range, note: r.note });
  };
  const newItem = (label) => {
    const w = weightIn(label, false);
    items.push({ name: label.replace(/\([^)]*\)/g, '').replace(/[:\s]+$/, '').trim() || null, grams: w?.grams ?? null });
    item = items.length - 1;
  };

  for (const rawLine of String(input ?? '').slice(0, 20000).split(/\r?\n/)) {
    if (TABLE_ROW(rawLine) && !selfContained(cellsOf(rawLine))) {
      const cells = cellsOf(rawLine);
      if (cells.every((c) => /^[\s:-]*$/.test(c))) continue; // the |---|---| line under a header
      const heads = cells.map((c) => tidyLabel(c));
      if (!table) {
        // The first row of a table says how to read it: nutrients across the top, or down the side.
        // A heading never holds a number: "1100 kcal" in a cell is a value, even though it says kcal.
        const across = heads.filter((h, i) => h.field && NUTRIENTS.includes(h.field) && !/\d/.test(cells[i])).length;
        if (across >= 2) { table = { kind: 'cols', cols: heads.map((h) => h.field) }; continue; }
        if (!heads[0].field && !heads[0].total && cells.slice(1).some((c) => /[A-Za-z]/.test(c))) {
          table = { kind: 'rows', cols: cells.map((c) => (PER_100.test(c) || /^\s*100\s*(g|ml)\b/i.test(c)) && !PER_SERVING.test(c) ? 'per100' : 'serving') };
          for (const c of cells.slice(1)) if (!PER_100.test(c)) headerGrams ??= weightIn(c, false)?.grams ?? null;
          continue;
        }
        table = { kind: 'rows', cols: cells.map(() => 'serving') };
      }
      if (table.kind === 'cols') {
        // One row per food: its name first, then a number under each nutrient.
        const total = heads[0].total;
        if (!total) newItem(cells[0]);
        cells.forEach((c, i) => {
          const f = table.cols[i];
          if (i > 0 && f) add(f, readValue(f, c), { item: total ? 0 : item, total });
        });
        continue;
      }
      // One row per nutrient: its name first, then a value in each column. The first column that
      // is for the whole serving is the one used.
      const f = heads[0].field;
      if (!f) continue;
      const col = Math.max(1, table.cols.findIndex((k, i) => i > 0 && k === 'serving'));
      const per100 = table.cols[col] === 'per100' || table.cols.slice(1).every((k) => k === 'per100');
      add(f, readValue(f, cells[col] ?? '', heads[0].paren), { per100 });
      continue;
    }
    table = null;

    const line = tidyLine(rawLine);
    if (!line) continue;
    const lab = labelFirst(line);
    const head = lab ? tidyLabel(lab.raw) : null;

    // A heading on its own line: per 100 g, per serving, or the name of a part of the meal.
    if (!lab || (!head.field && !head.total && !lab.rest.trim())) {
      const text = lab ? lab.raw : line;
      if (PER_100.test(text) && !PER_SERVING.test(text)) { section = 'per100'; continue; }
      if (PER_SERVING.test(text)) { section = 'serving'; headerGrams ??= weightIn(text, false)?.grams ?? null; continue; }
      // A run of number-first things ("1,100 kcal | 100 g protein") with no label at all.
      const loose = splitSegments(line).map(numberFirst).filter(Boolean);
      if (loose.length) { loose.forEach((x) => add(x.field, x.value)); continue; }
      if (text.length <= 60 && (lab || /:$/.test(line) || !/\d/.test(text)) && /[A-Za-z]/.test(text)) {
        firstHeading ??= text.replace(/[:\s]+$/, '');
        newItem(text);
      }
      continue;
    }

    // A name or a weight takes the whole line: "Meal: chicken, rice and salad" is one name.
    if (head.field === 'name' || head.field === 'weight' || head.field === 'serving') { add(head.field, readValue(head.field, lab.rest, head.paren)); continue; }

    // "Total: 1100 kcal, 100 g protein" or a line for one part: "Chicken (300 g): 450 kcal, 60 g protein".
    if (!head.field) {
      const parts = splitSegments(lab.rest).map((s) => numberFirst(s) ?? (() => {
        const l = labelFirst(s);
        const h = l && tidyLabel(l.raw);
        return h?.field && NUTRIENTS.includes(h.field) ? { field: h.field, value: readValue(h.field, l.rest, h.paren) } : null;
      })()).filter(Boolean);
      if (!parts.length) continue;
      if (!head.total) newItem(lab.raw);
      parts.forEach((x) => add(x.field, x.value, { item: head.total ? 0 : item, total: head.total }));
      continue;
    }

    // An ordinary line of one or more labelled things.
    for (const seg of splitSegments(line)) {
      const l = labelFirst(seg);
      const h = l && tidyLabel(l.raw);
      if (h?.field && NUTRIENTS.includes(h.field)) add(h.field, readValue(h.field, l.rest, h.paren));
      else { const x = numberFirst(seg); if (x) add(x.field, x.value); }
    }
  }

  return settle({ vals, items, name, weight, drink, headerGrams, firstHeading });
}

// From everything that was read, the one set of numbers for the meal, with what was decided.
function settle({ vals, items, name, weight, drink, headerGrams, firstHeading }) {
  const notes = [];
  let pool = vals;
  if (pool.some((x) => x.total)) {
    // A total gives the numbers it has. Anything it leaves out comes from the meal's own lines when
    // there is only one meal, and is otherwise unknown: it is never added up from parts under a total.
    const totals = pool.filter((x) => x.total);
    const rest = pool.filter((x) => !x.total);
    const restItems = new Set(rest.filter((x) => !x.unknown).map((x) => x.item));
    const fromTotal = new Set(totals.map((x) => x.field));
    pool = restItems.size === 1 ? [...totals, ...rest.filter((x) => !fromTotal.has(x.field))].map((x) => ({ ...x, item: 0 })) : totals.map((x) => ({ ...x, item: 0 }));
    if (restItems.size > 1) notes.push('There was a total row, so that is what is used.');
  }
  const serving = pool.filter((x) => !x.per100);
  const per100 = pool.length > 0 && serving.length === 0;
  if (!per100 && serving.length < pool.length) notes.push('Both per serving and per 100 g numbers were there. The per serving ones are used.');
  if (!per100) pool = serving;

  const used = [...new Set(pool.filter((x) => !x.unknown).map((x) => x.item))];
  const out = {};
  let parts = [];
  if (used.length <= 1) {
    for (const x of pool) {
      if (!(x.field in out)) out[x.field] = x;
      else if (!out[x.field].unknown && !x.unknown && Math.abs(out[x.field].v - x.v) > 0.05 && !out[x.field].clash) {
        out[x.field].clash = true;
        notes.push(`${SAID[x.field] ?? x.field} was given more than once (${round1(out[x.field].v)} and ${round1(x.v)}). The first is used.`);
      }
    }
  } else {
    // Several foods and no total: added together, the way a recipe adds up its ingredients. A part
    // with no figure for something leaves the whole meal with none for it either.
    parts = used.map((i) => items[i].name ?? `part ${i}`);
    for (const f of NUTRIENTS) {
      const each = used.map((i) => pool.find((x) => x.item === i && x.field === f && !x.unknown));
      if (each.every(Boolean)) out[f] = { v: each.reduce((a, x) => a + x.v, 0), approx: each.some((x) => x.approx) };
      else if (each.some(Boolean)) notes.push(`${SAID[f] ?? f} was missing for some parts, so it is left unknown.`);
    }
    notes.push(`Added up from ${parts.length} parts: ${parts.join(', ')}.`);
    const weights = used.map((i) => items[i].grams);
    if (weight === null && weights.every((w) => w !== null)) weight = weights.reduce((a, b) => a + b, 0);
  }

  for (const [f, x] of Object.entries(out)) {
    if (x.range) notes.push(`${SAID[f] ?? f} was given as ${round1(x.range[0])} to ${round1(x.range[1])}, so the middle, ${round1(x.v)}, is used.`);
    if (x.note === 'kJ') notes.push('Energy was in kJ, so it was turned into kcal.');
  }
  const val = (f) => (out[f] && !out[f].unknown ? out[f].v : null);
  let carbs = val('carbs');
  if (carbs === null && val('netCarbs') !== null) {
    carbs = val('netCarbs');
    notes.push('Only net carbs were given, so those are used as the carbs.');
  }
  let salt = val('salt');
  if (salt === null && val('sodium') !== null) {
    salt = val('sodium') * 2.5;
    notes.push('Salt is worked out from the sodium (sodium x 2.5).');
  }
  const kcal = val('kcal');
  const r = {
    name: name ?? (used.length <= 1 && items[used[0] ?? 0]?.name && !GENERIC.test(items[used[0] ?? 0].name.toLowerCase())
      ? items[used[0] ?? 0].name
      : firstHeading && !GENERIC.test(firstHeading.toLowerCase()) && used.length <= 1 ? firstHeading : null),
    kcal: kcal === null ? null : Math.round(kcal),
    protein: val('protein') === null ? null : round1(val('protein')),
    carbs: carbs === null ? null : round1(carbs),
    fat: val('fat') === null ? null : round1(val('fat')),
    fibre: val('fibre') === null ? null : round1(val('fibre')),
    extra: Object.fromEntries([['sugar', val('sugar')], ['satFat', val('satFat')], ['salt', salt]].filter(([, v]) => v !== null).map(([k, v]) => [k, round1(v)])),
    grams: weight ?? headerGrams ?? (used.length === 1 ? items[used[0]]?.grams ?? null : null),
    drink,
    per100,
    parts,
    notes,
  };
  if (r.name) r.name = r.name.slice(0, 80);
  if (r.grams !== null) r.grams = round1(r.grams);
  r.found = ['kcal', 'protein', 'carbs', 'fat', 'fibre'].filter((k) => r[k] !== null).length;
  return r;
}

// What to give ChatGPT or Claude once, so its replies end in a block this reader takes in whole.
export const ASK_FORMAT = `When I ask you for the nutrition of a meal, end your reply with exactly these lines, one per line, as "Label: number unit":
Meal: (a short name)
Calories: (kcal)
Protein: (g)
Carbohydrates: (g)
Fat: (g)
Fiber: (g)
Edible serving weight: (g)
Give one number for each, not a range. The numbers are for the whole amount I ate, not per 100 g. If you do not know one, write "unknown" instead of a guess.`;
