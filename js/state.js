// One place that turns stored data into what the screens need.

import { plan as basePlan } from './plan.js';
import * as rules from './rules.js';
import * as store from './store.js';
import { foods as preloaded } from './foods.js';

// Things that are only about what is on screen right now. Never stored.
export const ui = {
  tab: null,
  enter: '',
  calendarOpen: false,
  // adding: the Add screen is open. list: which tab of it. pick: the food in the amount sheet.
  // recipe: the recipe being built. picking: choosing an ingredient for it.
  food: { meal: null, adding: false, list: 'recent', search: '', pick: null, recipe: null, picking: false, found: null, day: null, added: null },
};

// ?today=2026-11-03 previews another date, to check how the plan re-flows.
// Anything that is not a real date is ignored, so a mangled address cannot break the app.
function previewDay() {
  const v = new URLSearchParams(location.search).get('today');
  return rules.isDay(v) ? v : null;
}

export function ctx() {
  const data = store.get();
  const plan = rules.planFrom(basePlan, data.plan);
  const key = previewDay() ?? rules.dayKey(new Date(), plan.rolloverHour, plan.utcOffsetHours);
  const log = {};
  for (const [k, d] of Object.entries(data.days)) if (d.session) log[k] = { ...d.session, id: d.workout?.session };
  // Your own foods and edits sit on top of the preloaded list. A hidden one is removed.
  const foods = [...preloaded.filter((f) => !data.foods[f.id]), ...Object.values(data.foods)]
    .filter((f) => !f.hidden);
  return {
    data, plan, key, log, foods,
    profile: data.profile,
    targets: data.profile?.targets,
    day: data.days[key] ?? {},
  };
}
