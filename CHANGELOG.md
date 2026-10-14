# Changelog

## 0.17.0

The rules the app was applying in silence now say so on the screen where they apply.

Two of them were mistakes, not just quiet ones:

- **The weekly pace was typed into a sentence.** The weight card always read "about 0.6 to 0.8 kg a week" whatever the goal and end date said. It is worked out now (`rules.planPace`), over the days that are not a maintenance phase, and the Claude export uses the same figure.
- **Two weigh-in counts looked like a contradiction.** The weight card needs 3 mornings in 7 days for an average, the Coach needs 4 inside the week. Both are real, and each now says which is which.

Said out loud:

- **Warm-ups.** The log on the session sheet says a light set before your first proper set is kept but never counted for or against the next weight, and that a lighter set after the work has started does count.
- **The day turns over at 4 am.** Between midnight and the rollover the header says "Still, until 4 am". A session running up to it is warned that later sets land on the new day.
- **The step target.** The Steps card says it rises every week, by how much, and where it stops.
- **A quiet spell on the scale.** The weigh-in card names the date the Coach starts reading your weight, from the Coach's own clear day, and says to keep weighing in meanwhile.
- **Editing a saved food.** The edit form says meals already logged keep the numbers they were logged with.
- **What makes a day count.** Food says a day joins the weekly averages at 1,200 kcal and 2 meals, with where the day stands.
- **The week's days.** Today's strip and the Progress sessions card say the week runs Thursday to Wednesday.
- **The plan line.** The chart legend says it goes flat in the diet break.
- **The Coach's limits.** The weekly card says it never goes under 1,800 kcal, never more than 1 kg a week, never less protein.
- **Something waiting to sync** shows at the top of every screen, not only at the foot of Today.
- **The minimum session counts in full**, said on the card with the button, not only after two misses.

The guide's pace topic no longer states a figure as your aim, because only your own goal and dates can say that.

## 0.16.0

A missed session, and the morning weigh-in, said where you will see them.

- **A missed session is named.** When a gym day passes with nothing marked, Today shows a note above the session card: which session it was, which day it was, which day it is on now, and that gym days and rest days stay on the same weekdays. Only the session names move along.
- **"Not training today".** A button on the session card on a gym day. It moves the app on at once, and the note has an Undo.
- **"Do a different session".** Pick any of the four sessions for today instead of the one next in line. The plan carries on from your pick, and the one you skipped comes round again after the others. It uses the session already stored with each workout, so nothing new is saved.
- **A rest day says what training would do.** The card now says that training on a rest day takes the next session and moves the next gym day up.
- **Unfinished days are asked about.** Lifts logged on a day that was never marked Full session or Minimum used to read as a missed day. Now the next morning's Today asks what it was: count it, or leave it as missed. It never counts it for you.
- **The weigh-in is at the top of Today** until you have weighed in, with the box right there, and says how many mornings this week have a weight against the 4 a week's average needs. After midday it becomes a plain note instead.
- The guide says all of this in the Missed days and Weighing in topics, including that the app cannot ring you when it is closed, so a phone alarm is the reminder.

## 0.15.0

The Coach's briefing, on Progress above the weekly card: the Coach's read of the whole week in four short parts.

- **Where you are.** The phase and the day in it, your weight against where you started and where you are going, and the plan line when you are 1 kg or more off it.
- **Going well.** Up to two things, and only ones the weekly card itself marks good. Praise that was said in the last two briefings rotates out.
- **Fix.** One thing, always the weekly card's first action in plainer words. A fix that repeats says so ("Second week running"), and from the third week it gets shorter and blunter. When there is nothing to fix it says so and invents nothing.
- **Next.** A phase starting, the diet break ending, a photo day, or when the next read is.
- It changes once a week, on Thursday, and the line under it says which week it read and when the next read comes. A week with nothing new shrinks to a few lines.
- It is at most 80 words, with no sentence over 20. It names at most two lifts.
- Fixed rules and fixed sentences, each with two wordings that take turns by week. No AI, nothing stored: "said before" and "second week running" are found by running the same rules on the earlier weeks.

The weekly card:

- Every piece of advice is now an action on the card, never buried in the verdict's sentence. So the briefing's fix and the card's first action are always the same thing.
- The order of actions: a calorie target set under 1,800, eating under the floor, losing too fast and the stall choice come first. Then the log. Then the verdict's own advice, sessions, lifts, protein and steps.
- The numbers sit behind "Show the numbers", now that the briefing does the reading.
- A calorie target set under 1,800 is an action of its own, and it shows from the first day.

Fixed along the way:

- A weekly rate was rounded twice, so 0.853% a week could show as 0.8 when it is 0.9. It is rounded once now, on the card and in the briefing.
- More sessions than planned reads "5, with 4 planned", not "5 of 4".

The diet break gets a rough calorie figure ("about 2,500"): your target plus the plan's deficit, lowered for the weight lost. It is an estimate and is always said as "about".

## 0.14.1

An audit of the Coach and the rest of the app. Every fix below has a test that failed before it and passes now.

The Coach, lifts:

- It no longer says "if every set gets to the top, the weight goes up" when the next step up is a big one and the jump rule really wants a few more reps. It now names the exact number, taken from the jump rule itself.
- "Every planned set got there" replaces "every set", because an extra tired set does not count against you.
- A heavy first set is talked about as that set ("set 1 at 17.5 kg was too heavy"), and it never tells you to go lighter than the weight most of your sets used.
- A deload is not judged. Fewer reps at the same weight is the point of it.
- "This lift has gone down two sessions in a row" waits until all the planned sets of today's lift are in. After one set it always looked like a drop.
- Only light sets before the work are warm-ups. A lighter set after a heavy one is real work and is counted.

The jump rule:

- One or two reps with a weight that was far too heavy no longer counts as "done". A heavier set counts only if it reached the bottom of the rep range.

The Coach, days and weeks:

- The week verdict never quotes a food average from too few days, and can no longer say "0 kcal from 0 days".
- The weight line only names a pace (on pace, slow, flat) when there are three usable weeks behind it.
- When two quiet periods overlap (the first fortnight and starting creatine), the date given is when the later one clears, and it says it still needs your weigh-ins.
- "Give it time" after a target change names the real day the verdict comes back.
- After raising your target for "too fast", it does not ask for another 150 kcal the next week. The stall choice now says to give it 2 weeks.
- An old waist reading is no longer used to call a flat scale "recomposing".
- A calorie target set under 1,800 is never something the Coach tells you to aim for. It measures against 1,800 and says the target is too low.
- The evening protein reminder also works after midnight, before the day rolls over.
- The note about lifts with no sets stays quiet until the recap has something in it.
- Changing your calorie target and putting it straight back the same day is not counted as a change.

The rest of the app:

- A total no longer shows a missing number as zero. Today, the Food screen and a meal's heading say "at least" or "not known" when a logged food has no figure for protein, carbs or fat. The copied text for Claude marks those with a +.
- The averages on Progress count the same days the Coach does: finished days with enough logged. A half-logged day, or today, no longer drags them down.
- The old "Eating very little" warning is gone. It used half-logged days and could disagree with the Coach, which covers it properly.
- Damaged data cannot crash a screen: a day that is not a real date, text where a number belongs in a set, a broken food list, or a broken target date are left out.
- A saved dumbbell list is always put in order.

## 0.14.0

The Coach. It checks what you did against your plan, so you do not have to ask anyone. Fixed rules from your plan, worked out on the phone: no AI, no internet, no new data stored, and it only reads what you logged.

- **After a lift.** Under "Log it" and in the recap, one line says whether the weight was right for the rep range. It judges your first set at the working weight, and it only promises a jump when the next sheet really will give one. It ends with "Judged from reps and weight only."
- **Sets.** A note when you did more or fewer sets than the sheet asked for (one extra set is always fine), and when a Full session looks like a Minimum one.
- **Yesterday's food, on Today.** Calories, protein and the fat floor against your targets, in at most two lines. A day with too little logged is not judged and is not counted. One day over target is never a worry. After 7 pm one protein reminder is allowed.
- **The week, on Progress and Today.** Each Thursday: your weight trend over two weeks, food, protein, steps, sessions, lifts and waist, with one verdict and at most two things to do. It stays quiet for the first two weeks, the diet break and ten days after starting creatine, and says "not enough data yet" instead of guessing.
- **Copy my data for Claude** now includes the Coach's rule codes, so a chat can check what the Coach said.
- **Safety rails.** It never suggests under 1,800 kcal, more than 1 kg a week of loss, a fat target under 50 g, or cutting protein. A test checks this on hundreds of made-up weeks.

Changed in the rules:

- Only the planned sets decide whether the weight goes up. An extra tired set never holds it back, and a warm-up (under 70% of your heaviest set) never blocks a jump.
- "Losing too fast" now means more than 1% of your bodyweight a week, and never more than 1 kg.
- The app remembers one new thing: the day your calorie target last changed, so the Coach does not suggest a second cut before the first has had time to work.
- The old Stall check card on Progress is replaced by the Coach's week check, which includes it.

## 0.13.0

Logging a lift as you finish it, so nothing has to be remembered at the end:

- Tap a lift on the Workout sheet and there is a "Log it" part. Each set is one line with the weight already filled in. The reps are one tap each: a row of numbers around the lift's range. Type them instead if you got something outside it.
- It saves the moment you tap or type. There is no Save button here, and "Saved." shows under the lift. A set that cannot be saved (reps but no weight) says so and leaves the last good save as it was.
- The lift gets a tick and "Logged: ..." on the sheet, so you can see what is left.
- "Same as last time" puts down exactly what the last session of that lift was. "Add a set" is there for a third set.
- A weight typed into one set carries down to the sets after it that still held the old weight, the same as in the recap.
- The recap after Full session or Minimum has what was logged already in it. Anything typed there is still kept until Save recap, as before.
- "Did the alternative" is there too, for when a machine was busy.

## 0.12.2

- The sheet goes back to the plan's own sets: 2 to start, then the full sets on main lifts. The 3-sets choice from 0.12.1 is gone. A third set is added in the recap with "Add a set", and the app still reads it correctly.

## 0.12.1

- The Foundation phase shows 3 sets on every lift, in the first week and after. The plan started with 2, and 3 is what is being done. Settings, Your gym, has a choice to go back to the plan's own sets. A minimum session is still 2 and a deload is still half.

## 0.12.0

Workout recap:

- The recap now takes every set on its own line, each with its weight and its reps. "Add a set" is there for when more sets were done than the sheet asked for.
- Nothing is saved until Save recap is tapped. What has been typed is kept on the phone until then, so closing the app before Save does not lose it, and "Not saved yet" shows while it waits.
- A weight typed into one set carries down to the sets after it that still held the old weight.
- When the sets of a lift were not all at one weight, the next sheet goes by the weight most sets were done with (the lighter one on a tie). A heavier set counts as done. A lighter set means the weight stays. The lift says so when it is opened.
- Recaps saved before this, with one weight and the fewest reps, still read correctly and can be corrected set by set.

Motion, for the things that used to pop in and out:

- The rest timer slides out from under the top controls and back, and the page makes room for it smoothly.
- A sheet now slides back down when it closes, the way it came up.
- Screens that change inside one tab move like a page change: the Add screen and recipes on Food, stepping to another day, finishing a session and going on to the recap.
- A lift's details, a guide topic and the swap form unfold to their height. The full calendar and the week strip settle in when they swap.
- Progress bars glide from where they stood to their new place.
- Messages such as "Saved" and the update prompt arrive softly, and buttons give a little when pressed.
- All of it is switched off for anyone who has asked their phone for less motion.

## 0.11.0

New:

- Settings, Plan dates: move the day each phase starts, and the goal date. This is how the diet break is moved over an exam fortnight. A pace of more than 1 kg a week is warned about once before it saves, and the original dates can be put back.
- Progress, Week by week: one line per plan week with average calories and protein, sessions done, and how far the 7-day weight average moved. The same lines are in "Copy my data for Claude".
- A scanned product no longer starts at the weight of the whole pack when Open Food Facts has that as its serving. Drinks are in ml everywhere, and Copy the label can be set to ml.
- A built-in food that was removed can be brought back, from the bottom of My foods.

Fixed, data safety:

- Reopening the app while a save was still waiting to sync (closed while offline) could start with the days empty, and the next thing logged would then replace the real list. The waiting saves are now loaded with everything else.
- An old device-only copy of the data could be uploaded over the account when the app started with no connection on a device with nothing saved yet. It now waits for the server's answer, and only fills an account that is completely empty.
- On a new device with no connection, the setup screen could show for an account that already had a profile. It now waits.
- Food is added and removed in the database one entry at a time, not as the whole list, so two devices logging at once, or one that was offline, cannot drop each other's entries.
- A damaged or odd saved plan (from a bad sync or an edited backup file) could stop every screen from opening. Only values of the right kind are taken now.
- Restoring a backup while offline did nothing visible and then went through by itself later. It is refused until there is a connection.
- The daily backup could be started several times before the first had landed. When the data outgrows a backup, the app now says so, where before it skipped the backup without a word.

Fixed, everything else:

- Settings: Save on the day rollover and on the dumbbell list saved, then crashed before saying so.
- The stall check called the diet break a stall and said to cut calories, and could call the water lost just after it "too fast". It now knows a flat scale is the point of the break.
- The amount box: an empty or impossible amount logged the last good amount instead. Add is now off until the box holds a real amount.
- A number typed the way the app shows it, like 6,400 steps, was read as 6.4.
- Removing a food while picking an ingredient threw away the recipe being built.
- A food with unknown protein, carbs or fat could not be renamed without typing a made-up zero. Editing a built-in food reset its usual number of servings.
- A zero-calorie product could not be saved from its label.
- On an earlier day, Recent now means your recent foods, the entry sheet says which day it removes from, and a looked-up food is dated today.
- The camera could be left running if the scanner was closed and reopened quickly.
- A past session opened after a lift was swapped showed the new lift, blank. It shows the lift that was done.
- "Copy my data for Claude" listed sheets that were opened but never trained as sessions, and showed swapped lifts by their code name.
- The "Added" line left an empty gap after it faded.
- A form that hits a fault now says so, and no longer just sits there.
- A refused save no longer claims that nothing was lost.

## 0.10.6

- Tap any logged food, in any meal, to fill in or correct its calories, protein, carbs and fat. Useful for a Quick add that went in with calories only.
- Five more built-in foods, marked as estimates: khubz, tandoori roti, qeema matar, roast chicken thigh, roast potato and tomato.

## 0.10.5

- After adding a food, the Add screen shows a short "Added" line with its name and calories.

## 0.10.4

- Food screen: meals are open sections now, not boxes. Each has its name on a rule with the total at the far end, and a plain "+ Add" row in place of the boxed button.

## 0.10.3

- Label reader: uses Google's light model first, which answers in two to three seconds, and moves on to another model if one is slow or refuses. It gives up after a few tries with a message that says what Google said.
- While a table is being read, the held picture says "Reading the table" over it.

## 0.10.2

- The barcode scanner can read a nutrition table too: point the camera at the table and tap "No barcode? Read the nutrition table". It opens Copy the label with the boxes filled in to check.
- Settings accepts Google AI keys in any shape, and says which keys are saved after Save.

## 0.10.1

- Barcode scanner: the fixed box is gone. An outline now forms around the barcode where the camera sees it, and turns lime when it has been read.

## 0.10.0

- Photograph a nutrition label and the Copy the label form fills itself in, for you to check before saving. It needs a free Google AI key in Settings, and sends the photo of the label to Google. Reachable after a barcode that is not found, and from New food.

## 0.9.1

- Barcode scanner replaced with ZXing-C++ (WebAssembly), which reads small, tilted and blurred barcodes far better than the old one. It works at full HD, looks mainly at the middle of the picture, zooms in where the phone allows, and accepts a number only when two looks in a row agree.
- The aim box is smaller: hold the phone back so the barcode stays in focus.
- Fixed: the "Or type the number" box could not be typed in until Look it up had been tapped.

## 0.9.0

- The Food screen can step back to earlier days, to add or fix a meal that was missed. Leaving the tab returns it to today.
- Barcode scanner: asks the camera for a sharper picture, reads tilted or slightly blurred barcodes, shows a frame to aim with, and uses the phone's own barcode reader where there is one.

## 0.8.2

- A scanned barcode that is not on the list opens "Copy the label": the boxes follow the order of a nutrition label, energy can be typed in kcal or kJ, and the numbers can be per 100 g or per serving weight.

## 0.8.1

- A saved food can be removed straight from the sheet it is picked on. Removing asks for a second tap.

## 0.8.0

- Scan a barcode from the Add screen, or type the number under it. Packaged foods come from Open Food Facts and are saved to My foods. A product that is not listed opens New food with the barcode kept, so the next scan finds your own entry.
- The scanner is the open-source ZXing library, kept inside the app (`vendor/`, Apache 2.0 licence).

## 0.7.0

- Food lookups: with a free USDA key saved in Settings, the Add screen can search the USDA food list for plain foods. A food picked from it is saved to My foods, so it works offline afterwards.
- Looked-up foods show sugar, saturated fat and salt when the source has them. These are shown, not counted.

## 0.6.0

- Food screen rebuilt: Breakfast, Lunch, Snacks and Dinner each have their own Add button. Adding opens one screen with search, Recent (one tap to add the same amount again), My foods, Meals (add an earlier meal again in one tap) and Recipes.
- Recipes: build a dish from saved foods, say how many servings it makes, and the app works out one serving. With the cooked weight filled in, it can be logged by grams.
- Quick add: type calories straight in. Protein, carbs and fat are optional.
- A food with a known weight per serving can be logged in grams or in servings.
- 29 more foods: plain foods from USDA, and desi breads, snacks and dishes from public calorie sites. Every food says where its numbers came from. A number the sources did not give is shown as unknown, never guessed.

## 0.5.0

- Settings has a "Your gym" card: the list of dumbbell weights can be edited.
- A lift the gym does not have can be swapped for another one from the Workout screen, and undone there or in Settings. The swap starts with its own history.
- The phase after the diet break offers a new calorie target once, worked out from the weight lost. Nothing changes unless it is accepted.
- Guide: sample days and food swaps, linked from the Food screen.

## 0.4.0

- Email and password sign-in, for iPhones, where the Google sign-in window does not work for this app. A password is added to the same account from Settings.

## 0.3.0

- Connected to the Firebase project. The app now asks for a Google login and keeps data in the private database.

## 0.2.0

- Data safety: one automatic whole-app backup a day (14 kept in the account, 3 on a device-only setup), restore from any of them or from a backup file, with the current state kept first so a restore can be undone.
- Saving a day now replaces only the fields that changed, so two devices cannot wipe each other's entries for the same day.
- Signing out waits until everything has synced. The app asks the browser to keep its storage.
- Progress shows when a backup file was last saved.

## 0.1.0

- Bare Today screen with sample numbers: week strip, next session, calories and macros, steps, water, weight, supplements.
- Rules module with tests: day rollover, phase by date, step ramp, week strip, next session, biggest macro gap.
- Week strip unfolds into the full plan calendar (October to March, weeks from Sunday, a heading where each phase starts).
- Tap any day up to today to mark it done, minimum or missed, with an optional reason. A planned day that passes with nothing logged counts as missed.
- A missed session stays next in line and every later day moves along. After 4 misses in a row the app offers to push the phases back a week.
- `?today=YYYY-MM-DD` in the address previews another date.
- Black and white theme: white is the accent, colour is kept for data. Rounded outlined panels with the label set into the border, and a paper ticket for the next session.
- Guide page, opened from the phase pill: every phase plus short notes on RIR, the jump rule, missed days, weighing in and the rest.
- Liquid glass tab bar (narrow pill, label only on the active tab), plus glass on the floating phase pill, settings button and day sheet.
- Page transitions: tabs slide in from the side they sit on, Guide and Settings rise up, the day sheet slides up.
- Core Tracker, on this device: first-run setup, Settings (targets with a warning under the calorie and fat floors, day rollover), water, steps, weight and supplement logging, session marks that save.
- Food screen: preloaded and custom foods, search, amount by grams or servings, meals, edit and remove.
- Home screen install: icon, manifest, offline app shell and an "Update available" prompt. Version shown in Settings.
- Gym Logger: the four sessions with all 32 lifts, sets that follow the phase, set logging with last time's numbers, the jump rule, minimum session switch, rest timer, form video and alternative buttons, cardio log, and editing past sessions from the calendar.
- Insights: weight chart against the plan line (flat through the diet break), 7-day average, waist, sessions this week, stall check, last 7 days, a line per lift, phases, photo reminder.
- Your data: "Copy my data for Claude", a JSON backup file and a CSV spreadsheet.
- Gym flow reworked for a phone that stays in the bag: a session sheet with today's weights, a one-tap finish (Full session or Minimum), and a short recap (weight and fewest reps per lift).
- Audit fixes: the schedule runs on past the plan's end date; a logged session anchors the cycle; deloads hold the weight; shared lifts are judged by their own rep range; marks and workouts stay in step; the app refreshes when the day changes; saved data is never dropped on a format change and unreadable data is backed up; loaded data is cleaned so one bad value cannot break a screen; two open tabs stay in step.
- New checks and warnings: numbers that cannot be right at setup, a pace of more than 1 kg a week, a weigh-in far from the last one, a food whose calories do not match its macros, a logged average under the calorie floor, and a pointer on Today when the stall check has something to say.
- Push phase: pick two lagging muscles for one extra set a week.
- Firebase login and sync are written but switched off until a config is added. Security rules are in `firestore.rules`.
