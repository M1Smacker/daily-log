// Where the data lives.
//
// With no Firebase config (js/firebase-config.js is null) everything is kept on this device.
// With a config, the same data lives in Firestore behind a Google login, with Firestore's own
// offline database on the phone: writes land there first and sync when there is a connection.
//
// Either way the shapes are the same:
//   profile            users/{uid}/meta/profile   height, weights, targets
//   plan               users/{uid}/meta/plan      changes to the plan template (moved phases, rollover)
//   days[YYYY-MM-DD]   users/{uid}/days/{key}     food, steps, water, weight, supplements, session, workout
//   foods[id]          users/{uid}/foods/{id}     your own foods and edits to preloaded ones
//   (backups)          users/{uid}/backups/{day}  one whole-app copy a day, the last 14 kept

import { firebaseConfig } from './firebase-config.js';
import { isDay, MEAL_IDS } from './rules.js';

const KEY = 'daily-log';
const VERSION = 1;
// Loaded from Google's CDN only when a config exists. Match this to the version in the
// snippet the Firebase console gives you.
const SDK = 'https://www.gstatic.com/firebasejs/13.0.0';

const empty = () => ({ v: VERSION, profile: null, plan: {}, days: {}, foods: {} });
let data = empty();
let device = empty(); // what was on this device before login, uploaded once if the cloud is empty
let onChange = () => {};
let fb = null; // { auth, db, a: auth module, f: firestore module } once the SDK has loaded
let stop = [];

// What the screens need to know about login and sync.
//   cloud    a Firebase config exists
//   ready    data has loaded (always true on a device-only setup)
//   user     { uid, hasPassword } when signed in. hasPassword: an email and password can be used too
//   confirmed  the server itself has answered about the profile, so "no profile" can be believed
//   pending  some writes are saved on the phone but not yet on the server
//   error    a plain message when something went wrong
export const account = { cloud: Boolean(firebaseConfig), ready: !firebaseConfig, user: null, confirmed: false, pending: false, error: null };
// Called when only the sync status changed, so the screen does not need a full redraw.
export const hooks = { status: () => {} };

// Loaded data is not trusted to be well formed: a damaged save or a bad sync must not be
// able to break a screen. Anything that is not the right kind of value is dropped from the
// copy in memory. What is stored is left as it is.
const NUMBERS = ['weightKg', 'waistCm', 'steps', 'waterMl'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function tidyDay(day) {
  if (!day || typeof day !== 'object') return {};
  const d = { ...day };
  for (const f of NUMBERS) if (f in d && !isNum(d[f])) delete d[f];
  d.food = Array.isArray(d.food) ? d.food.filter((e) => e && typeof e === 'object' && isNum(e.kcal)) : undefined;
  d.cardio = Array.isArray(d.cardio) ? d.cardio.filter((x) => x && isNum(x.minutes)) : undefined;
  if (d.session && !['done', 'min', 'missed'].includes(d.session.type)) delete d.session;
  if (d.workout && (typeof d.workout !== 'object' || typeof d.workout.session !== 'string')) delete d.workout;
  if (d.workout && (typeof d.workout.lifts !== 'object' || !d.workout.lifts)) d.workout = { ...d.workout, lifts: {} };
  if (d.food === undefined) delete d.food;
  if (d.cardio === undefined) delete d.cardio;
  // Meals marked as eaten nothing: only real meal names, each once.
  if ('noMeal' in d) {
    const none = Array.isArray(d.noMeal) ? [...new Set(d.noMeal.filter((m) => MEAL_IDS.includes(m)))] : [];
    if (none.length) d.noMeal = none; else delete d.noMeal;
  }
  return d;
}
// A day key has to be a real calendar day. '2026-13-45' looks like one, and date sums on it throw.
const isKey = (k) => isDay(k);
export function tidy(all) {
  const days = {};
  for (const [k, d] of Object.entries(all.days && typeof all.days === 'object' ? all.days : {})) if (isKey(k)) days[k] = tidyDay(d);
  const foods = {};
  for (const [id, f] of Object.entries(all.foods && typeof all.foods === 'object' ? all.foods : {})) {
    if (f && typeof f === 'object' && (f.hidden || (typeof f.name === 'string' && isNum(f.kcal)))) foods[id] = { ...f, id };
  }
  const t = all.profile?.targets;
  const profile = t && typeof t === 'object' && ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'waterMl'].every((m) => isNum(t[m]) && t[m] > 0)
    && isNum(all.profile.startKg) && isNum(all.profile.goalKg) ? all.profile : null;
  return { ...all, days, foods, profile, plan: all.plan && typeof all.plan === 'object' ? all.plan : {} };
}

// Turns the text of a backup (a file, or an automatic copy) back into data.
// Returns { data } or { error } with a plain sentence. Never throws.
export function readBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { error: 'That is not a backup file from this app.' }; }
  if (!raw || typeof raw !== 'object' || typeof raw.v !== 'number' || typeof raw.days !== 'object' || !raw.days) {
    return { error: 'That is not a backup file from this app.' };
  }
  if (raw.v > VERSION) return { error: 'That backup was made by a newer version of the app. Refresh the app, then try again.' };
  while (raw.v < VERSION && UPGRADES[raw.v]) raw = UPGRADES[raw.v](raw);
  const next = tidy({ ...empty(), ...raw, v: VERSION });
  if (!next.profile) return { error: 'That backup has no usable profile in it, so it was not loaded.' };
  return { data: { v: VERSION, profile: next.profile, plan: next.plan, days: next.days, foods: next.foods } };
}

// Steps that bring older saved data up to the current shape, keyed by the version they start from.
// Empty for now: nothing has changed shape yet. Add { 1: (d) => ({ ...d, v: 2, ... }) } when it does.
const UPGRADES = {};
let readOnly = false; // set when saved data must not be overwritten

// Reads what is saved on this device. Never throws away something it cannot use:
// unreadable or newer data is kept under a backup key first.
function loadDevice() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return; } // storage blocked: nothing to read
  if (!raw) return;
  let saved;
  try { saved = JSON.parse(raw); } catch { saved = null; }
  if (!saved || typeof saved !== 'object' || typeof saved.v !== 'number') {
    try { localStorage.setItem(`${KEY}-unreadable`, raw); } catch { /* could not back up */ }
    account.error = 'The data saved on this device could not be read. A copy was kept, and the app has started empty.';
    return;
  }
  if (saved.v > VERSION) {
    readOnly = true;
    account.error = 'This data was saved by a newer version of the app. Refresh to update. Nothing will be saved until then.';
    return;
  }
  while (saved.v < VERSION && UPGRADES[saved.v]) saved = UPGRADES[saved.v](saved);
  device = tidy({ ...empty(), ...saved, v: VERSION });
}

export async function init(listener) {
  onChange = listener;
  // Ask the browser never to clear this app's storage on its own. It may say no; that is fine.
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
  loadDevice();
  if (!firebaseConfig) {
    data = device;
    autoBackup();
    // Another tab of the app saved something: take it, so the two do not overwrite each other.
    addEventListener('storage', (e) => {
      if (e.key !== KEY) return;
      loadDevice();
      data = device;
      onChange();
    });
    return;
  }
  try {
    const [appMod, a, f] = await Promise.all(
      ['app', 'auth', 'firestore'].map((m) => import(`${SDK}/firebase-${m}.js`)));
    const app = appMod.initializeApp(firebaseConfig);
    const db = f.initializeFirestore(app, {
      localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }),
    });
    fb = { auth: a.getAuth(app), db, a, f };
    a.onAuthStateChanged(fb.auth, onUser);
  } catch {
    account.error = 'Could not load the login service. Check your connection and open the app again.';
    account.ready = true;
    onChange();
  }
}

// Same data regardless of key order, so a server echo of our own write is not seen as a change.
const stable = (v) => JSON.stringify(v, (_, x) =>
  (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

function onUser(user) {
  for (const off of stop) off();
  stop = [];
  data = empty();
  account.user = user ? { uid: user.uid, hasPassword: user.providerData.some((p) => p.providerId === 'password') } : null;
  account.pending = false;
  account.confirmed = false;
  account.ready = !user;
  if (!user) return onChange();

  const { db, f } = fb;
  const at = (...path) => ['users', user.uid, ...path];
  const loaded = {};
  const pending = {};
  let daysFromServer = false;
  const apply = (name, value, meta) => {
    if (name === 'days' && !meta.fromCache) daysFromServer = true;
    // An account is only believed to be empty once the server has said so. Offline or on a slow
    // line, a profile that is simply not on this phone yet must not start the setup screen, or
    // an upload of what an older copy of the app left on this device.
    const confirmedNow = name === 'profile' && !meta.fromCache && !account.confirmed;
    if (confirmedNow) account.confirmed = true;
    pending[name] = meta.hasPendingWrites;
    account.pending = Object.values(pending).some(Boolean);
    const first = !loaded[name];
    loaded[name] = true;
    // While our own writes are still on their way, memory is already right: leave it alone.
    // Not on the first load, though. Then memory is empty, and writes can still be waiting from
    // the last time the app was open (closed while offline). What arrives already includes them.
    const changed = (first || !meta.hasPendingWrites) && stable(data[name]) !== stable(value);
    if (changed) data[name] = value;
    const nowReady = first && Object.keys(loaded).length === 4;
    if (nowReady) account.ready = true;
    if (!account.ready) return hooks.status();
    // Both wait for the server's own word: an upload only into an account the server says is
    // empty, a backup only of days the server has sent.
    const uploaded = account.confirmed && daysFromServer && uploadDeviceData();
    if (daysFromServer) autoBackup(); // does nothing after the first one each day
    if (changed || nowReady || confirmedNow || uploaded) onChange();
    else hooks.status();
  };
  const fail = () => { account.error = 'The database refused the request. The security rules may not be published yet.'; account.ready = true; onChange(); };
  const opts = { includeMetadataChanges: true };
  const map = (snap) => { const out = {}; snap.forEach((d) => { out[d.id] = d.data(); }); return out; };
  stop = [
    f.onSnapshot(f.doc(db, ...at('meta', 'profile')), opts, (s) => apply('profile', s.exists() ? tidy({ profile: s.data() }).profile : null, s.metadata), fail),
    f.onSnapshot(f.doc(db, ...at('meta', 'plan')), opts, (s) => apply('plan', s.exists() ? s.data() : {}, s.metadata), fail),
    f.onSnapshot(f.collection(db, ...at('days')), opts, (s) => apply('days', tidy({ days: map(s) }).days, s.metadata), fail),
    f.onSnapshot(f.collection(db, ...at('foods')), opts, (s) => apply('foods', tidy({ foods: map(s) }).foods, s.metadata), fail),
  ];
}

// First login on a device that was already in use: carry its data up, once, if the account is empty.
// Empty means nothing at all. A profile that could not be read, with days behind it, is not empty,
// and uploading over it would replace those days.
function uploadDeviceData() {
  if (data.profile || !device.profile || Object.keys(data.days).length || Object.keys(data.foods).length) return false;
  data = structuredClone(device);
  write(['meta', 'profile'], data.profile);
  if (Object.keys(data.plan).length) write(['meta', 'plan'], data.plan);
  for (const [k, d] of Object.entries(data.days)) write(['days', k], d);
  for (const [id, food] of Object.entries(data.foods)) write(['foods', id], food);
  return true;
}

// Saves one document. A null value deletes it. JSON round trip drops undefined, which Firestore rejects.
// With `fields`, only those fields of the document are replaced and the rest are left alone, so
// two devices changing different things on the same day cannot wipe each other's work.
function write(path, value, fields) {
  if (!firebaseConfig) {
    if (readOnly) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage is full or blocked. Say so once: silently losing a day of logs is worse.
      account.error = 'This could not be saved on the device. Storage may be full or blocked. Use the backup file on the Progress screen.';
      hooks.status();
    }
    return;
  }
  if (!account.user) return;
  const ref = fb.f.doc(fb.db, 'users', account.user.uid, ...path);
  let job;
  if (value === null) job = fb.f.deleteDoc(ref);
  else {
    const clean = JSON.parse(JSON.stringify(value));
    if (fields) for (const k of fields) if (!(k in clean)) clean[k] = null;
    job = fields ? fb.f.setDoc(ref, clean, { mergeFields: fields }) : fb.f.setDoc(ref, clean);
  }
  job.catch(refused);
}
// A refused save is taken back out of the phone's copy too, so the message must not promise it is safe.
const refused = () => { account.error = 'The database refused the last save, so that change may not have been kept. Check that it is still there.'; hooks.status(); };

export const get = () => data;
export function setProfile(profile) {
  data.profile = { v: VERSION, ...profile };
  write(['meta', 'profile'], data.profile);
  onChange();
}
export function setPlan(patch) {
  data.plan = { ...data.plan, ...patch };
  write(['meta', 'plan'], firebaseConfig ? patch : data.plan, Object.keys(patch));
  onChange();
}
// quiet saves without redrawing the screen, for typing into a field that must keep focus.
export function setDay(key, patch, quiet = false) {
  data.days[key] = { ...data.days[key], ...patch };
  write(['days', key], firebaseConfig ? patch : data.days[key], Object.keys(patch));
  if (!quiet) onChange();
}
// Adds entries to a list kept on a day (the food log), or takes them out. In the cloud this is
// sent as "add these" or "remove these", never as the whole list, so two devices logging at the
// same time, or one that was offline, cannot wipe each other's entries.
// To remove, pass the entries as they are in memory: the database matches them whole.
export function changeList(key, field, items, remove = false) {
  if (!items.length) return;
  const now = data.days[key]?.[field] ?? [];
  const ids = new Set(items.map((x) => x.id));
  data.days[key] = { ...data.days[key], [field]: remove ? now.filter((x) => !ids.has(x.id)) : [...now, ...items] };
  if (firebaseConfig && account.user) {
    const change = (remove ? fb.f.arrayRemove : fb.f.arrayUnion)(...JSON.parse(JSON.stringify(items)));
    fb.f.setDoc(fb.f.doc(fb.db, 'users', account.user.uid, 'days', key), { [field]: change }, { merge: true }).catch(refused);
  } else write(['days', key], data.days[key]);
  onChange();
}
export function setFood(id, food) {
  if (food) data.foods[id] = food;
  else delete data.foods[id];
  write(['foods', id], food ?? null);
  onChange();
}

// Sign-in has to be a popup: the redirect method is broken on Safari for apps not on Firebase Hosting.
export async function signIn() {
  account.error = null;
  try {
    await fb.a.signInWithPopup(fb.auth, new fb.a.GoogleAuthProvider());
  } catch (e) {
    account.error = e?.code === 'auth/popup-blocked'
      ? 'The sign-in window was blocked. Allow pop-ups for this app and try again.'
      : 'Sign-in did not finish. Try again.';
    onChange();
  }
}
// Email and password sign-in. This is the one that works on an iPhone, in Safari and in the
// home screen app, because it needs no pop-up window. Returns null, or a sentence to show.
export async function signInEmail(email, password) {
  account.error = null;
  try {
    await fb.a.signInWithEmailAndPassword(fb.auth, email, password);
    return null;
  } catch (e) {
    if (e?.code === 'auth/too-many-requests') return 'Too many tries. Wait a few minutes, then try again.';
    if (e?.code === 'auth/network-request-failed') return 'No connection. Check the internet and try again.';
    return 'That email or password is not right.';
  }
}

// Adds a password to the account that is signed in, so the same account, with the same data,
// can also be opened with its email and that password. Returns null, or a sentence to show.
export async function addPassword(password) {
  const user = fb.auth.currentUser;
  if (!user?.email) return 'Sign in with Google first.';
  try {
    await fb.a.linkWithCredential(user, fb.a.EmailAuthProvider.credential(user.email, password));
    account.user = { ...account.user, hasPassword: true };
    onChange();
    return null;
  } catch (e) {
    if (e?.code === 'auth/provider-already-linked') return 'This account already has a password.';
    if (e?.code === 'auth/weak-password') return 'That password is too easy to guess. Use a longer one.';
    if (e?.code === 'auth/requires-recent-login') return 'For safety, sign out, sign in with Google again, then set the password straight away.';
    if (e?.code === 'auth/operation-not-allowed') return 'Email and password sign-in is not switched on in Firebase yet.';
    return 'The password could not be saved. Check the internet and try again.';
  }
}

// Signing out with unsynced entries could strand them on this phone, so it waits.
export function signOut() {
  if (account.pending) {
    account.error = 'Some entries have not synced yet. Go online, wait for "All synced", then sign out.';
    return hooks.status();
  }
  return fb.a.signOut(fb.auth);
}

// ----- Backups -----
// One whole-app copy a day, taken the first time the app opens that day, before anything is
// changed. They guard against a mistake or a bug, not against losing the account itself:
// for that, save a backup file now and then.

const KEEP_DAYS = 14;
const KEEP_ON_DEVICE = 3; // device storage is small, so fewer are kept there
const MAX_BACKUP_BYTES = 900000; // a Firestore document can hold about 1 MB
const BEFORE_RESTORE = 'before-restore';
const BACKUP_PREFIX = `${KEY}-backup-`;
const dayStamp = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);
const backupDoc = (id) => fb.f.doc(fb.db, 'users', account.user.uid, 'backups', id);

// ponytail: one copy is one database document, which holds about 1 MB. Months of logs fit. When
// they stop fitting the copy is refused out loud (TOO_BIG), never skipped in silence. The fix
// then is to split a copy across several documents.
const TOO_BIG = 'Your data has outgrown the automatic daily backups, so they have stopped. Save a backup file from the Progress screen now and then instead.';
let backupsOff = false; // set once a copy was too big, so it is not tried again on every sync
let backingUp = false; // a copy is being saved right now

async function saveBackup(id) {
  if (!data.profile || readOnly) return; // nothing worth keeping yet
  const json = JSON.stringify(data);
  // Counted in bytes, not characters: Arabic letters in a food name take two bytes each.
  const copy = { id, at: new Date().toISOString(), days: Object.keys(data.days).length, bytes: new TextEncoder().encode(json).length, json };
  if (firebaseConfig) {
    if (!account.user) return;
    if (copy.bytes > MAX_BACKUP_BYTES) throw new Error(TOO_BIG);
    await fb.f.setDoc(backupDoc(id), copy);
  } else {
    try { localStorage.setItem(BACKUP_PREFIX + id, JSON.stringify(copy)); } catch { /* full: the main data matters more */ }
  }
}

function autoBackup() {
  const today = dayStamp();
  let last = null;
  try { last = localStorage.getItem(`${KEY}-last-auto-backup`); } catch { /* storage blocked */ }
  if (last === today || !data.profile || backupsOff || backingUp) return;
  // One at a time. Several syncs can arrive before the first copy has landed, and offline it
  // does not land at all: without this, each of them would queue another whole copy.
  backingUp = true;
  saveBackup(today).then(() => {
    try { localStorage.setItem(`${KEY}-last-auto-backup`, today); } catch { /* storage blocked */ }
    // Drop copies that have aged out. Deleting one that is not there is harmless.
    if (firebaseConfig) {
      for (let i = KEEP_DAYS; i < KEEP_DAYS + 7; i++) fb.f.deleteDoc(backupDoc(dayStamp(Date.now() - i * 86400000))).catch(() => {});
    } else {
      const dated = Object.keys(localStorage).filter((k) => k.startsWith(BACKUP_PREFIX) && isKey(k.slice(BACKUP_PREFIX.length))).sort();
      for (const k of dated.slice(0, -KEEP_ON_DEVICE)) localStorage.removeItem(k);
    }
  }).catch((e) => {
    // A failed backup must never get in the way of using the app. One that can no longer be
    // made at all is said once, in the sync line, because a safety net must not vanish quietly.
    if (e?.message !== TOO_BIG) return;
    backupsOff = true;
    account.error = TOO_BIG;
    hooks.status();
  }).finally(() => { backingUp = false; });
}

// The copies that exist, newest first: [{ id, at, days, bytes, json }].
export async function listBackups() {
  const out = [];
  if (firebaseConfig) {
    const snap = await fb.f.getDocs(fb.f.collection(fb.db, 'users', account.user.uid, 'backups'));
    snap.forEach((d) => out.push({ ...d.data(), id: d.id }));
  } else {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(BACKUP_PREFIX)) continue;
      try { out.push(JSON.parse(localStorage.getItem(k))); } catch { /* skip a damaged copy */ }
    }
  }
  return out.filter((b) => b && typeof b.json === 'string').sort((a, b) => (a.at < b.at ? 1 : -1));
}

// Replaces everything in the app with `text` (a backup). What is there now is first kept
// as the "before restore" copy, so a restore can itself be undone.
// Returns { ok: true } or { error }.
export async function restore(text) {
  const read = readBackup(text);
  if (read.error) return read;
  if (readOnly) return { error: 'Refresh the app to update it first.' };
  // Offline, the database only queues the work: nothing would seem to happen, and then the
  // restore would go through by itself whenever the connection came back.
  if (firebaseConfig && !navigator.onLine) return { error: 'Restoring needs the internet. Go online, then try again.' };
  try {
    await saveBackup(BEFORE_RESTORE);
  } catch (e) {
    if (e?.message !== TOO_BIG) return { error: 'Could not keep a copy of what is here now, so nothing was changed. Check your connection and try again.' };
    // Too much for a copy in the database. A backup file saved today does the same job.
    let exported = null;
    try { exported = localStorage.getItem(`${KEY}-last-export`); } catch { /* storage blocked */ }
    if (exported !== dayStamp()) return { error: 'There is too much here to keep a copy of first, so nothing was changed. Save a backup file from the Progress screen, then restore again.' };
  }
  const next = read.data;
  if (firebaseConfig) {
    const { f, db } = fb;
    const at = (...path) => f.doc(db, 'users', account.user.uid, ...path);
    const jobs = [[at('meta', 'profile'), next.profile], [at('meta', 'plan'), next.plan]];
    for (const [k, d] of Object.entries(next.days)) jobs.push([at('days', k), d]);
    for (const k of Object.keys(data.days)) if (!next.days[k]) jobs.push([at('days', k), null]);
    for (const [id, food] of Object.entries(next.foods)) jobs.push([at('foods', id), food]);
    for (const id of Object.keys(data.foods)) if (!next.foods[id]) jobs.push([at('foods', id), null]);
    try {
      // In groups, each of which lands whole or not at all.
      for (let i = 0; i < jobs.length; i += 400) {
        const batch = f.writeBatch(db);
        for (const [ref, value] of jobs.slice(i, i + 400)) {
          if (value === null) batch.delete(ref);
          else batch.set(ref, JSON.parse(JSON.stringify(value)));
        }
        await batch.commit();
      }
    } catch {
      return { error: 'The restore did not finish. Your "before restore" copy is safe. Check your connection and try again.' };
    }
  }
  data = next;
  if (!firebaseConfig) write();
  // What is here now may be small enough to back up again.
  backupsOff = false;
  if (account.error === TOO_BIG) account.error = null;
  onChange();
  return { ok: true };
}
