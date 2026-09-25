import { describe, expect, it } from 'vitest';
import type { ProfileInput } from '../src/domain/models';
import type { FoodInput, TrainingInput } from '../src/domain/records';
import { LocalRepository, STORAGE_KEY } from '../src/storage/local';
import { ProfileService } from '../src/services/profile';
import { RecordService } from '../src/services/records';
import { dailySummary } from '../src/services/summary';
import { escapeHtml } from '../src/utils/html';

const profile: ProfileInput = { sex: 'male', ageYears: 30, heightCm: 175, weightKg: 70, activityLevel: 'moderate', goal: 'lose' };
const food: FoodInput = { date: '2026-09-23', mealType: 'breakfast', name: ' 鸡胸肉 ', weightG: 100, energyKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
const training: TrainingInput = { date: '2026-09-23', exerciseType: '力量训练', durationMin: 60, estimatedKcal: 300 };
async function setup() {
  let raw: string | null = null;
  let fails = false;
  let now = new Date('2026-09-23T03:00:00Z');
  let id = 0;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { if (fails) throw new Error('quota'); raw = value; } };
  const repo = new LocalRepository(() => storage);
  const profiles = new ProfileService(repo, () => now, () => `id-${++id}`);
  const records = new RecordService(repo, () => now, () => `id-${++id}`);
  await profiles.save(profile);
  return { repo, records, profiles, storage, fail: (value: boolean) => { fails = value; }, setTime: (value: string) => { now = new Date(value); } };
}

describe('food records and completeness', () => {
  it('persists portion values and isolates dates', async () => {
    const { records, repo, storage } = await setup();
    await records.saveFood(food);
    await records.saveFood({ ...food, date: '2026-09-22', mealType: 'dinner', energyKcal: 999 });
    const state = await new LocalRepository(() => storage).read();
    const summary = dailySummary(state, food.date);
    expect(summary.foods).toHaveLength(1);
    expect(summary.foods[0]?.name).toBe('鸡胸肉');
    expect(summary.nutrition).toEqual({ energyKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    expect(dailySummary(await repo.read(), '2026-09-21').nutrition).toBeNull();
  });
  it('persists optional sodium and rejects invalid sodium', async () => {
    const { records, repo } = await setup();
    const saved = await records.saveFood({ ...food, sodiumMg: 840 });
    expect(saved.foods[0]?.sodiumMg).toBe(840);
    expect((await repo.read()).foods[0]?.sodiumMg).toBe(840);
    await expect(records.saveFood({ ...food, sodiumMg: -1 })).rejects.toThrow();
  });
  it('edits a record in place and moves it to another meal and date', async () => {
    const { records } = await setup();
    const before = await records.saveFood(food);
    const entry = before.foods[0]!;
    const after = await records.saveFood({ ...food, date: '2026-09-22', mealType: 'lunch', energyKcal: 200 }, entry.id);
    expect(after.foods).toHaveLength(1);
    expect(after.foods[0]?.createdAt).toBe(entry.createdAt);
    expect(dailySummary(after, food.date).nutrition).toBeNull();
    expect(dailySummary(after, '2026-09-22').nutrition?.energyKcal).toBe(200);
  });
  it('reopens both completed days after moving food', async () => {
    const { records } = await setup();
    const state = await records.saveFood(food);
    await records.setDietCompleted(food.date, true);
    await records.setDietCompleted('2026-09-22', true);
    const after = await records.saveFood({ ...food, date: '2026-09-22' }, state.foods[0]!.id);
    expect(after.days.every((day) => !day.dietCompleted)).toBe(true);
  });
  it('distinguishes no record from an explicitly completed zero-intake day', async () => {
    const { records, repo } = await setup();
    expect(dailySummary(await repo.read(), food.date).nutrition).toBeNull();
    const complete = dailySummary(await records.setDietCompleted(food.date, true), food.date);
    expect(complete.nutrition?.energyKcal).toBe(0);
    expect(complete.balance?.balanceKcal).toBe(-2555.5625);
    expect(dailySummary(await records.setDietCompleted(food.date, false), food.date).nutrition).toBeNull();
  });
  it('soft deletes and restores food without losing metadata; changes reopen completion', async () => {
    const { records } = await setup();
    const saved = await records.saveFood(food);
    const id = saved.foods[0]!.id;
    await records.setDietCompleted(food.date, true);
    const deleted = await records.setDeleted('foods', id, true);
    expect(deleted.foods).toHaveLength(1);
    expect(deleted.foods[0]?.deletedAt).toBeTruthy();
    expect(dailySummary(deleted, food.date).nutrition).toBeNull();
    expect(dailySummary(deleted, food.date).completed).toBe(false);
    await records.setDietCompleted(food.date, true);
    const restored = await records.setDeleted('foods', id, false);
    expect(dailySummary(restored, food.date).nutrition?.energyKcal).toBe(165);
    expect(dailySummary(restored, food.date).completed).toBe(false);
    expect(restored.foods[0]?.createdAt).toBe(saved.foods[0]?.createdAt);
    expect(restored.foods[0]?.deletedAt).toBeUndefined();
  });
  it.each([
    { name: ' ' }, { energyKcal: -1 }, { proteinG: NaN }, { weightG: 0 },
    { date: '2026-02-30' }, { date: '2026-09-24' }, { mealType: 'toString' },
  ])('rejects invalid food without writing: %j', async (patch) => {
    const { records, repo } = await setup();
    const before = await repo.read();
    await expect(records.saveFood({ ...food, ...patch } as FoodInput)).rejects.toThrow();
    expect(await repo.read()).toEqual(before);
  });
  it('rejects a stale edit to a deleted record', async () => {
    const { records } = await setup();
    const saved = await records.saveFood(food);
    const id = saved.foods[0]!.id;
    await records.setDeleted('foods', id, true);
    await expect(records.saveFood(food, id)).rejects.toThrow('记录已更改或删除');
  });
});

describe('training records', () => {
  it('adds, edits, deletes and restores without double-counting expenditure', async () => {
    const { records } = await setup();
    await records.saveFood(food);
    const saved = await records.saveTraining(training);
    const id = saved.trainings[0]!.id;
    const edited = await records.saveTraining({ ...training, durationMin: 90, estimatedKcal: 450 }, id);
    const summary = dailySummary(edited, training.date);
    expect(summary.trainingMinutes).toBe(90);
    expect(summary.trainingKcal).toBe(450);
    expect(summary.balance?.estimatedExpenditureKcal).toBe(2555.5625);
    expect(summary.balance?.balanceKcal).toBe(165 - 2555.5625);
    expect(dailySummary(await records.setDeleted('trainings', id, true), training.date).trainingKcal).toBe(0);
    expect(dailySummary(await records.setDeleted('trainings', id, false), training.date).trainingKcal).toBe(450);
  });
  it('supports a zero-calorie estimate but rejects zero duration and negative calories', async () => {
    const { records } = await setup();
    await expect(records.saveTraining({ ...training, estimatedKcal: 0 })).resolves.toBeDefined();
    await expect(records.saveTraining({ ...training, durationMin: 0 })).rejects.toThrow();
    await expect(records.saveTraining({ ...training, estimatedKcal: -1 })).rejects.toThrow();
    await expect(records.saveTraining(training, 'missing')).rejects.toThrow();
  });
});

describe('daily weight and profile synchronization', () => {
  it('upserts one record per day and updates the current profile and target', async () => {
    const { records } = await setup();
    const first = await records.saveWeight({ date: food.date, weightKg: 72 });
    const second = await records.saveWeight({ date: food.date, weightKg: 73 });
    expect(second.weights).toHaveLength(1);
    expect(second.weights[0]?.id).toBe(first.weights[0]?.id);
    expect(second.profile?.weightKg).toBe(73);
    expect(second.plans[0]?.profileSnapshot.weightKg).toBe(73);
  });
  it('backfilling an older measurement cannot replace a newer weight or any past plan', async () => {
    const { records, profiles, setTime } = await setup();
    const original = await profiles.read();
    setTime('2026-09-24T03:00:00Z');
    await records.saveWeight({ date: '2026-09-24', weightKg: 71 });
    const after = await records.saveWeight({ date: '2026-09-22', weightKg: 80 });
    expect(after.profile?.weightKg).toBe(71);
    expect(after.plans.find((plan) => plan.date === food.date)).toEqual(original.plans[0]);
  });
  it('deleting the latest weight falls back to the previous one and restoring updates current weight', async () => {
    const { records, setTime } = await setup();
    setTime('2026-09-24T03:00:00Z');
    const saved = await records.saveWeight({ date: '2026-09-24', weightKg: 71 });
    const id = saved.weights.find((entry) => entry.date === '2026-09-24')!.id;
    const deleted = await records.setDeleted('weights', id, true);
    expect(deleted.profile?.weightKg).toBe(70);
    expect(dailySummary(deleted, '2026-09-24').weight).toBeNull();
    expect(deleted.plans.find((plan) => plan.date === '2026-09-24')?.profileSnapshot.weightKg).toBe(70);
    expect((await records.setDeleted('weights', id, false)).profile?.weightKg).toBe(71);
  });
  it('deleting every measurement retains the last known profile and saving revives the dated record', async () => {
    const { records, profiles } = await setup();
    const before = await profiles.read();
    const deleted = await records.setDeleted('weights', before.weights[0]!.id, true);
    expect(deleted.profile?.weightKg).toBe(70);
    const saved = await records.saveWeight({ date: food.date, weightKg: 72 });
    expect(saved.weights).toHaveLength(1);
    expect(saved.weights[0]?.deletedAt).toBeUndefined();
    expect(saved.profile?.weightKg).toBe(72);
  });
  it('rejects invalid or future measurements', async () => {
    const { records } = await setup();
    await expect(records.saveWeight({ date: food.date, weightKg: 0 })).rejects.toThrow();
    await expect(records.saveWeight({ date: '2026-09-24', weightKg: 70 })).rejects.toThrow();
  });
});

describe('migration and atomic failure', () => {
  it('migrates v1 data without losing profile, plans or weights and persists v2 on the next write', async () => {
    const { profiles, storage } = await setup();
    const before = await profiles.read();
    const legacy = { schemaVersion: 1, profile: before.profile, plans: before.plans, weights: before.weights };
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const migrated = new LocalRepository(() => storage);
    const state = await migrated.read();
    expect(state.profile).toEqual(before.profile);
    expect(state.plans).toEqual(before.plans);
    expect(state.weights).toEqual(before.weights);
    expect(state.foods).toEqual([]);
    expect(JSON.parse(storage.getItem()!).schemaVersion).toBe(1);
    await new RecordService(migrated, () => new Date('2026-09-23T03:00:00Z'), () => 'new-food').saveFood(food);
    expect(JSON.parse(storage.getItem()!).schemaVersion).toBe(2);
    expect((await migrated.read()).foods).toHaveLength(1);
  });
  it('does not lose records or completion when a delete fails to persist', async () => {
    const { records, repo, fail } = await setup();
    const saved = await records.saveFood(food);
    await records.setDietCompleted(food.date, true);
    const before = await repo.read();
    fail(true);
    await expect(records.setDeleted('foods', saved.foods[0]!.id, true)).rejects.toThrow('保存失败');
    expect(await repo.read()).toEqual(before);
  });
  it('rejects corrupted new collections without overwriting them', async () => {
    const { repo, records, storage } = await setup();
    const bad = JSON.stringify({ ...await repo.read(), foods: 'invalid' });
    storage.setItem(STORAGE_KEY, bad);
    await expect(records.saveFood(food)).rejects.toThrow('原始数据已保留');
    expect(storage.getItem()).toBe(bad);
  });
  it('escapes user content for both text and attribute contexts', () => {
    expect(escapeHtml('<img src="x"> & \'')).toBe('&lt;img src=&quot;x&quot;&gt; &amp; &#39;');
  });
});
