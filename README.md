# Daily log

A personal tracker for food, training, weight, steps and water. Plain HTML, CSS and JavaScript modules, no build step. It installs to a phone's home screen and works offline.

## Run it

```bash
python _devserver.py 8794
```

Then open http://localhost:8794

Two things help while testing:

- `?today=2026-11-03` in the address shows the app as if it were that date.
- `?sw` turns the offline service worker on. It is off on localhost so old code is never served from a cache.

## Test the rules

```bash
node --test
```

## Where things live

- `js/plan.js` is the plan template: phases, sessions, training days, step ramp, dumbbell list.
- `js/exercises.js` is the four sessions and their lifts. `js/foods.js` is the preloaded food list. `js/guide.js` is the guide text.
- `js/rules.js` holds every rule as a pure function (day rollover, schedule and missed days, jump rule, stall check, macro maths). Tests are in `tests/`.
- `js/store.js` is where data is saved. `js/state.js` turns it into what the screens need.
- `js/today.js`, `js/workout.js`, `js/food.js`, `js/progress.js`, `js/settings.js` are the screens. `js/app.js` is the shell around them.
- `css/app.css` has the colour tokens at the top.
- `sw.js` is the offline shell. `firestore.rules` is the database security.

## Edit the plan

Change `js/plan.js` for phase dates, training days or the step ramp, and `js/exercises.js` for lifts, sets, rep ranges and alternatives. Targets and personal numbers are never in this repository: they are typed into the app and stored with the user's own data.

## Release a change

1. Bump `VERSION` in both `sw.js` and `js/version.js` (a test fails if they differ).
2. If a file was added, add it to `SHELL` in `sw.js` (a test fails if one is missing).
3. Run `node --test`, then push. GitHub Pages serves the new files, and the app shows "Update available".

## Data and login

With `js/firebase-config.js` set to `null` the app saves on the device only. With a Firebase web config in that file it asks for a Google login and keeps the data in Firestore, with an offline copy on the phone. The config is public by design. Privacy comes from `firestore.rules`, which must be published with the owner's user id filled in.

## Back up

Progress, then Your data: "Backup file" saves everything as JSON, "Spreadsheet" saves one row per day as CSV.
