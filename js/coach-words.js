// The Coach's wording: one lookup from rule code to sentence. Nothing else in the app writes
// Coach sentences, and the rules never read them, so wording can change without touching a rule.
//
// Voice: a calm training partner who has read the log. Good news first, one thing to do, never
// guilt. Plain short sentences, British spelling, no dashes, numbers with units. Never used:
// should, must, failed, lazy, cheated, bad, behind, "you need to". A test checks this file.

import { DAY } from './coach-constants.js';

const k = (n) => Math.round(n).toLocaleString('en-GB');
const dec = (n, d = 1) => Number(n).toFixed(d).replace(/\.0+$/, '');
const abs = Math.abs;
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayName = (key) => NAMES[new Date(`${key}T00:00:00Z`).getUTCDay()];
const dateText = (key) => {
  const d = new Date(`${key}T00:00:00Z`);
  return `${NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const kg = (n) => `${dec(n, 1)} kg`;

export const LIFT_NOTE = 'Judged from reps and weight only.';
const FIRST = ' First time on this one, so this is your starting point.';
const range = (n) => `${n.lo} to ${n.hi}`;

const reps = ([a, b]) => (a === b ? `about ${a}` : `${a} to ${b}`);

// One sentence on when the weight goes up, built only from what the jump rule said.
function goingUp(n) {
  if (n.jump === 'jump' && n.next) return `Every planned set got there, so next time is ${kg(n.next)}.`;
  if (n.jump === 'cap') return 'This is your heaviest, so the weight stays.';
  return n.big
    ? `The next step up is a big one, so the weight goes up once every set gets to ${n.goal}.`
    : `The weight goes up once every set gets to ${n.goal}.`;
}

// Each entry is (n, ctx) => sentence. ctx carries what the rule does not know: the day's
// name, the day's date and so on, supplied by the screen.
export const WORDS = {
  // ----- Lift check -----
  // What is said about going up comes from the jump rule: n.jump is what the next sheet will do,
  // n.goal the reps every planned set has to reach, n.big whether the step up is a big one.
  L1: (n) => `Good news: you had more in you. ${n.F} reps is well above ${range(n)}. ${goingUp(n)}${n.first ? FIRST : ''}`,
  L2: (n) => `Top of the range on set 1. ${goingUp(n)}${n.first ? FIRST : ''}`,
  L3: (n) => `Right weight. ${n.F} reps sits inside ${range(n)}.${n.jump === 'jump' || (n.jump === 'extra' && n.F >= n.hi) ? ` ${goingUp(n)}` : ''}${n.first ? FIRST : ''}`,
  L4: (n) => (n.opener
    ? `Set 1 at ${kg(n.at)} was a little heavy: ${n.F} reps against ${range(n)}. Your other sets were at ${kg(n.kg)}, and the sheet stays there for now.`
    : `A little heavy: ${n.F} reps against ${range(n)}. Keep this weight and build the reps.${n.first ? FIRST : ''}`),
  L5: (n) => (n.opener
    ? `Set 1 at ${kg(n.at)} was too heavy for ${range(n)}: ${n.F} reps. Start at ${kg(n.kg)} next time, the weight most of your sets used.`
    : `Too heavy for ${range(n)}: ${n.F} reps. ${n.prev
      ? `Use ${kg(n.prev)} next time so set 1 lands inside the range.`
      : 'Go a little lighter next time so set 1 lands inside the range.'}${n.first ? FIRST : ''}`),
  L6a: () => 'Top of the range on your heaviest dumbbell. The weight stays. To keep it hard, take 3 seconds to lower it.',
  L6b: (n) => `You have outgrown the dumbbells for this lift. Next time ${n.hasAlt
    ? 'try the alternative listed for it.'
    : 'slow the lowering to 3 or 4 seconds.'}`,
  L7: (n) => ({
    above: `Good news: you had more in you. ${n.F} reps is well above ${range(n)}. Add weight, or lower slowly.`,
    top: 'Top of the range on set 1. If every set gets there, add weight or lower slowly.',
    in: `Right place. ${n.F} reps sits inside ${range(n)}.`,
    near: `A little hard: ${n.F} reps against ${range(n)}. Keep building the reps.`,
    far: `Too hard for ${range(n)}: ${n.F} reps. Make it a little easier next time so set 1 lands inside the range.`,
  }[n.band] + (n.first ? FIRST : '')),
  L8: () => 'This lift has gone down two sessions in a row. Check sleep and food first, then an early deload.',
  L9: (n) => `Effort for this phase: leave ${reps(n.effort)} reps in the tank.`,
  LD: (n) => `Deload: the weight stays and you stop ${n.effort ? `${reps(n.effort)} reps` : 'well'} short on purpose, so there is nothing to judge here.`,

  // ----- Sets check -----
  S2: () => 'One extra set is fine. If you are still sore after 2 days, stick to the plan next time.',
  S3: () => 'That is more than the plan asks. This phase eases you in while you eat in a deficit, so extra sets mostly buy soreness.',
  S4: () => 'One extra set is fine.',
  S5: () => 'Two extra sets is past where more helps. In a deficit, recovery is the limit.',
  S6: (n) => `${n.muscle[0].toUpperCase()}${n.muscle.slice(1)} has ${n.n} sets this week. That is past the range the research supports. Trim next week.`,
  S7: () => 'This week is for recovering. The extra set takes some of that back.',
  S8: () => 'A deload keeps the same weights.',
  S9: (n) => (n.short === 1
    ? 'One set short. Fine on a tired day. The weight holds until every planned set is done.'
    : `${n.short} sets short on this lift. On a short day the Minimum session is built for this.`),
  S10: () => 'That looks like a Minimum session. Mark it Minimum so the count stays right.',
  S11: (n) => `${n.n} lifts have no sets. Add them, or mark the session Minimum.`,

  // ----- Day check -----
  D0: (n, ctx = {}) => (n.entries === 0
    ? `Nothing was logged for ${ctx.dayName ?? 'that day'}, so it is not counted in your weekly average.`
    : `Not enough logged to judge ${ctx.dayName ?? 'that day'} (${k(n.kcal)} kcal, ${n.meals} meal${n.meals === 1 ? '' : 's'}). It is not counted in your weekly average.`),
  D1: (n) => `On target: ${k(n.kcal)} of ${k(n.T)} kcal.`,
  D2: (n) => `${k(n.under)} kcal under target. Fine now and then.`,
  D3: (n) => `Under your ${k(n.floor)} kcal floor. If food is missing, add it. If not, eat a little more tomorrow, not less.`,
  D4: (n) => `${k(n.over)} over target. That is about ${dec(n.fatKg, 2)} kg of fat, and the weekly average is what counts. Carry on as normal, no catching up.`,
  D5: (n) => `Big day: ${k(n.over)} over. Back to target tomorrow.`,
  DB: (n) => `Diet break day: ${k(n.kcal)} kcal. ${n.kcal >= n.T
    ? 'Eating above your usual target is the point of these two weeks.'
    : 'A break works at about maintenance, a few hundred above your usual target.'}`,
  D6: (n, ctx) => ((ctx?.level ?? 'good') === 'good' ? `Protein ${k(n.g)} g, in range.`
    : ctx.level === 'note' ? `Protein ${k(n.g)} g, a little under ${k(n.goodAt)}.`
      : `Protein ${k(n.g)} g. Aim for ${k(n.goodAt)} or more tomorrow.`),
  D6u: (n) => (n.atLeast <= 0
    ? "No protein is listed for these foods, so I can't judge it."
    : `At least ${k(n.atLeast)} g of protein. Some foods have no protein listed, so I can't judge it fully.`),
  D7: (n) => `Fat was ${k(n.g)} g, under your ${k(n.floor)} g floor.`,
  D8: () => 'Step target hit.',
  D9: (n) => `${k(n.g)} g of protein still to go, with ${k(n.kcalLeft)} kcal left.`,

  // ----- Week check: the verdict -----
  W0: (n) => `Your first full week ends on ${dateText(n.first)}. The first weekly check comes the day after.`,
  W1: (n) => `Food was under your ${k(n.floor)} kcal floor on ${n.days} days of that week.`,
  W2: (n) => `Down ${dec(n.rate1 ?? n.rate, 1)}% a week, which is faster than is safe for keeping muscle.`,
  W3: (n) => (n.kcal >= n.T + DAY.breakMinOver && n.enough
    ? 'Diet break week, and food is up where it belongs. Steady or up 0.5 to 1 kg is normal here. Weight verdicts resume after the break.'
    : 'Diet break week. A break only works at about maintenance, a few hundred kcal above your usual target. Steady or up 0.5 to 1 kg is normal here. Weight verdicts resume after the break.'),
  W4: (n) => `${{
    start: 'Early weight change is mostly water, so there is no weight verdict yet.',
    break: 'Weight is settling after the diet break, so there is no weight verdict yet.',
    creatine: 'Creatine holds a little water in the first weeks, so there is no weight verdict yet.',
  }[n.why]} The first one can come on ${dateText(n.until)}, if you weigh in on ${n.needed} or more mornings a week until then.`,
  W5: (n) => `No weight verdict yet. I need weigh-ins on ${n.needed} or more mornings in each of 3 weeks. I have ${n.counts[0]}, ${n.counts[1]} and ${n.counts[2]}.`,
  W6: (n) => `Scale flat, waist down ${dec(abs(n.waistCm), 1)} cm, ${n.up} of ${n.total} lifts up. Leave everything alone for another week.`,
  W7: (n) => `Food averaged ${k(n.kcal)} kcal from ${n.days} days, above your ${k(n.T)} target.`,
  W8: (n) => `The scale has been flat for 2 weeks while food sat on target (${k(n.kcal)} kcal from ${n.days} days).`,
  W8a: (n) => `The scale is flat, but food was logged enough on only ${n.days} days, so I can't tell why.`,
  W8b: (n) => `The scale is flat while food averaged ${k(n.kcal)} kcal from ${n.days} days, under your ${k(n.T)} target. That usually means some food is missing from the log.`,
  W8c: (n) => `The scale is flat, and you changed your calorie target on ${dateText(n.since)}.`,
  W9: (n) => `The weight average is up ${dec(abs(n.rate1 ?? n.rate), 1)}% a week.`,
  // A food average is only quoted when enough days could be judged (n.kcal is null otherwise).
  W10: (n) => `Slow but moving: down ${dec(n.rate1 ?? n.rate, 1)}% a week.${n.kcal === null ? '' : ` Food averaged ${k(n.kcal)} kcal from ${n.days} days.`}`,
  W11: (n) => `On pace. Your 7-day average is down ${dec(n.rate1 ?? n.rate, 1)}% a week over 2 weeks. ${n.kcal === null
    ? `You did ${n.sessions} of ${n.of} sessions.`
    : `Food averaged ${k(n.kcal)} kcal from ${n.days} days and you did ${n.sessions} of ${n.of} sessions.`} Nothing to change.`,

  // ----- Week check: lines under the verdict -----
  F0: (n) => `Your calorie target is ${k(n.T)} kcal, under the ${k(n.floor)} floor. Raise it to ${k(n.floor)} or more in Settings. Everything here is measured against ${k(n.floor)}.`,
  F1: (n) => (n.band
    ? `Weight: 7-day average ${kg(n.avg)}, ${{
      pace: 'on pace',
      slow: 'slow',
      flat: 'flat',
      fast: 'too fast',
      rising: 'rising',
    }[n.band]} (${n.rate >= 0 ? 'down' : 'up'} ${dec(abs(n.rate1 ?? n.rate), 1)}% a week).`
    : `Weight: average ${kg(n.avg)} from ${n.weighIns} weigh-in${n.weighIns === 1 ? '' : 's'} that week. Too early to name a pace.`),
  F2: (n) => (n.kcal == null
    ? `Food: enough was logged on ${n.days} day${n.days === 1 ? '' : 's'} of that week, which is too few for an average.`
    : `Food: averaged ${k(n.kcal)} kcal from ${n.days} days, against ${k(n.T)}.`),
  F3: (n) => `Protein: ${k(n.g)} g average from ${n.days} days.`,
  F4: (n) => `Fibre: ${k(n.g)} g average from ${n.days} days.`,
  F5: (n) => `Water: ${dec(n.ml / 1000, 1)} L average over ${n.days} days.`,
  F6: (n) => `Steps: ${k(n.steps)} average over ${n.days} days, against ${k(n.goal)}.`,
  F7: (n) => (n.done > n.of ? `Sessions: ${n.done}, with ${n.of} planned.` : `Sessions: ${n.done} of ${n.of}. A Minimum session counts as a full one.`),
  F8: (n) => `Lifts: ${n.up} up, ${n.held} held, ${n.down} down, out of ${n.total}. Holding strength in a deficit is a win.`,
  F9: (n) => `Waist: ${n.cm <= 0 ? 'down' : 'up'} ${dec(abs(n.cm), 1)} cm since ${dateText(n.from)}.`,
  F10: (n, ctx = {}) => (abs(n.diff) < 0.05
    ? 'Against the plan line: right on it.'
    : `Against the plan line: you are ${dec(abs(n.diff), 1)} kg ${n.diff < 0 ? 'ahead' : 'above it'}.${n.diff < 0 && ctx.level === 'note' ? ' Check it is not too fast.' : ''}`),

  // ----- Week check: actions -----
  A0: (n) => `Raise your calorie target to ${k(n.floor)} or more in Settings. It is set to ${k(n.T)}, under the floor.`,
  A1: (n) => `Log food on more days. I could judge ${n.judged} of 7.`,
  A2: (n, ctx = {}) => {
    if (n.type === 'eat-to-floor') return `Bring intake back to at least ${k(n.kcal)} kcal.${ctx.T > n.kcal ? ` Your target is ${k(ctx.T)}.` : ''}`;
    if (n.type === 'add-kcal') return `Add ${k(n.kcal)} kcal a day, from carbs.`;
    if (n.type === 'changed') return `You changed your calorie target on ${dateText(n.since)}. Leave it there for 2 weeks before changing it again.`;
    if (n.type === 'aim') return `Aim for ${k(n.kcal)} first. The plan has not had a fair run yet.`;
    if (n.type === 'weigh') return 'Weigh in every morning, after the toilet and before food.';
    if (n.type === 'log-all') return 'Log everything for a week and look again.';
    if (n.type === 'wait') return `Give it time: the weight verdict comes back on ${dateText(n.until)}.`;
    if (n.type === 'hold-rising') return 'Hold a week and keep weighing. If it is still up, the stall choices apply.';
    if (n.type === 'hold-slow') return 'Hold. If it is still slow in 2 weeks, we look at the stall choices.';
    if (n.type === 'break-eat') return n.maintenance ? `Eat at about ${k(n.maintenance)} kcal for the break.` : 'Eat a few hundred kcal above your usual target for the break.';
    return n.cut
      ? `Pick one: cut ${k(n.cut.kcal)} kcal from carbs or fat, or add ${k(n.addSteps)} steps a day. Then give it 2 weeks before changing anything else.`
      : `Add ${k(n.addSteps)} steps a day, and give it 2 weeks. Your calories are already close to the floor.`;
  },
  A3: (n) => `${n.n} lifts went down two sessions running. Check sleep and food first, then an early deload.`,
  A4: (n) => `Protein averaged ${k(n.g)} g. Aim for ${k(n.goal)} or more.`,
  A5: (n) => `Steps averaged ${k(n.steps)}. This week's target is ${k(n.goal)}.`,
  A6: (n) => `${n.done} of ${n.of} sessions. The Minimum session counts as a full one.`,
};

// The sentence for a verdict or an action. ctx adds what the rule does not know.
export function say(item, ctx = {}) {
  const f = WORDS[item.code];
  if (!f) return '';
  const n = item.code.startsWith('A') ? item : item.n;
  return f(n ?? {}, { ...ctx, level: item.level });
}

export { dateText, dayName };
