import { describe, expect, it } from 'vitest';
import { calculateRecipe } from '../src/domain/recipe';
import type { CatalogFood } from '../src/domain/recipe';

const catalog: CatalogFood[] = [
  { id: 'chicken', name: '鸡胸肉', group: '食材', fdcId: 1, per100g: { energyKcal: 120, proteinG: 22, carbsG: 0, fatG: 2, sodiumMg: 40 } },
  { id: 'salt', name: '盐', group: '调味料', fdcId: 2, per100g: { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 39000 } },
  { id: 'oil', name: '食用油', group: '食用油', fdcId: 3, per100g: { energyKcal: 884, proteinG: 0, carbsG: 0, fatG: 100, sodiumMg: 0 } },
];

describe('recipe nutrition', () => {
  const base = { lines: [{ foodId: 'chicken', weightG: 200 }, { foodId: 'salt', weightG: 2 }], method: 'stir-fry' as const, oilId: 'oil', retainedOilG: 10 };

  it('adds raw ingredients, seasonings and retained oil, then scales only the portion', () => {
    const result = calculateRecipe({ ...base, cookedWeightG: 180, servingWeightG: 90 }, catalog);
    expect(result.total.energyKcal).toBeCloseTo(328.4);
    expect(result.total.proteinG).toBeCloseTo(44);
    expect(result.total.fatG).toBeCloseTo(14);
    expect(result.total.sodiumMg).toBeCloseTo(860);
    expect(result.serving.energyKcal).toBeCloseTo(164.2);
    expect(result.per100g.energyKcal).toBeCloseTo(328.4 / 1.8);
  });

  it('does not invent extra calories from a cooking method or water loss', () => {
    const steamed = calculateRecipe({ ...base, method: 'steam', retainedOilG: 0, cookedWeightG: 160 }, catalog);
    const boiled = calculateRecipe({ ...base, method: 'boil', retainedOilG: 0, cookedWeightG: 220 }, catalog);
    expect(steamed.total.energyKcal).toBe(boiled.total.energyKcal);
    expect(steamed.per100g.energyKcal).toBeGreaterThan(boiled.per100g.energyKcal);
  });

  it('rejects unknown foods, invalid weights and impossible portions', () => {
    expect(() => calculateRecipe({ ...base, lines: [{ foodId: 'missing', weightG: 100 }] }, catalog)).toThrow();
    expect(() => calculateRecipe({ ...base, retainedOilG: -1 }, catalog)).toThrow();
    expect(() => calculateRecipe({ ...base, cookedWeightG: 100, servingWeightG: 101 }, catalog)).toThrow();
  });
});
