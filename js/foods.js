// Preloaded foods. All values are approximate: home cooking varies a lot with oil and ghee.
// Macros are for one serving. byGrams foods are logged by weight, with `grams` in one serving.
// `amount` is the default when the food is picked. Every food can be edited in the app.
// fibreEst marks a fibre figure that is a rough estimate, not from a label.
// source says where the numbers came from: 'usda' (FoodData Central), 'web' (public calorie sites,
// which disagree with each other, so one middle figure is used), or nothing for the plan's own foods.
// A null means the sources gave no figure. It is shown as unknown and never guessed.

export const foods = [
  { id: 'chicken-strips', name: 'Chicken strips', serving: '100 g, frozen, from the pack', byGrams: true, grams: 100, amount: 150, kcal: 200, protein: 16, carbs: 12, fat: 9, fibre: 0.8 },
  { id: 'roti', name: 'Roti', serving: '1 medium whole-wheat (about 40 g)', grams: 40, amount: 1, kcal: 110, protein: 3, carbs: 22, fat: 1.5, fibre: 3, fibreEst: true },
  { id: 'rice', name: 'Basmati rice', serving: '1 cup cooked (about 158 g)', byGrams: true, grams: 158, amount: 158, kcal: 205, protein: 4, carbs: 45, fat: 0.5, fibre: 0.6, fibreEst: true },
  { id: 'masoor-daal', name: 'Masoor daal', serving: '1 cup cooked, 1 tsp ghee or oil tarka', amount: 1, kcal: 275, protein: 18, carbs: 40, fat: 6, fibre: 15, fibreEst: true },
  { id: 'chicken-karahi', name: 'Chicken karahi', serving: 'Low oil: 150 g chicken breast, 2 tsp oil', amount: 1, kcal: 370, protein: 47, carbs: 6, fat: 15, fibre: 2, fibreEst: true },
  { id: 'anda-bhurji', name: 'Anda bhurji', serving: '2 eggs plus 150 g egg whites, 1 tsp oil', amount: 1, kcal: 300, protein: 29, carbs: 6, fat: 16, fibre: 1, fibreEst: true },
  { id: 'dahi', name: 'Dahi', serving: '200 g plain full-fat', byGrams: true, grams: 200, amount: 200, kcal: 120, protein: 7, carbs: 9, fat: 6.5, fibre: 0, fibreEst: true },
  { id: 'whey', name: 'Whey scoop', serving: '1 scoop (about 30 g) in water', amount: 1, kcal: 120, protein: 24, carbs: 3, fat: 1.5, fibre: 0, fibreEst: true },
  { id: 'chicken-tikka', name: 'Chicken tikka', serving: '75 g, air-fried', byGrams: true, grams: 75, amount: 75, kcal: 125, protein: 23, carbs: 0, fat: 3, fibre: 0, fibreEst: true },
  { id: 'banana-dates', name: 'Banana and dates', serving: '1 medium banana, 3 small dates', amount: 1, kcal: 175, protein: 2, carbs: 45, fat: 0.5, fibre: 5, fibreEst: true },
  { id: 'chai', name: 'Chai', serving: '1 cup doodh patti, 150 ml low-fat milk, 1 tsp sugar', amount: 1, kcal: 70, protein: 5, carbs: 10, fat: 1.5, fibre: 0, fibreEst: true },
  { id: 'kachumber', name: 'Kachumber salad', serving: '1 bowl', amount: 1, kcal: 30, protein: 1, carbs: 6, fat: 0, fibre: 2, fibreEst: true },
  { id: 'sabzi', name: 'Mixed sabzi', serving: '100 g bhindi or lauki, 1 tsp oil', byGrams: true, grams: 100, amount: 100, kcal: 70, protein: 2, carbs: 7, fat: 5, fibre: 3, fibreEst: true },
  { id: 'pizza', name: 'Pizza', serving: '1 slice, medium thin-crust chicken', amount: 3, kcal: 258, protein: 12.7, carbs: 28.3, fat: 9.3, fibre: 1.3, fibreEst: true },
  { id: 'mutton-pulao', name: 'Mutton pulao', serving: '1 plate, estimated', amount: 1, kcal: 800, protein: 28, carbs: 95, fat: 32, fibre: 3, fibreEst: true },
  { id: 'garlic-naan', name: 'Garlic naan', serving: 'Half a naan, estimated', amount: 1, kcal: 160, protein: 4, carbs: 28, fat: 4, fibre: 1, fibreEst: true },
  { id: 'chocolate', name: 'Chocolate bar', serving: '1 bar, estimated', amount: 1, kcal: 230, protein: 3, carbs: 26, fat: 13, fibre: 1.5, fibreEst: true },

  // Plain foods, per 100 g, from USDA FoodData Central.
  { id: 'chicken-breast', name: 'Chicken breast, cooked', serving: '100 g', byGrams: true, grams: 100, amount: 150, kcal: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0, source: 'usda' },
  { id: 'egg-boiled', name: 'Egg, boiled', serving: '100 g (1 large egg is 50 g)', byGrams: true, grams: 100, amount: 50, kcal: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fibre: 0, source: 'usda' },
  { id: 'egg-whites', name: 'Egg whites', serving: '100 g', byGrams: true, grams: 100, amount: 150, kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, fibre: 0, source: 'usda' },
  { id: 'chana', name: 'Chana, boiled', serving: '100 g', byGrams: true, grams: 100, amount: 150, kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fibre: 7.6, source: 'usda' },
  { id: 'moong', name: 'Moong, boiled', serving: '100 g', byGrams: true, grams: 100, amount: 200, kcal: 105, protein: 7.5, carbs: 18.3, fat: 0.6, fibre: 6.4, source: 'usda' },
  { id: 'rajma', name: 'Rajma, boiled', serving: '100 g', byGrams: true, grams: 100, amount: 150, kcal: 127, protein: 8.7, carbs: 22.8, fat: 0.5, fibre: 6.4, source: 'usda' },
  { id: 'oats', name: 'Oats, dry', serving: '100 g', byGrams: true, grams: 100, amount: 50, kcal: 389, protein: 16.9, carbs: 66, fat: 6.9, fibre: 10.6, source: 'usda' },
  { id: 'greek-yoghurt', name: 'Greek yoghurt, non-fat', serving: '100 g', byGrams: true, grams: 100, amount: 150, kcal: 59, protein: 10.2, carbs: 3.6, fat: 0.4, fibre: 0, source: 'usda' },
  { id: 'greek-yoghurt-full', name: 'Greek yoghurt, full-fat', serving: '100 g', byGrams: true, grams: 100, amount: 150, kcal: 82, protein: 8.2, carbs: 3.2, fat: 4, fibre: 0, source: 'usda' },
  { id: 'laban', name: 'Laban, full-fat', serving: '100 ml, from pack labels', byGrams: true, grams: 100, amount: 240, kcal: 62, protein: 3, carbs: 4.6, fat: 3.6, fibre: 0, source: 'web' },
  { id: 'dates', name: 'Dates', serving: '100 g', byGrams: true, grams: 100, amount: 24, kcal: 277, protein: 1.8, carbs: 75, fat: 0.2, fibre: 6.7, source: 'usda' },
  { id: 'banana', name: 'Banana', serving: '100 g', byGrams: true, grams: 100, amount: 120, kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fibre: 2.6, source: 'usda' },
  { id: 'potato', name: 'Potato, boiled', serving: '100 g', byGrams: true, grams: 100, amount: 150, kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, fibre: 1.8, source: 'usda' },
  { id: 'tuna', name: 'Tuna, canned in water', serving: '100 g', byGrams: true, grams: 100, amount: 100, kcal: 116, protein: 26, carbs: 0, fat: 1, fibre: 0, source: 'usda' },
  { id: 'oil', name: 'Oil or ghee', serving: '100 g (1 tsp is about 5 g)', byGrams: true, grams: 100, amount: 5, kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, source: 'usda' },

  // Breads and snacks, per piece, from public calorie sites.
  { id: 'paratha', name: 'Paratha, plain', serving: '1 piece (about 79 g)', grams: 79, amount: 1, kcal: 258, protein: 5, carbs: 36, fat: 10, fibre: null, source: 'web' },
  { id: 'naan', name: 'Naan', serving: '1 piece (about 90 g)', grams: 90, amount: 1, kcal: 262, protein: 8.7, carbs: 45, fat: 5, fibre: null, source: 'web' },
  { id: 'samosa', name: 'Samosa, aloo', serving: '1 medium (about 70 g)', grams: 70, amount: 1, kcal: 250, protein: 4.5, carbs: 27, fat: 13, fibre: null, source: 'web' },
  { id: 'pakora', name: 'Pakora, onion', serving: '1 piece (about 30 g)', grams: 30, amount: 1, kcal: 83, protein: 1.5, carbs: 8, fat: 4, fibre: null, source: 'web' },
  { id: 'seekh-kebab', name: 'Seekh kebab', serving: '1 skewer (about 50 g)', grams: 50, amount: 1, kcal: 100, protein: 7.5, carbs: 2.5, fat: 7.5, fibre: null, source: 'web' },
  { id: 'shami-kebab-beef', name: 'Shami kebab, beef', serving: '1 piece', grams: null, amount: 1, kcal: 153, protein: 13.5, carbs: 7, fat: 8, fibre: null, source: 'web' },
  { id: 'shami-kebab-chicken', name: 'Shami kebab, chicken', serving: '1 piece', grams: null, amount: 1, kcal: 85, protein: 9, carbs: 4, fat: 4, fibre: null, source: 'web' },
  { id: 'chapli-kebab', name: 'Chapli kebab', serving: '1 patty (about 85 g)', grams: 85, amount: 1, kcal: 190, protein: 14, carbs: 8, fat: 11, fibre: null, source: 'web' },

  // Cooked dishes, per 100 g, from public calorie sites: the middle of what they give.
  { id: 'chicken-biryani', name: 'Chicken biryani', serving: '100 g', byGrams: true, grams: 100, amount: 300, kcal: 160, protein: 8.5, carbs: 19, fat: 6, fibre: null, source: 'web' },
  { id: 'beef-nihari', name: 'Beef nihari', serving: '100 g', byGrams: true, grams: 100, amount: 250, kcal: 170, protein: 12, carbs: 5, fat: 11, fibre: null, source: 'web' },
  { id: 'chicken-nihari', name: 'Chicken nihari', serving: '100 g', byGrams: true, grams: 100, amount: 250, kcal: 120, protein: 7.5, carbs: 3.5, fat: 8.5, fibre: null, source: 'web' },
  { id: 'chicken-korma', name: 'Chicken korma', serving: '100 g', byGrams: true, grams: 100, amount: 250, kcal: 160, protein: 10.5, carbs: 10, fat: 4.5, fibre: null, source: 'web' },
  { id: 'haleem', name: 'Haleem', serving: '100 g', byGrams: true, grams: 100, amount: 250, kcal: 128, protein: null, carbs: null, fat: null, fibre: null, source: 'web' },
  { id: 'aloo-gosht', name: 'Aloo gosht', serving: '100 g', byGrams: true, grams: 100, amount: 250, kcal: 195, protein: null, carbs: null, fat: null, fibre: null, source: 'web' },
];
