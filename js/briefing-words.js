// The briefing's wording: one lookup from template id to sentences. briefing.js picks the
// templates and the numbers, and nothing else in the app writes briefing sentences.
//
// Voice: direct. The point first, the mistake in the numbers, what it costs, one fix. Hard on the
// data and never on the person. No cheerleading, no questions, no exclamation marks. Never used:
// lazy, weak, pathetic, excuses, cheat, cheated, bad food, clean food, you always, you never,
// just, great job, proud, amazing. British spelling, no dashes. A test reads this file.
//
// Every template has two wordings, A and B, picked by the week number of the week the read
// covers, so the text is the same from one read to the next and the same input gives the same words.

import { isoWeek, weekday } from './rules.js';
import { BRIEF } from './coach-constants.js';

const kc = (n) => Math.round(n).toLocaleString('en-GB');
const kg = (n) => Number(n).toFixed(1);
const pct = (n) => Number(Math.abs(n)).toFixed(1);
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (key) => { const d = new Date(`${key}T00:00:00Z`); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const when = (key) => `${NAMES[weekday(key)]} ${dm(key)}`;
const head = (v) => (v.label ? `${v.label}, day ${v.d}${v.n ? ` of ${v.n}` : ''}.` : 'The plan has not started yet.');
const from = (v) => (Number(kg(v.x)) === 0 ? `the same as your ${kg(v.S)} start` : `${kg(v.x)} ${v.up ? 'up' : 'down'} from ${kg(v.S)}`);
const sessions = (v, all, some) => (v.n > v.of ? `${v.n} sessions done, ${v.of} planned.` : v.n === v.of ? all : some);
const BAND = { slow: 'slow', flat: 'flat', rising: 'up' };

// Part 1, 2 and 4: each wording is (v, ctx) => [sentences]. ctx.lift(id) is a lift's name.
const PLAIN = {
  'P1.1': [
    (v) => [head(v), `You are at ${kg(v.W)} kg, ${from(v)}, ${kg(v.r)} to go.`],
    (v) => [head(v), `You weigh ${kg(v.W)} kg: ${from(v)}, with ${kg(v.r)} to go.`],
  ],
  'P1.1g': [
    (v) => [head(v), `You are at ${kg(v.W)} kg, ${from(v)}. That is your goal weight reached.`],
    (v) => [head(v), `You weigh ${kg(v.W)} kg, ${from(v)}. The goal weight is reached.`],
  ],
  'P1.2': [
    (v) => [v.above ? `That is ${kg(v.y)} kg above the plan line.` : `That is ${kg(v.y)} kg ahead of the plan line.`],
    (v) => [v.above ? `The plan line is ${kg(v.y)} kg below you.` : `You are ${kg(v.y)} kg ahead of the plan line.`],
  ],
  'P1.3': [
    (v) => [head(v), `You are at ${kg(v.W)} kg.`, 'The early drop is mostly water, so it does not count yet.'],
    (v) => [head(v), `You weigh ${kg(v.W)} kg.`, 'Most of the early drop is water, so I am not counting it yet.'],
  ],
  'P1.3b': [
    (v) => [head(v), `You are at ${kg(v.W)} kg.`, 'The scale is still settling after the break, so it does not count yet.'],
    (v) => [head(v), `You weigh ${kg(v.W)} kg.`, 'The break is over and the scale is still settling, so I am not counting it yet.'],
  ],
  'P1.3c': [
    (v) => [head(v), `You are at ${kg(v.W)} kg.`, 'Creatine holds some water in the first weeks, so the scale does not count yet.'],
    (v) => [head(v), `You weigh ${kg(v.W)} kg.`, 'Creatine is holding some water, so I am not counting the scale yet.'],
  ],
  'P1.4': [
    (v) => [head(v), v.k === 0 ? 'No weigh-ins this week, so no weight read.' : `Only ${v.k} weigh-in${v.k === 1 ? '' : 's'} this week, so no weight read.`],
    (v) => [head(v), v.k === 0 ? 'Not one weigh-in this week, so there is no weight read.' : `${v.k} weigh-in${v.k === 1 ? '' : 's'} this week is too few for a weight read.`],
  ],
  'P1.5': [
    (v) => [head(v), 'Nothing was logged this week, so there is no read.'],
    (v) => [head(v), 'The log is empty for this week, so there is no read.'],
  ],
  'P1.6': [
    (v) => [head(v), 'Too early for a read.'],
    (v) => [head(v), 'It is too early for a read.'],
  ],

  G0: [
    () => ['No clear win this week.', 'That changes when you fix the thing below.'],
    () => ['Nothing stood out this week.', 'Fix the thing below and that changes.'],
  ],
  G1: [
    (v) => [`Weight is dropping ${pct(v.R)}% a week, right on pace.`],
    (v) => [`Weight is coming off at ${pct(v.R)}% a week, the pace you want.`],
  ],
  G2: [
    (v) => [`The scale is flat but your waist is down ${kg(v.c)} cm and ${v.u} of ${v.m} lifts went up.`, 'That is working.'],
    (v) => [`Flat scale, waist down ${kg(v.c)} cm, ${v.u} of ${v.m} lifts up.`, 'That is fat going and muscle staying.'],
  ],
  G3: [
    (v, c) => [v.lead ? `${v.u} of ${v.m} lifts went up, led by ${c.lift(v.lead.id)}, ${v.lead.a} to ${v.lead.b} kg.` : `${v.u} of ${v.m} lifts went up.`],
    (v, c) => [v.lead ? `${v.u} of ${v.m} lifts went up, ${c.lift(v.lead.id)} the most, ${v.lead.a} to ${v.lead.b} kg.` : `${v.u} of ${v.m} lifts are up on last time.`],
  ],
  G3b: [
    () => ['Lifts are holding.', 'In a deficit that is the job.'],
    () => ['Lifts held their weights.', 'In a deficit, holding is the win.'],
  ],
  G4: [
    (v) => [sessions(v, `All ${v.of} sessions done.`, `${v.n} of ${v.of} sessions done.`)],
    (v) => [sessions(v, `Every session done, all ${v.of}.`, `${v.n} of ${v.of} sessions done this week.`)],
  ],
  G5: [
    (v) => [`Protein averaged ${kc(v.g)} g, in range.`],
    (v) => [`Protein came in at ${kc(v.g)} g a day, in range.`],
  ],
  G6: [
    (v) => [v.n >= 7 ? 'Food logged every day.' : `Food logged ${v.n} of 7 days.`],
    (v) => [v.n >= 7 ? 'Every day of food is in the log.' : `${v.n} of 7 days of food are in the log.`],
  ],
  G7: [
    () => ['Food is at maintenance and the weight is steady, which is the point of a break.'],
    () => ['Food sat at maintenance and the weight held, which is what a break is for.'],
  ],
  G8: [
    (v) => [`Steps averaged ${kc(v.n)}, on target.`],
    (v) => [`Steps came in at ${kc(v.n)} a day, on target.`],
  ],
  G9a: [
    (v) => [`Food logged on ${v.n} of 7 days, up from ${v.m}: that fix worked.`],
    (v) => [`${v.n} of 7 days of food logged, up from ${v.m}: the fix worked.`],
  ],
  G9b: [
    (v) => [`${v.n} sessions done, up from ${v.m}: that fix worked.`],
    (v) => [`Sessions are at ${v.n}, up from ${v.m}: the fix worked.`],
  ],
  G9c: [
    (v) => [`Protein averaged ${kc(v.g)} g, up from ${kc(v.m)}: that fix worked.`],
    (v) => [`Protein is at ${kc(v.g)} g a day, up from ${kc(v.m)}: the fix worked.`],
  ],
  G9d: [
    (v) => [`Steps averaged ${kc(v.n)}, up from ${kc(v.m)}: that fix worked.`],
    (v) => [`Steps are at ${kc(v.n)} a day, up from ${kc(v.m)}: the fix worked.`],
  ],
  G9e: [
    (v) => [`Food averaged ${kc(v.x)} kcal, back on target: that fix worked.`],
    (v) => [`Food is back on target at ${kc(v.x)} kcal: the fix worked.`],
  ],
  B1a: [
    (v, c) => [v.lead ? `${v.prev} is done: ${v.u} of ${v.m} lifts went up, led by ${c.lift(v.lead.id)}, ${v.lead.a} to ${v.lead.b} kg.` : `${v.prev} is done: ${v.u} of ${v.m} lifts went up since week 1.`],
    (v, c) => [v.lead ? `${v.prev} is finished with ${v.u} of ${v.m} lifts up, ${c.lift(v.lead.id)} most of all, ${v.lead.a} to ${v.lead.b} kg.` : `${v.prev} is finished with ${v.u} of ${v.m} lifts up since week 1.`],
  ],
  B1b: [
    (v) => [`${v.prev} is done and lifts held, which is the job in a deficit.`],
    (v) => [`${v.prev} is finished and lifts held, and in a deficit that is the job.`],
  ],
  B2: [
    (v) => [`Since the start: ${journey(v).join(', ')}.`],
    (v) => [`From the start until now: ${journey(v).join(', ')}.`],
  ],

  N0: [(v) => [`First read: ${when(v.date)}.`], (v) => [`The first read is ${when(v.date)}.`]],
  N1a: [
    (v) => [`Deload starts ${when(v.date)}: half the sets, same weights.`, 'It will feel too easy, do it anyway.'],
    (v) => [`${when(v.date)} is the start of the deload: half the sets, same weights.`, 'It is meant to feel too easy, so do it anyway.'],
  ],
  N1b: [
    (v) => [`Diet break starts ${when(v.date)}: ${breakFood(v)}.`, 'Expect the scale flat or up a little, that is the point.'],
    (v) => [`${when(v.date)} starts the diet break: ${breakFood(v)}.`, 'A flat scale or a small rise is the point of it.'],
  ],
  N1c: [
    (v) => (v.muscles.length >= 2
      ? [`Push starts ${when(v.date)}: an extra set for ${v.muscles[0]} and ${v.muscles[1]}.`, `Effort goes to ${v.rir[0]} to ${v.rir[1]} reps in the tank.`]
      : [`Push starts ${when(v.date)}.`, 'Pick your two lagging muscles on the Workout sheet that day.']),
    (v) => (v.muscles.length >= 2
      ? [`${when(v.date)} starts Push, with an extra set for ${v.muscles[0]} and ${v.muscles[1]}.`, `Leave ${v.rir[0]} to ${v.rir[1]} reps in the tank from then.`]
      : [`${when(v.date)} starts Push.`, 'Choose your two lagging muscles on the Workout sheet that day.']),
  ],
  N1d: [
    (v) => [`${v.label} starts ${when(v.date)}: full sets on every lift, ${v.rir[0]} to ${v.rir[1]} reps in the tank.`],
    (v) => [`${when(v.date)} starts ${v.label}: full sets on every lift, ${v.rir[0]} to ${v.rir[1]} reps in the tank.`],
  ],
  N1e: [
    (v) => [`The break ends ${when(v.date)}.`, 'The new calorie target is offered on Today the day after.'],
    (v) => [`${when(v.date)} is the last day of the break.`, 'Today offers the new calorie target the day after.'],
  ],
  N2: [
    (v) => ['The break is over.', `Weight reads restart ${when(v.date)}.`],
    (v) => ['The break has ended.', `Weight reads start again ${when(v.date)}.`],
  ],
  N3: [
    (v) => [`Photo day: ${when(v.date)}.`, 'Same light, same spot.'],
    (v) => [`Photos: ${when(v.date)}.`, 'Use the same light and the same spot.'],
  ],
  N4: [
    (v) => [`Next read: ${when(v.date)}${v.needs ? `, and it needs ${BRIEF.needsFoodDays} days of food and ${BRIEF.needsWeighIns} weigh-ins` : ''}.`, v.first ? (v.why === 'start' ? `The first weight read is ${when(v.first)}.` : `Weight reads restart ${when(v.first)}.`) : null],
    (v) => [`The next read is ${when(v.date)}${v.needs ? `, and it needs ${BRIEF.needsFoodDays} days of food and ${BRIEF.needsWeighIns} weigh-ins` : ''}.`, v.first ? (v.why === 'start' ? `The first weight read comes ${when(v.first)}.` : `Weight reads start again ${when(v.first)}.`) : null],
  ],
  N4q: [
    (v) => [`Nothing changes between ${NAMES[weekday(v.date)]}s.`, `Next read ${when(v.date)}.`],
    (v) => [`Same as last week, and nothing changes between ${NAMES[weekday(v.date)]}s.`, `Next read ${when(v.date)}.`],
  ],
};

function journey(v) {
  const out = [];
  if (v.weight) out.push(`${kg(v.weight.x)} kg ${v.weight.up ? 'up' : 'down'}`);
  if (v.lifts) out.push(`${v.lifts.u} of ${v.lifts.m} lifts up`);
  if (v.waist !== null) out.push(`waist ${kg(Math.abs(v.waist))} cm ${v.waist <= 0 ? 'down' : 'up'}`);
  return out;
}
const breakFood = (v) => `${v.M ? `eat at about ${kc(v.M)} kcal` : 'eat a few hundred kcal above your target'}${v.n ? ` for ${v.n} days` : ''}`;

// Part 3: each wording gives the fix in pieces, { fact, cost, action, after, short }, so a fix
// that repeats can be cut down to the fact and the action. short is the fact from the third week.
const lifts = (v, c) => {
  const [a, b] = v.lifts.map((id) => c.lift(id));
  if (!b) return { who: a, one: true };
  return { who: v.more ? `${a}, ${b} and ${v.more} more` : `${a} and ${b}`, one: false };
};
const FIX = {
  X0: [
    (v) => ({ fact: `Your calorie target is set to ${kc(v.T)}, under the ${kc(v.floor)} floor.`, cost: 'That is not a bigger cut, it is lost muscle.', action: `Raise it to ${kc(v.floor)} or more in Settings.` }),
    (v) => ({ fact: `Your calorie target of ${kc(v.T)} is under the ${kc(v.floor)} floor.`, cost: 'Under the floor the loss is muscle, not a faster cut.', action: `Set it to ${kc(v.floor)} or more in Settings.` }),
  ],
  X1: [
    (v) => ({ fact: `You ate under ${kc(v.floor)} kcal on ${v.n} days.`, cost: 'That is not a faster cut, it costs muscle.', action: `Get back to ${kc(v.T)} kcal.` }),
    (v) => ({ fact: `${v.n} days came in under ${kc(v.floor)} kcal.`, cost: 'That far under, the loss is muscle.', action: `Eat ${kc(v.T)} kcal.` }),
  ],
  X2: [
    (v) => ({ fact: `You are losing ${pct(v.R)}% a week.`, cost: 'Past 1% the muscle goes with the fat.', action: `Add ${kc(v.add)} kcal a day, from carbs.` }),
    (v) => ({ fact: `Weight is dropping ${pct(v.R)}% a week.`, cost: 'That is too fast to keep the muscle.', action: `Add ${kc(v.add)} kcal a day, from carbs.` }),
  ],
  X2w: [
    (v) => ({ fact: `You are losing ${pct(v.R)}% a week.`, cost: `You changed your target on ${dm(v.since)}, and that needs time to show.`, action: 'Leave it alone for 2 weeks.' }),
    (v) => ({ fact: `Weight is dropping ${pct(v.R)}% a week.`, cost: `The target you set on ${dm(v.since)} has not had time to show.`, action: 'Leave it alone for 2 weeks.' }),
  ],
  X3: [
    (v) => ({ fact: `Food was logged on ${v.n} of 7 days.`, cost: "I can't coach what I can't see.", action: 'Log every day this week.' }),
    (v) => ({ fact: `Only ${v.n} of 7 days logged.`, cost: 'Without the log I am guessing.', action: 'Log every day this week.' }),
  ],
  X4: [
    (v) => ({ fact: `You have ${v.a}, ${v.b} and ${v.c} weigh-ins across the last 3 weeks.`, cost: `A real average needs ${v.needed} or more in each.`, action: 'Weigh in every morning.' }),
    (v) => ({ fact: `The last 3 weeks have ${v.a}, ${v.b} and ${v.c} weigh-ins.`, cost: `An average worth reading needs ${v.needed} or more in each.`, action: 'Weigh in every morning.' }),
  ],
  X5: [
    (v) => ({ fact: `Food averaged ${kc(v.x)} kcal against ${kc(v.T)}.`, cost: 'That is too low to be real, so meals are missing from the log.', action: 'Log everything.' }),
    (v) => ({ fact: `The log says ${kc(v.x)} kcal a day against ${kc(v.T)}.`, cost: 'The scale says otherwise, so meals are missing from it.', action: 'Log everything.' }),
  ],
  X6: [
    (v) => ({ fact: `Food averaged ${kc(v.x)} kcal, ${kc(v.d)} over target.`, cost: `That is why the scale is ${BAND[v.band] ?? 'slow'}.`, action: `Land on ${kc(v.T)} before you touch the plan.` }),
    (v) => ({ fact: `Food averaged ${kc(v.x)} kcal, ${kc(v.d)} over target.`, cost: `The scale is ${BAND[v.band] ?? 'slow'} because of that.`, action: `Eat ${kc(v.T)} before you change anything.` }),
  ],
  X7: [
    (v) => ({ fact: 'Flat for 2 weeks with food on target.', action: v.cut ? `Pick one: cut ${kc(v.cut)} kcal from carbs or fat, or add ${kc(v.steps)} steps a day.` : `Add ${kc(v.steps)} steps a day.` }),
    (v) => ({ fact: 'Two flat weeks with food on target.', action: v.cut ? `The plan needs a push: cut ${kc(v.cut)} kcal from carbs or fat, or add ${kc(v.steps)} steps a day.` : `The plan needs a push: add ${kc(v.steps)} steps a day.` }),
  ],
  X8: [
    (v) => ({ fact: 'Nothing to fix.', action: `You changed your target on ${dm(v.since)}, so give it until ${dm(v.until)}.` }),
    (v) => ({ fact: 'Nothing to fix.', action: `Your target changed on ${dm(v.since)}, so leave it until ${dm(v.until)}.` }),
  ],
  X9: [
    (v) => ({ fact: `Weight is up ${pct(v.R)}% a week.`, action: 'Hold a week and keep weighing.', after: 'If it is still up, the stall rule applies.' }),
    (v) => ({ fact: `The average is rising ${pct(v.R)}% a week.`, action: 'Hold for a week and keep weighing.', after: 'Still up after that, and the stall rule applies.' }),
  ],
  X10: [
    (v) => ({ fact: `Slow: ${pct(v.R)}% a week against ${v.lo} to ${v.hi}.`, action: 'Hold the plan.', after: 'If it is still slow in 2 weeks, the stall rule applies.' }),
    (v) => ({ fact: `${pct(v.R)}% a week is slow against ${v.lo} to ${v.hi}.`, action: 'Hold the plan.', after: 'Still slow in 2 weeks, and the stall rule applies.' }),
  ],
  X11: [
    (v) => ({ fact: `You did ${v.n} of ${v.of} sessions.`, action: 'On a bad day do the Minimum session.', after: "Don't skip it." }),
    (v) => ({ fact: `${v.n} of ${v.of} sessions done.`, action: 'When the day is short, do the Minimum session.', after: "Don't skip it." }),
  ],
  X12: [
    (v, c) => { const l = lifts(v, c); return { fact: `${l.who} ${l.one ? 'is' : 'are'} down two sessions running.`, cost: 'Check sleep and food first.', action: `If ${l.one ? 'it drops' : 'they drop'} again, deload early.` }; },
    (v, c) => { const l = lifts(v, c); return { fact: `${l.who} ${l.one ? 'has' : 'have'} dropped two sessions running.`, cost: 'Look at sleep and food first.', action: `One more drop and you deload early.` }; },
  ],
  X13: [
    (v) => ({ fact: `Protein averaged ${kc(v.g)} g against ${kc(v.P)}.`, action: `Hit ${kc(v.P)} g, it is what keeps the muscle.` }),
    (v) => ({ fact: `Protein came in at ${kc(v.g)} g against ${kc(v.P)}.`, action: `Get to ${kc(v.P)} g, protein is what keeps the muscle.` }),
  ],
  X14: [
    (v) => ({ fact: `Steps averaged ${kc(v.n)} against ${kc(v.t)}.`, action: 'Walk the difference.' }),
    (v) => ({ fact: `Steps came in at ${kc(v.n)} against ${kc(v.t)}.`, action: 'Walk the difference.' }),
  ],
  X15: [
    () => ({ fact: "A week with no log is a week I can't coach.", action: 'Log everything starting today.', short: 'Nothing logged.' }),
    () => ({ fact: "I can't coach a week with nothing in the log.", action: 'Log everything starting today.', short: 'Nothing logged.' }),
  ],
  X16: [
    () => ({ fact: 'Nothing to fix this week.', action: 'Leave the plan alone.' }),
    () => ({ fact: 'Nothing to fix this week.', action: 'Change nothing.' }),
  ],
  X16q: [() => ({ fact: 'Nothing to fix.' }), () => ({ fact: 'Nothing to fix.' })],
  X16b: [
    () => ({ fact: 'Nothing to fix.', action: "Eat at maintenance, don't try to cut." }),
    () => ({ fact: 'Nothing to fix.', action: 'Stay at maintenance and leave the cut for later.' }),
  ],
  X16c: [
    (v) => ({ fact: `Food averaged ${kc(v.x)} kcal in the break.`, action: v.M ? `Eat at about ${kc(v.M)}.` : 'Eat a few hundred above your usual target.', after: `A break at ${kc(v.x)} is a slower cut, not a break.` }),
    (v) => ({ fact: `Food sat at ${kc(v.x)} kcal in the break.`, action: v.M ? `Eat about ${kc(v.M)}.` : 'Eat a few hundred above your usual target.', after: `At ${kc(v.x)} it is a slower cut, not a break.` }),
  ],
  X17: [
    () => ({ fact: 'Log every meal, weigh in every morning and do your sessions.', action: 'Nothing else counts yet.' }),
    () => ({ fact: 'Log every meal, weigh in every morning, do your sessions.', action: 'Nothing else counts yet.' }),
  ],
};

const ORDINAL = ['', '', 'Second', 'Third', 'Fourth', 'Fifth'];
const TAIL = 'The weekly card has one more.';
const ENDING = 'Nothing else matters until this is fixed.';
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const count = (s) => s.split(/\s+/).filter(Boolean).length;

function fixSentences(f, c, pick, cost = true) {
  const t = pick(FIX[f.id])(f.v, c);
  if (!cost) t.cost = null;
  let out;
  if (f.repeat >= 2) {
    const lead = `${ORDINAL[f.repeat] ? `${ORDINAL[f.repeat]} week running` : `Week ${f.repeat} running`}: `;
    // The second week keeps everything. From the third it is the fact, the action and no more.
    out = f.repeat === 2
      ? [lead + lower(t.fact), t.cost, t.action, t.after]
      : [lead + lower(t.short ?? t.fact), t.action, ENDING];
  } else out = [t.fact, t.cost, t.action, t.after];
  return out.filter(Boolean);
}

// The briefing as sentences.
//   sel: what briefing.js chose        lift: (id) => a lift's name
//   index: which wording to use. Left out, it is the ISO week number of the week the read covers,
//   so the words hold still from one read to the next.
// Returns { where, well, fix, next } as lists of sentences, the caption, and the word count.
export function compose(sel, { lift = (id) => id, index = null } = {}) {
  const i = index ?? isoWeek(sel.week?.to ?? sel.read);
  const pick = (list) => list[i % list.length];
  const c = { lift, read: sel.read };
  const say = (it, v = it.v) => pick(PLAIN[it.id])(v, c).filter(Boolean);
  // A sentence that runs past the cap loses its lift name before anything else.
  const fits = (it) => {
    const s = say(it);
    return it.v.lead && s.some((x) => count(x) > BRIEF.maxSentenceWords) ? say(it, { ...it.v, lead: null }) : s;
  };

  const f = sel.parts.fix[0];
  const noLead = (it) => say(it, it.v.lead ? { ...it.v, lead: null } : it.v);
  const build = (o) => ({
    where: sel.parts.where.slice(0, o.planLine ? undefined : 1).map(fits),
    well: sel.parts.well.slice(0, o.well).map(o.lead ? fits : noLead),
    fix: [fixSentences(f, c, pick, o.cost), o.tail && f.tail ? [TAIL] : []],
    next: sel.parts.next.map(fits).map((x) => (o.nextAll ? x : x.slice(0, 1))),
  });
  const size = (p) => [p.where, p.well, p.fix, p.next].flat(2).reduce((a, x) => a + count(x), 0);

  // The whole briefing stays under the word cap. What goes first is what matters least: the
  // second thing that is working, the plan line, the pointer to the card, the second sentence of
  // what is next, what the mistake costs, a lift's name, and last of all what is working.
  // The fix's fact and action, and where you are, are never cut.
  let o = { well: BRIEF.caps.well, planLine: true, tail: true, nextAll: true, cost: true, lead: true };
  let parts = build(o);
  for (const step of [{ well: 1 }, { planLine: false }, { tail: false }, { nextAll: false }, { cost: false }, { lead: false }, { well: 0 }]) {
    if (size(parts) <= BRIEF.maxWords) break;
    o = { ...o, ...step };
    parts = build(o);
  }
  const { where, well, fix, next } = parts;
  const total = () => size(parts);

  const caption = sel.week
    ? `Read of the week ending ${NAMES[weekday(sel.week.to)].slice(0, 3)} ${dm(sel.week.to)}. Next read ${when(sel.nextRead)}.`
    : `No read yet. ${pick(PLAIN.N0)(sel.parts.next[0].v, c)[0]}`;
  return { where: where.flat(), well: well.flat(), fix: fix.flat(), next: next.flat(), caption, words: total() };
}

export const LABELS = { where: 'Where you are', well: 'Going well', fix: 'Fix', next: 'Next' };
// Every template and its wordings, for the test that checks each has an A and a B.
export const WORDINGS = { ...PLAIN, ...FIX };
