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
  food: { id: null, amount: null, meal: null, search: '' },
};

const param = (name) => new URLSearchParams(location.search).get(name);

export function ctx() {
  const data = store.get();
  const plan = { ...basePlan, ...data.plan };
  // ?today=2026-11-03 previews another date, to check how the plan re-flows.
  const key = param('today') ?? rules.dayKey(new Date(), plan.rolloverHour, plan.utcOffsetHours);
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
