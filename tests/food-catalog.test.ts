import { describe, expect, it } from 'vitest';
import { foodCatalog } from '../src/data/food-catalog';
import { calculateRecipe } from '../src/domain/recipe';
import { loadFoodCatalog } from '../src/services/food-catalog';

describe('backend food catalog', () => {
  it('loads database values and uses them for recipe calculation', async () => {
    const edited = foodCatalog.map((food) => food.id === 'egg'
      ? { ...food, per100g: { ...food.per100g, energyKcal: 150 } } : food);
    let requested = '';
    const transport: typeof fetch = async (input) => {
      requested = String(input);
      return new Response(JSON.stringify({ foods: edited }), { status: 200 });
    };
    const loaded = await loadFoodCatalog('http://127.0.0.1:8787', transport);
    expect(requested).toBe('http://127.0.0.1:8787/api/catalog');
    expect(calculateRecipe({ lines: [{ foodId: 'egg', weightG: 100 }], method: 'boil', oilId: 'soybean-oil', retainedOilG: 0 }, loaded).total.energyKcal).toBe(150);
  });

  it('rejects malformed database food instead of using untrusted values', async () => {
    const transport: typeof fetch = async () => new Response(JSON.stringify({ foods: [
      { ...foodCatalog[0], per100g: { ...foodCatalog[0]!.per100g, energyKcal: -1 } },
    ] }), { status: 200 });
    await expect(loadFoodCatalog('http://127.0.0.1:8787', transport)).rejects.toThrow('格式无效');
  });
});
