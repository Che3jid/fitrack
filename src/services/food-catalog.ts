import type { CatalogFood } from '../domain/recipe';
import { serverUrl } from './sync';

function validFood(value: unknown): value is CatalogFood {
  if (!value || typeof value !== 'object') return false;
  const food = value as Partial<CatalogFood>;
  if (typeof food.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(food.id)
    || typeof food.name !== 'string' || !food.name.trim() || food.name.length > 80
    || !['食材', '调味料', '食用油'].includes(food.group ?? '')
    || !Number.isSafeInteger(food.fdcId) || (food.fdcId ?? 0) <= 0
    || !food.per100g || typeof food.per100g !== 'object') return false;
  return (['energyKcal', 'proteinG', 'carbsG', 'fatG', 'sodiumMg'] as const).every((key) => {
    const amount = food.per100g?.[key];
    return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 100_000;
  });
}

export async function loadFoodCatalog(url: string, transport: typeof fetch = fetch): Promise<readonly CatalogFood[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await transport(serverUrl(url, '/api/catalog'), { method: 'GET', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`食物库服务器返回 ${response.status}。`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('foods' in payload)
      || !Array.isArray(payload.foods) || !payload.foods.length || payload.foods.length > 10_000
      || !payload.foods.every(validFood)
      || new Set(payload.foods.map((food: CatalogFood) => food.id)).size !== payload.foods.length) {
      throw new Error('服务器食物库格式无效。');
    }
    return payload.foods;
  } catch (cause) {
    if (cause instanceof TypeError || (cause instanceof DOMException && cause.name === 'AbortError')) {
      throw new Error('无法连接食物库服务器，请检查地址与网络。');
    }
    throw cause;
  } finally { clearTimeout(timer); }
}
