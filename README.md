# Daily log

A personal tracker for food, training, weight, steps and water. Plain HTML, CSS and JavaScript modules, no build step.

## Run it

```bash
python _devserver.py 8794
```

Then open http://localhost:8794

## Test the rules

```bash
node --test
```

## Where things live

- `js/plan.js` is the plan template: phases, sessions, training days, step ramp.
- `js/rules.js` holds the pure rules (day rollover, phase by date, week strip, next session). Tests are in `tests/`.
- `js/sample.js` is made-up data for the screens until real storage is added.
- `css/app.css` has the colour tokens at the top.

Deploy and backup notes will be added when those parts exist.
