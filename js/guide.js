// The guide: short explanations of the parts of the plan that are easy to forget.
// Taken from the research plan. Phase entries are built from plan.js, not written here.

export const topics = [
  {
    group: 'In the gym',
    items: [
      {
        title: 'RIR: reps in reserve',
        body: `
          <p>RIR is how many more reps you could have done with good form when you stopped. If you did 10 and could have ground out 2 more, that set was 2 RIR.</p>
          <p>Each phase has a target. Most of the time it is 1 to 3. That is hard enough to grow, without the extra fatigue of going to failure on every set.</p>
          <ul>
            <li>The last rep or two should slow down. If the bar speed never dropped, you had more left than you think.</li>
            <li>Most people guess too high early on. In the Foundation phase, treat your guess as a rough number and let it sharpen.</li>
            <li>The last set of an isolation exercise (curls, lateral raises, leg extensions) can go to 0 or 1 from the Build phase on.</li>
            <li>Big lifts like squats and Romanian deadlifts stay away from 0.</li>
          </ul>`,
      },
      {
        title: 'The jump rule',
        body: `
          <p>Every exercise has a rep range, for example 8 to 12. Keep the same weight until you hit the top of the range on every set, at the effort the phase asks for.</p>
          <p>Next session, go up by the smallest jump you can and work back up from the bottom of the range. Then repeat.</p>
          <ul>
            <li>Barbells and the Smith machine: 2.5 kg. Machines: one pin. Dumbbells: the next pair up.</li>
            <li>Barbell weights include the bar. Dumbbell weights are for one dumbbell.</li>
            <li>If the next jump is a big step (common on small lifts like lateral raises), go a few reps past the top of the range first.</li>
            <li>At the heaviest dumbbell, switch to the listed alternative so the lift can keep getting heavier.</li>
            <li>If a lift goes backwards two sessions in a row outside a deload, check sleep and food first. If those are fine, take an early deload week.</li>
          </ul>`,
      },
      {
        title: 'Using the app at the gym',
        body: `
          <p>Open the Workout tab once when you arrive. The session sheet shows every lift with today's weight, sets, reps and rest. Read it, or screenshot it, and put the phone away.</p>
          <p>When you are done, tap Full session or Minimum. That one tap marks the day.</p>
          <p>Later, fill in the short recap: for each lift, the weight and the fewest reps you got on any set. If the fewest reps reached the top of the range, the next sheet shows a heavier weight.</p>
          <p>Skip the recap and the day still counts. The app just cannot move your weights up without it.</p>`,
      },
      {
        title: 'Order and rest',
        body: `
          <p>Go in the order listed. The big compound lifts come first while you are fresh, the isolation work after.</p>
          <p>Rest 2 to 3 minutes on big lifts and 1 to 2 minutes on isolation work. Longer rests let you keep the weight and reps up, and that matters more for growth than feeling out of breath.</p>
          <p>If a cable station is busy, use the listed alternative. Do not wait around.</p>`,
      },
      {
        title: 'Starting weights',
        body: `
          <p>The first time you do a lift, pick a weight where the first set leaves 3 or 4 reps in the tank. Too light is fine. The jump rule will catch you up within a couple of weeks.</p>
          <p>Starting too heavy is the usual way people get crippling soreness and skip the next session.</p>`,
      },
    ],
  },
  {
    group: 'When a day goes wrong',
    items: [
      {
        title: 'The minimum session',
        body: `
          <p>For bad days and exam weeks: only the first 3 exercises of the session, 2 sets each, about 30 minutes.</p>
          <p>It counts as a full session. Research on trained young adults found they kept their muscle for months on a fraction of their normal training, so this keeps the habit and the muscle while life is busy.</p>
          <p>If you feel too tired to train, go and do just the first two exercises. Most days you will finish once you are there.</p>`,
      },
      {
        title: 'Missed days',
        body: `
          <p>A missed day never doubles up. The session you missed stays next in line, and everything after it moves along by one.</p>
          <p>One missed session changes nothing. Two in a row is how people fall off, so after two misses the minimum session is the thing to aim for.</p>
          <p>If you miss four in a row, the app offers to push every phase back a week so the plan picks up where you stopped.</p>`,
      },
      {
        title: 'If you feel off',
        body: `
          <p>If you feel dizzy, faint or unusually exhausted, or your mood or study focus crashes, eat at maintenance for a week and see a doctor.</p>
          <p>Your health and your exams come before any weight target. Nothing in this app is medical advice.</p>`,
      },
    ],
  },
  {
    group: 'Food and weight',
    items: [
      {
        title: 'Weighing in',
        body: `
          <p>Weigh yourself in the morning, after the toilet and before any food or water, on the same scale.</p>
          <p>One day means nothing. Salt, a late meal or a hard session can move the scale by a kilo. The app uses your 7-day average, so judge progress week to week.</p>
          <p>The first week or two usually drops an extra 1 to 1.5 kg. That is water and food in your gut, not fat, and it is normal.</p>
          <p>Measure your waist once a week, same morning, at the belly button, relaxed, after breathing out.</p>`,
      },
      {
        title: 'The pace',
        body: `
          <p>The aim is about 0.6 to 0.8 kg a week. In the research, people losing at that pace kept and even gained muscle, while people losing twice as fast did not.</p>
          <p>Faster is not better here. If you are losing more than 1 kg a week after the first two weeks, the answer is to eat a little more.</p>`,
      },
      {
        title: 'The stall check',
        body: `
          <ul>
            <li>If your weekly average has not dropped for 2 weeks in a row and your waist has not shrunk either: cut 150 kcal a day, or add 2,000 steps a day.</li>
            <li>Take the 150 kcal from carbs or fat, never from protein.</li>
            <li>Do not go below about 1,800 kcal.</li>
            <li>If the scale is flat but your waist is shrinking and your lifts are going up, you are losing fat and building muscle at once. Leave everything alone for another week.</li>
          </ul>`,
      },
      {
        title: 'Protein first',
        body: `
          <p>Protein is the target that protects muscle while you lose fat. If the day is going to miss a target, let it be carbs or fat.</p>
          <p>On a pizza or takeaway night, make breakfast and lunch lean and high in protein, then enjoy the meal. Once a week fits easily.</p>
          <p>Drinks are the easy place to lose track. Juice and regular soft drinks add up fast without making you full.</p>`,
      },
      {
        title: 'The diet break',
        body: `
          <p>Two weeks at maintenance calories, with training cut to about half the sets. In a trial of men dieting in blocks like this, they lost more fat and their bodies slowed down less than men who dieted straight through.</p>
          <p>It is part of the plan, not time off it. The weight line goes flat for those two weeks on purpose.</p>`,
      },
    ],
  },
  {
    group: 'Everything else',
    items: [
      {
        title: 'Steps and cardio',
        body: `
          <p>Steps come first. The target starts low and rises by 1,000 a week, so it is always within reach. In the heat, use the gym treadmill at a brisk walk or walk after sunset.</p>
          <p>On top of that, 2 to 3 easy bike sessions a week of 25 to 30 minutes, at a pace where you can still talk in sentences.</p>
          <p>From the Build phase there is an optional interval session: 5 minutes easy, 8 rounds of 20 seconds hard and 100 seconds easy, then 5 minutes easy.</p>
          <p>On a lifting day, cardio goes after the weights, never before. Keep it easy on leg days.</p>`,
      },
      {
        title: 'Supplements',
        body: `
          <ul>
            <li>Creatine monohydrate: 3 to 5 g every day, at any time. No loading needed.</li>
            <li>Vitamin D3: 1,000 IU a day.</li>
            <li>Caffeine is optional: about an hour before training, and none within 8 hours of bed. Sleep matters more.</li>
            <li>Whey is optional. It is only a convenient way to reach your protein target.</li>
          </ul>
          <p>Skip fat burners, detox teas and BCAAs.</p>`,
      },
      {
        title: 'Face and stomach fat',
        body: `
          <p>You cannot choose where fat comes off. Crunches do not burn belly fat and face exercises do not burn cheek fat. Both slim down as your overall body fat falls.</p>
          <p>Ab training still matters, because it builds the muscle that shows once the fat is gone.</p>
          <p>Face puffiness is partly water. Steady salt, enough water and enough sleep help it day to day.</p>`,
      },
      {
        title: 'Progress photos',
        body: `
          <p>Every 2 weeks: front, side and back, in the same light, the same spot and at the same time of day.</p>
          <p>The photos stay in your phone's locked album. This app only reminds you and never stores them.</p>`,
      },
    ],
  },
];
