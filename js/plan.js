// The plan template. Everything here becomes editable in Settings later,
// so nothing in the UI code should hardcode these values.

export const plan = {
  start: '2026-10-08',
  end: '2027-03-23', // where the plan line and the calendar stop
  utcOffsetHours: 3, // Asia/Kuwait
  rolloverHour: 4,
  weekStartDow: 4, // Thursday

  phases: [
    { name: 'Foundation phase', start: '2026-10-08', end: '2026-10-28' },
    { name: 'Build phase', start: '2026-10-29', end: '2026-12-09' },
    { name: 'Deload week', start: '2026-12-10', end: '2026-12-16' },
    { name: 'Push phase', start: '2026-12-17', end: '2027-01-27' },
    { name: 'Diet break and deload', start: '2027-01-28', end: '2027-02-10' },
    { name: 'Finish phase', start: '2027-02-11' },
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
};
