// Preloaded foods. All values are approximate: home cooking varies a lot with oil and ghee.
// Macros are for one serving. byGrams foods are logged by weight, with `grams` in one serving.
// `amount` is the default when the food is picked. Every food can be edited in the app.
// fibreEst marks a fibre figure that is a rough estimate, not from a label.

export const foods = [
  { id: 'chicken-strips', name: 'Chicken strips', serving: '100 g, frozen, from the pack', byGrams: true, grams: 100, amount: 150, kcal: 200, protein: 16, carbs: 12, fat: 9, fibre: 0.8 },
  { id: 'roti', name: 'Roti', serving: '1 medium whole-wheat (about 40 g)', amount: 1, kcal: 110, protein: 3, carbs: 22, fat: 1.5, fibre: 3, fibreEst: true },
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
];
