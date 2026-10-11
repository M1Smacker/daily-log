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
          <p>Open the Workout tab once when you arrive. The session sheet shows every lift with today's weight, sets, reps and rest.</p>
          <p>When you finish a lift, tap it and log it while you still remember it. The weight is already filled in. Tap the reps you got for each set. It saves as you tap, and the lift gets a tick. If it was exactly what you did last time, "Same as last time" puts it all down in one tap. If the weight was different, change it in the box.</p>
          <p>When you are done, tap Full session or Minimum. That one tap marks the day.</p>
          <p>The recap after it has everything you logged already in it. Fill in what you did not log, fix anything that is wrong, and tap Save recap. If every set reached the top of the range, the next sheet shows a heavier weight.</p>
          <p>Try to use one weight for all the sets of a lift. If you did change it, the app goes by the weight you did the most sets with. A heavier set counts as done if it got at least the bottom of the rep range. A lighter set means the weight stays for now.</p>
          <p>Skip the logging and the recap and the day still counts. The app just cannot move your weights up without them.</p>`,
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
          <p>Faster is not better here. If you are losing more than about 1% of your bodyweight a week (and never more than 1 kg) after the first two weeks, the answer is to eat a little more.</p>`,
      },
      {
        title: 'The Coach',
        body: `
          <p>The Coach checks what you did against the plan, so you do not have to ask anyone. It uses fixed rules from your plan, worked out on your phone. There is no AI in it, it needs no internet, and it only reads what you logged.</p>
          <ul>
            <li><b>After a lift:</b> was the weight right for the rep range? It looks at your first set at the working weight. Too light says so and what comes next, too heavy says so too.</li>
            <li><b>Sets:</b> a note when you did more or fewer sets than the sheet asked for. One extra set is always fine.</li>
            <li><b>Each morning:</b> yesterday's food against your targets. A day with too little logged is not judged and not counted.</li>
            <li><b>Each Thursday:</b> the week before. Your weight trend, food, sessions and lifts, with one verdict and at most two things to do.</li>
          </ul>
          <p>It cannot see your form, how hard a set felt, or food you did not log. For anything odd, use the Copy button on Progress and ask Claude.</p>
          <p>It never suggests under 1,800 kcal, more than 1 kg a week of loss, or cutting protein.</p>`,
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
    // Foods and portions only. The day totals are personal numbers, so they stay out of the code.
    group: 'What to eat',
    items: [
      {
        title: 'A sample training day',
        body: `
          <p>Built around school, the gym in the early evening and study at night. It lands close to the targets, with plenty of fibre. Weigh things on a kitchen scale for the first two weeks so the portions become familiar.</p>
          <dl>
            <dt>Breakfast</dt><dd>Anda bhurji from 2 whole eggs and 150 g liquid egg whites, with onion, tomato and green chilli in 1 tsp oil. 1 medium whole-wheat roti. Chai with 150 ml low-fat milk and 1 tsp sugar.</dd>
            <dt>Lunch</dt><dd>Chicken karahi from 150 g boneless chicken breast (weighed cooked) and 2 tsp oil. 1 cup cooked basmati rice. Kachumber salad.</dd>
            <dt>Before the gym</dt><dd>1 scoop of whey in water. 1 medium banana and 3 small dates.</dd>
            <dt>Dinner</dt><dd>1 cup masoor daal with a 1 tsp tarka. 1 medium roti. 75 g chicken tikka, grilled or air-fried. 200 g plain dahi or raita. 100 g bhindi, lauki or mixed sabzi in 1 tsp oil.</dd>
          </dl>
          <p>Hungry while studying late? Keep a little of dinner back for 150 g Greek yoghurt or a cup of laban.</p>`,
      },
      {
        title: 'A keema and fish day',
        body: `
          <dl>
            <dt>Breakfast</dt><dd>50 g oats cooked in 200 ml low-fat milk, half a scoop of whey stirred in after cooking, and 1 tbsp honey or a chopped apple.</dd>
            <dt>Lunch</dt><dd>Chicken keema matar from 150 g lean chicken mince, peas and 2 tsp oil, with 2 medium roti.</dd>
            <dt>Snack</dt><dd>2 boiled eggs, 1 apple and a cup of laban.</dd>
            <dt>Dinner</dt><dd>200 g (raw weight) hamour, zubaidi or salmon, masala-rubbed and grilled or air-fried. 1 cup rice. Half a cup of chana daal. Salad.</dd>
          </dl>`,
      },
      {
        title: 'A pizza or fast-food night',
        body: `
          <p>Make breakfast and lunch very lean and high in protein, then enjoy the pizza. Once a week fits easily.</p>
          <dl>
            <dt>Breakfast</dt><dd>Omelette from 200 g egg whites and 1 whole egg, with onion, tomato and chilli. 1 roti.</dd>
            <dt>Lunch</dt><dd>150 g grilled chicken breast, a big salad, and 1 cup rice or 1 roti.</dd>
            <dt>Snack</dt><dd>1 scoop of whey in water and 1 fruit.</dd>
            <dt>Dinner</dt><dd>3 slices of a medium thin-crust chicken pizza (not double cheese), a side salad, and water or a diet drink.</dd>
          </dl>
          <p>Skip the garlic bread, cheesy dips and full-sugar drinks. They can add 400 to 600 kcal without you noticing.</p>`,
      },
      {
        title: 'Food swaps',
        body: `
          <p>When something is not in the house, swap it for one of these.</p>
          <dl>
            <dt>Egg whites</dt><dd>1 extra whole egg plus 100 g Greek yoghurt. Slightly more fat, so use 1 tsp less oil somewhere else.</dd>
            <dt>Chicken breast</dt><dd>Skinless boneless thigh, fish, lean beef or mutton mince, or canned tuna in water. Thigh and red meat have more fat, so use a smaller portion or less oil.</dd>
            <dt>Basmati rice</dt><dd>1 extra roti, or 1 medium boiled potato (about 150 g).</dd>
            <dt>Roti</dt><dd>2 slices of brown bread, or half a paratha. Keep paratha for weekends.</dd>
            <dt>Masoor daal</dt><dd>Moong daal, chana daal, lobia or rajma.</dd>
            <dt>Dahi</dt><dd>Laban, Greek yoghurt or low-fat milk. Greek yoghurt has the most protein.</dd>
            <dt>Whey</dt><dd>200 g Greek yoghurt, 3 boiled eggs, or 100 g canned tuna.</dd>
            <dt>Banana and dates</dt><dd>1 apple or orange, or a slice of bread with honey.</dd>
            <dt>Breaded chicken strips</dt><dd>Chicken breast strips dipped in egg and rolled in crushed cornflakes or panko with spices, then air-fried. Same crunch, about half the fat.</dd>
          </dl>`,
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
