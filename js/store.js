// Where the data lives. For now that is this device only.
// The shapes match the Firestore documents they will become, so adding sync
// later changes this file and nothing else:
//   profile            users/{uid}/meta/profile   height, weights, targets
//   plan               users/{uid}/meta/plan      changes to the plan template (moved phases, rollover)
//   days[YYYY-MM-DD]   users/{uid}/days/{key}     food, steps, water, weight, supplements, session
//   foods[id]          users/{uid}/foods/{id}     your own foods and edits to preloaded ones

const KEY = 'daily-log';
const VERSION = 1;

let data = { v: VERSION, profile: null, plan: {}, days: {}, foods: {} };
let onChange = () => {};

export function init(listener) {
  onChange = listener;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.v === VERSION) data = { ...data, ...saved };
  } catch { /* nothing saved yet, or storage is blocked: start empty */ }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: kept in memory only */ }
}
function commit() {
  save();
  onChange();
}

export const get = () => data;
export const setProfile = (profile) => { data.profile = { v: VERSION, ...profile }; commit(); };
export const setPlan = (patch) => { data.plan = { ...data.plan, ...patch }; commit(); };
// quiet saves without redrawing the screen, for typing into a field that must keep focus.
export function setDay(key, patch, quiet = false) {
  data.days[key] = { ...data.days[key], ...patch };
  if (quiet) save();
  else commit();
}
export function setFood(id, food) {
  if (food) data.foods[id] = food;
  else delete data.foods[id];
  commit();
}
