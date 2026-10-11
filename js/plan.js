// The plan template. Everything here becomes editable in Settings later,
// so nothing in the UI code should hardcode these values.

export const plan = {
  start: '2026-10-08',
  end: '2027-03-23', // where the plan line and the calendar stop
  utcOffsetHours: 3, // Asia/Kuwait
  rolloverHour: 4,
  weekStartDow: 4, // Thursday

  // load and rir drive the Workout screen: 'ramp' eases in, 'half' halves the sets.
  // maintenance marks a phase with no deficit, where the weight plan line goes flat.
  // sets, effort, food and why are the words shown in the guide.
  phases: [
    {
      name: 'Foundation phase', start: '2026-10-08', end: '2026-10-28', load: 'ramp', rir: [2, 3], rirFirstWeek: [3, 4],
      sets: '2 sets per exercise in the first week. After that, the full sets on main lifts and 2 sets on isolation work.',
      effort: '3 to 4 reps in reserve at first, then 2 to 3.',
      food: 'Your normal deficit target.',
      why: 'A ramp back in. Learn the exercises, find your working weights, avoid crippling soreness and build the gym habit. Pick a weight where the first set leaves 3 or 4 reps in the tank. No ego lifting here.',
    },
    {
      name: 'Build phase', start: '2026-10-29', end: '2026-12-09', load: 'full', rir: [1, 3], rirLastIso: [0, 1],
      sets: 'The full sets as listed.',
      effort: '1 to 3 reps in reserve. The last set of an isolation exercise can go to 0 or 1.',
      food: 'Your normal deficit target.',
      why: 'Progressive overload every week using the jump rule. Write every set down. Most of the progress is made here.',
    },
    {
      name: 'Deload week', start: '2026-12-10', end: '2026-12-16', load: 'half', rir: [4, 4],
      sets: 'About half the sets, at the same weights.',
      effort: '4 reps in reserve.',
      food: 'Your normal deficit target.',
      why: 'Lets fatigue drop so you come back stronger. It will feel too easy, and that is the point. Do not add work to make it feel like a real session.',
    },
    {
      name: 'Push phase', start: '2026-12-17', end: '2027-01-27', load: 'full', rir: [0, 2], extraSet: true,
      sets: 'The full sets, plus 1 extra set for two lagging muscles (usually side delts and calves, or chest).',
      effort: '0 to 2 reps in reserve.',
      food: 'Your deficit target, adjusted by the stall check.',
      why: 'The hardest block, with the highest weekly volume. Sleep and food matter most here.',
    },
    {
      name: 'Diet break and deload', start: '2027-01-28', end: '2027-02-10', load: 'half', rir: [3, 4], maintenance: true,
      sets: 'About half the sets.',
      effort: '3 to 4 reps in reserve.',
      food: 'Maintenance calories. The extra comes mostly from carbs: roti, rice and fruit.',
      why: 'A mental and physical reset after months in a deficit. It can be moved to cover your heaviest exam fortnight: change its date in Settings, under Plan dates.',
    },
    {
      name: 'Finish phase', start: '2027-02-11', load: 'full', rir: [1, 3],
      sets: 'Repeats the Build phase, then the Push phase.',
      effort: '1 to 3 reps in reserve.',
      food: 'Back to a deficit, recalculated for your new weight.',
      why: 'The final stretch of fat loss down to your goal.',
    },
  ],

  cycle: ['upperA', 'lowerA', 'upperB', 'lowerB'],
  weekdays: { 4: 'upperA', 6: 'lowerA', 0: 'upperB', 2: 'lowerB' },

  sessions: {
    upperA: { name: 'Upper A', short: 'Up A', about: 'Back and triceps', exercises: 8, minutes: 70 },
    lowerA: { name: 'Lower A', short: 'Low A', about: 'Legs with a quad focus, plus abs', exercises: 7, minutes: 65 },
    upperB: { name: 'Upper B', short: 'Up B', about: 'Chest, shoulders and biceps', exercises: 9, minutes: 75 },
    lowerB: { name: 'Lower B', short: 'Low B', about: 'Hamstrings, glutes, calves, abs and forearms', exercises: 8, minutes: 70 },
  },

  steps: { from: 5000, weeklyAdd: 1000, target: 8000 },

  // The dumbbells at the gym, lightest first. A dumbbell lift jumps to the next one up.
  dumbbells: [5, 7, 7.5, 8, 10, 12.5, 15, 17.5, 20],

  // In a phase marked extraSet, two of these get one more set a week. Each names the one
  // lift, in one session, that takes the set.
  extraSetChoices: {
    'Side delts': { session: 'upperB', lift: 'lateral-raise' },
    Calves: { session: 'lowerA', lift: 'standing-calf-raise' },
    Chest: { session: 'upperB', lift: 'chest-press' },
  },

  // Progress photos: the first reminder, then every so many days.
  photos: { first: '2026-10-22', everyDays: 14 },
};
