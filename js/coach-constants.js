// Every number the Coach uses, in one place. Change a threshold here and nowhere else.
// "Study" numbers come from the research file, "judgement" numbers are choices made when the
// Coach was written. None of them is a personal number: bands are offsets from your own targets.

import {
  EXTRA_REPS, KCAL_FLOOR, FAT_FLOOR, WARMUP_SHARE, STALL_CUT_KCAL, STALL_ADD_STEPS, FAST_PCT,
} from './rules.js';

// The safety rails. The Coach cannot return an action that breaks one of these.
export const RAILS = Object.freeze({
  kcalFloor: KCAL_FLOOR, // study: deficit size
  fatFloorG: FAT_FLOOR, // plan: fat floor
  maxLossKgPerWeek: 1, // study: rate of loss
  neverCut: Object.freeze(['protein']),
});

export const LIFT = Object.freeze({
  aboveMargin: EXTRA_REPS, // judgement: the same 3 as the extra-reps rule in the jump rule
  nearBelow: 2, // judgement: 1 to 2 under the range is a note, 3 or more is a watch
  warmupShare: WARMUP_SHARE, // judgement: a set under 70% of the heaviest is a warm-up
});

export const SETS = Object.freeze({
  extraNoteAt: 2, // judgement: one extra set is fine, two or more is a note
  weeklyCeiling: 20, // study: dose-response, direct sets per muscle per week
  shortFlagAt: 2, // judgement: two or more short is said in other words
  minimumLifts: 3, // plan: the Minimum session is the first three lifts
});

export const DAY = Object.freeze({
  judgeMinKcal: 1200, // judgement: under this the log is probably incomplete
  judgeMinMeals: 2,
  onTargetBelow: 250, // judgement: T minus 250 up to T plus 150 is on target
  onTargetAbove: 150,
  bigOver: 400, // judgement: more than T plus 400 is a big day
  proteinGoodBelowTarget: 15, // plan: acceptable range starts 15 g under the target
  proteinLowBelowTarget: 45, // judgement: under 45 g below the target is a watch
  kcalPerKgFat: 7700, // study: about 7,700 kcal per kg of body fat
  eveningHour: 19, // judgement: one protein reminder is allowed from 7 pm
  eveningProteinShare: 0.6, // judgement: under 60% of the protein target by then
  breakMinOver: 300, // judgement: eating this far over the deficit target is break eating
});

export const WEEK = Object.freeze({
  weighIns: 4, // judgement: a week's average needs this many mornings
  averages: 3, // judgement: three usable weeks for any weight verdict
  fastAverages: 2, // judgement: "too fast" is a safety check, so two weeks are enough
  judgeableDays: 4, // judgement: any food verdict needs this many judgeable days
  settledDays: 5, // judgement: "stalled", "above target" need this many
  floorDays: 3, // plan: three days under the floor is a pattern
  fastPct: FAST_PCT, // study: Garthe, above this share of bodyweight a week is too fast
  onPacePct: 0.5, // judgement
  slowPct: 0.2, // judgement
  risingPct: 0.5, // judgement
  aboveTargetOver: 150, // judgement
  stallWithin: 150, // judgement
  windowStartDays: 14, // plan: the first weeks drop extra water
  windowAfterBreakDays: 7, // judgement
  windowCreatineDays: 10, // judgement: creatine holds some water early
  recompWaistCm: 1, // judgement: tape error is about 1 cm
  recompLiftsUp: 0.5, // judgement
  addKcalWhenFast: 150, // plan: stall rule size
  cutKcal: STALL_CUT_KCAL, // plan: stall rule
  addSteps: STALL_ADD_STEPS, // plan: stall rule
});

export const LINES = Object.freeze({
  kcalNoteOver: 300, // judgement: F2 note up to this far over the target, watch beyond
  proteinGoodBelowTarget: 15,
  proteinLowBelowTarget: 45,
  fibreNoteUnder: 24, // plan: 30 to 38, judgement for 24
  waterMinDays: 4,
  stepsMinDays: 4,
  stepsLowShare: 0.8, // judgement: A5 fires under 80% of the ramp target
  sessionsGood: 3, // plan: 2 to 3 is the floor
  sessionsNote: 2,
  waistChangeCm: 1,
  planLineGood: 1.0, // judgement: within this many kg of the plan line is good
  planLineAheadNote: 1.5,
  liftsDownNote: 2,
  liftsDownWatch: 3,
});

// The Coach's briefing: how much it may say, and what has to be true before it says it.
export const BRIEF = Object.freeze({
  maxWords: 80, // the whole briefing
  maxSentenceWords: 20,
  caps: Object.freeze({ where: 3, well: 2, fix: 3, next: 2 }), // sentences. The fix may add a 1-sentence tail
  liftNames: 2, // lift names in the whole briefing
  planLineKg: 1.0, // the plan line is mentioned from this far off it
  minLifts: 3, // repeated lifts before a lift sentence can speak
  bigPictureEvery: 4, // completed weeks between "since the start" sentences
  waistSinceDays: 14, // two waist readings at least this far apart for "since the start"
  staleWeeks: 2, // praise shown in this many earlier briefings rotates out
  foodDaysGood: 6, // food logged on this many days is worth saying
  needsFoodDays: 5, // what a read needs after a week with gaps
  needsWeighIns: 4,
});

// A rule can only suggest an action that keeps these. withinRails() is checked on every action
// the week check returns, and a test proves it.
export function withinRails(action) {
  if (!action) return true;
  if (typeof action.newKcalTarget === 'number' && action.newKcalTarget < RAILS.kcalFloor) return false;
  if (typeof action.lossKgPerWeek === 'number' && action.lossKgPerWeek > RAILS.maxLossKgPerWeek) return false;
  if (Array.isArray(action.cuts) && action.cuts.some((c) => RAILS.neverCut.includes(c))) return false;
  if (typeof action.newFatG === 'number' && action.newFatG < RAILS.fatFloorG) return false;
  return true;
}
