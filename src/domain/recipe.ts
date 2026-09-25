export type CookingMethod = 'raw' | 'boil' | 'steam' | 'stir-fry' | 'pan-fry' | 'bake' | 'deep-fry';

export interface CatalogFood {
  id: string;
  name: string;
  group: '食材' | '调味料' | '食用油';
  /** USDA FoodData Central SR Legacy ID; nutrients describe 100 g edible raw product. */
  fdcId: number;
  per100g: { energyKcal: number; proteinG: number; carbsG: number; fatG: number; sodiumMg: number };
}

export interface RecipeLine { foodId: string; weightG: number }
export interface RecipeInput {
  lines: RecipeLine[];
  method: CookingMethod;
  oilId: string;
  retainedOilG: number;
  cookedWeightG?: number;
  servingWeightG?: number;
}

export interface RecipeNutrition {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
}

const methods: CookingMethod[] = ['raw', 'boil', 'steam', 'stir-fry', 'pan-fry', 'bake', 'deep-fry'];
const empty = (): RecipeNutrition => ({ energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 });

function add(target: RecipeNutrition, food: CatalogFood, grams: number): void {
  for (const key of ['energyKcal', 'proteinG', 'carbsG', 'fatG', 'sodiumMg'] as const) {
    target[key] += food.per100g[key] * grams / 100;
  }
}

export function calculateRecipe(input: RecipeInput, catalog: readonly CatalogFood[]) {
  if (!methods.includes(input.method)) throw new Error('请选择烹饪方式。');
  if (!input.lines.length || input.lines.length > 30) throw new Error('请添加 1–30 种食材或调味料。');
  if (!Number.isFinite(input.retainedOilG) || input.retainedOilG < 0 || input.retainedOilG > 500) throw new Error('留在菜中的油需在 0–500 g 之间。');
  const index = new Map(catalog.map((food) => [food.id, food]));
  const total = empty();
  let rawWeightG = input.retainedOilG;
  for (const line of input.lines) {
    const food = index.get(line.foodId);
    if (!food || food.group === '食用油' || !Number.isFinite(line.weightG) || line.weightG <= 0 || line.weightG > 10_000) {
      throw new Error('食材或调味料及其重量无效。');
    }
    add(total, food, line.weightG);
    rawWeightG += line.weightG;
  }
  if (input.retainedOilG > 0) {
    const oil = index.get(input.oilId);
    if (!oil || oil.group !== '食用油') throw new Error('请选择有效食用油。');
    add(total, oil, input.retainedOilG);
  }
  const cookedWeightG = input.cookedWeightG ?? rawWeightG;
  if (!Number.isFinite(cookedWeightG) || cookedWeightG <= 0 || cookedWeightG > 100_000) throw new Error('成品重量无效。');
  const servingWeightG = input.servingWeightG ?? cookedWeightG;
  if (!Number.isFinite(servingWeightG) || servingWeightG <= 0 || servingWeightG > cookedWeightG) throw new Error('本次食用重量不能超过成品总重。');
  const fraction = servingWeightG / cookedWeightG;
  const serving = empty();
  const per100g = empty();
  for (const key of ['energyKcal', 'proteinG', 'carbsG', 'fatG', 'sodiumMg'] as const) {
    serving[key] = total[key] * fraction;
    per100g[key] = total[key] * 100 / cookedWeightG;
  }
  return { total, serving, per100g, rawWeightG, cookedWeightG, servingWeightG, measuredCookedWeight: input.cookedWeightG !== undefined };
}
