# Changelog

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
