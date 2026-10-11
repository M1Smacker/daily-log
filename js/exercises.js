// The four sessions, in the order the lifts are done. The first three of each are the minimum session.
//
// kind sets the jump: 'barbell' (also the Smith machine) goes up 2.5 kg, 'machine' (also cables)
// goes up one 5 kg step, 'dumbbell' goes to the next dumbbell on the list in plan.js,
// 'body' has no weight and only progresses in reps.
// main marks the compound lifts that get their full sets after the first Foundation week.
// rest is in seconds, as [from, to]. A lift that appears in two sessions shares one id, so its
// history carries across.

const ex = (id, name, sets, reps, rest, kind, main, alt, note = '', per = '') =>
  ({ id, name, sets, reps, rest, kind, main, alt, note, per });

export const sessions = {
  upperA: [
    ex('lat-pulldown', 'Lat pulldown', 3, [8, 12], [120, 180], 'machine', true, 'Slow negative pull-ups, 3 sets of 3 to 5', 'Medium-wide overhand grip.'),
    ex('chest-supported-row', 'Chest-supported incline dumbbell row', 3, [8, 12], [120, 120], 'dumbbell', true, 'Smith machine bent-over row', 'Bench at 30 to 45 degrees, elbows about 45 degrees out.'),
    ex('single-arm-row', 'Single-arm dumbbell row', 2, [10, 12], [90, 90], 'dumbbell', true, 'Seated cable row, single handle', 'Knee on the bench, big stretch at the bottom.', 'per side'),
    ex('reverse-pec-deck', 'Reverse pec deck', 3, [12, 20], [90, 90], 'machine', false, 'Chest-supported dumbbell reverse fly on the incline bench'),
    ex('smith-incline-press', 'Smith machine incline press', 2, [8, 10], [120, 120], 'barbell', true, 'Incline dumbbell press', 'Bench at about 30 degrees.'),
    ex('overhead-triceps', 'Overhead cable triceps extension', 3, [10, 15], [90, 90], 'machine', false, 'Seated two-hand dumbbell overhead extension', 'With the rope.'),
    ex('dip-machine', 'Dip machine', 2, [8, 12], [90, 90], 'machine', true, 'Dip station, upright torso'),
    ex('lateral-raise', 'Dumbbell lateral raise', 2, [12, 20], [60, 90], 'dumbbell', false, 'Single-arm cable lateral raise'),
  ],
  lowerA: [
    ex('back-squat', 'Barbell back squat', 3, [6, 10], [180, 180], 'barbell', true, 'Smith machine squat, feet slightly forward', 'Power rack, safeties just below the bottom.'),
    ex('leg-press', 'Leg press', 3, [10, 15], [120, 120], 'machine', true, 'Dumbbell goblet squat', 'Feet shoulder width, mid platform.'),
    ex('leg-extension', 'Leg extension', 3, [10, 15], [90, 90], 'machine', false, '', 'Seat reclined as far as it goes. No good alternative, so keep it.'),
    ex('leg-curl', 'Leg curl', 3, [10, 12], [90, 90], 'machine', false, 'Dumbbell lying leg curl', 'Seated if the machine is a seated one.'),
    ex('standing-calf-raise', 'Standing calf raise', 3, [8, 12], [90, 90], 'machine', false, 'Leg press calf raise, knees straight', '2 second pause at the bottom.'),
    ex('ab-wheel', 'Ab wheel rollout', 3, [6, 12], [90, 90], 'body', false, 'Long-lever plank, 3 sets of 30 to 45 seconds', 'From the knees.'),
    ex('reverse-crunch', 'Reverse crunch', 2, [10, 15], [60, 60], 'body', false, 'Lying leg raise on the bench', 'On the ab bench.'),
  ],
  upperB: [
    ex('incline-db-press', 'Incline dumbbell press', 3, [8, 12], [120, 180], 'dumbbell', true, 'Smith machine incline press', 'Bench at 30 degrees.'),
    ex('chest-press', 'Chest press machine', 3, [8, 12], [120, 120], 'machine', true, 'Flat dumbbell press'),
    ex('pec-deck', 'Pec deck fly', 2, [12, 15], [90, 90], 'machine', false, 'Cable crossover, mid height', 'Controlled stretch.'),
    ex('cable-row', 'Seated cable row', 3, [10, 12], [120, 120], 'machine', true, 'Chest-supported dumbbell row', 'Neutral grip, let the shoulders reach forward.'),
    ex('shoulder-press', 'Shoulder press machine', 2, [8, 12], [120, 120], 'machine', true, 'Seated dumbbell shoulder press'),
    ex('lateral-raise', 'Dumbbell lateral raise', 3, [12, 20], [60, 90], 'dumbbell', false, 'Cable lateral raise', 'Slight lean forward.'),
    ex('incline-curl', 'Incline dumbbell curl', 3, [8, 12], [90, 90], 'dumbbell', false, 'Bayesian cable curl, facing away', 'Bench at 45 to 60 degrees.'),
    ex('hammer-curl', 'Hammer curl', 2, [10, 12], [60, 90], 'dumbbell', false, 'Rope cable hammer curl'),
    ex('spider-curl', 'Dumbbell spider curl', 2, [10, 15], [60, 60], 'dumbbell', false, 'Preacher-style dumbbell curl over the back of the incline bench', 'Chest against the incline bench.'),
  ],
  lowerB: [
    ex('romanian-deadlift', 'Barbell Romanian deadlift', 3, [6, 10], [120, 180], 'barbell', true, 'Dumbbell Romanian deadlift'),
    ex('split-squat', 'Bulgarian split squat', 3, [8, 12], [120, 120], 'dumbbell', true, 'Dumbbell walking lunges', 'With dumbbells.', 'per leg'),
    ex('hip-thrust', 'Barbell hip thrust', 3, [8, 12], [120, 120], 'barbell', true, 'Smith machine hip thrust', 'Upper back on the flat bench.'),
    ex('leg-curl', 'Leg curl', 3, [10, 15], [90, 90], 'machine', false, 'Dumbbell lying leg curl'),
    ex('bent-knee-calf-raise', 'Bent-knee calf raise', 3, [12, 20], [60, 90], 'dumbbell', false, 'Smith machine seated calf raise, bar padded', 'Seated, weight on the knees, toes on a plate.'),
    ex('cable-woodchop', 'Cable woodchop', 2, [10, 12], [60, 60], 'machine', false, 'Side plank, 2 sets of 30 to 45 seconds a side', 'High to low.', 'per side'),
    ex('wrist-curl', 'Dumbbell wrist curl', 2, [15, 20], [60, 60], 'dumbbell', false, 'Barbell wrist curls', 'Superset with the reverse wrist curl.', 'each'),
    ex('shrug', 'Dumbbell shrug', 2, [10, 15], [60, 90], 'dumbbell', false, 'Smith machine shrug', '1 second hold at the top.'),
  ],
};

// The muscle each lift works most directly. The Coach counts direct weekly sets with it. It is a
// constant here, not stored data. A swapped lift keeps the muscle of the lift it replaced.
export const MUSCLE = {
  'lat-pulldown': 'lats', 'chest-supported-row': 'mid back', 'single-arm-row': 'lats', 'reverse-pec-deck': 'rear delts',
  'smith-incline-press': 'chest', 'overhead-triceps': 'triceps', 'dip-machine': 'chest', 'lateral-raise': 'side delts',
  'back-squat': 'quads', 'leg-press': 'quads', 'leg-extension': 'quads', 'leg-curl': 'hamstrings',
  'standing-calf-raise': 'calves', 'ab-wheel': 'abs', 'reverse-crunch': 'abs',
  'incline-db-press': 'chest', 'chest-press': 'chest', 'pec-deck': 'chest', 'cable-row': 'mid back',
  'shoulder-press': 'front delts', 'incline-curl': 'biceps', 'hammer-curl': 'biceps', 'spider-curl': 'biceps',
  'romanian-deadlift': 'hamstrings', 'split-squat': 'quads', 'hip-thrust': 'glutes',
  'bent-knee-calf-raise': 'calves', 'cable-woodchop': 'abs', 'wrist-curl': 'forearms', 'shrug': 'traps',
};
export const muscleOf = (id) => MUSCLE[String(id).split('~')[0]];

// A lift's name from its id. A swapped lift's id is the original id, then '~', then its own name.
const NAMES = Object.fromEntries(Object.values(sessions).flat().map((e) => [e.id, e.name]));
export const liftName = (id) => NAMES[id]
  ?? (String(id).includes('~') ? String(id).split('~')[1].replace(/-/g, ' ').replace(/^./, (ch) => ch.toUpperCase()) : String(id));

// A lift your gym does not have can be swapped for another one (plan.swaps, set from the Workout
// screen). The swap keeps the place, sets and reps, but gets its own id so its weights start fresh.
export const KINDS = { barbell: 'Barbell or Smith machine', machine: 'Machine or cable', dumbbell: 'Dumbbells', body: 'Bodyweight' };
export const swapId = (id, name) => `${id}~${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
export const withSwaps = (list, swaps = {}) => list.map((ex) => {
  const s = swaps[ex.id];
  return s && KINDS[s.kind] && s.name
    ? { ...ex, id: swapId(ex.id, s.name), base: ex.id, name: s.name, kind: s.kind, alt: '', note: `In place of: ${ex.name}.` }
    : ex;
});
// A first guess at what the listed alternative uses, from its name. It can be changed before saving.
export const altKind = (alt) =>
  (/smith|barbell/i.test(alt) ? 'barbell' : /dumbbell/i.test(alt) ? 'dumbbell' : /cable|machine|leg press/i.test(alt) ? 'machine' : 'body');
