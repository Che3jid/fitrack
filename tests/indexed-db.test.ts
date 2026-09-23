import { describe, expect, it } from 'vitest';
import { ProfileService } from '../src/services/profile';
import { RecordService } from '../src/services/records';
import { databaseRows, stateFromDatabaseRows } from '../src/storage/indexed-db';
import { LocalRepository } from '../src/storage/local';
import { emptyState } from '../src/storage/repository';

const now = new Date('2026-09-23T03:00:00Z');

async function populatedState() {
  let raw: string | null = null;
  let id = 0;
  const repository = new LocalRepository(() => ({
    getItem: () => raw,
    setItem: (_key, value) => { raw = value; },
  }));
  await new ProfileService(repository, () => now, () => `db-${++id}`).save({
    sex: 'female', ageYears: 28, heightCm: 165, weightKg: 60,
    activityLevel: 'moderate', goal: 'maintain',
  });
  const records = new RecordService(repository, () => now, () => `db-${++id}`);
  await records.saveFood({
    date: '2026-09-23', mealType: 'breakfast', name: '燕麦', weightG: 60,
    energyKcal: 228, proteinG: 8, carbsG: 40, fatG: 4,
  });
  await records.saveTraining({ date: '2026-09-23', exerciseType: '力量训练', durationMin: 45, estimatedKcal: 260 });
  await records.setDietCompleted('2026-09-23', true);
  return repository.read();
}

describe('IndexedDB collection mapping', () => {
  it('preserves profile, food, training, weight, plan and day collections', async () => {
    const state = await populatedState();
    const rows = databaseRows(state);
    expect(rows.profiles).toHaveLength(1);
    expect(rows.foods[0]?.name).toBe('燕麦');
    expect(rows.trainings[0]?.durationMin).toBe(45);
    expect(rows.weights).toHaveLength(1);
    expect(rows.plans).toHaveLength(1);
    expect(rows.days[0]?.dietCompleted).toBe(true);
    expect(stateFromDatabaseRows(rows)).toEqual(state);
  });

  it('stores the bounded recovery snapshot in metadata', async () => {
    const state = { ...(await populatedState()), recovery: { savedAt: now.toISOString(), state: emptyState() } };
    const rows = databaseRows(state);
    expect(rows.meta.recovery?.savedAt).toBe(now.toISOString());
    expect(stateFromDatabaseRows(rows)).toEqual(state);
  });

  it('rejects duplicate profiles and corrupt collection rows', async () => {
    const rows = databaseRows(await populatedState());
    rows.profiles.push(rows.profiles[0]!);
    expect(() => stateFromDatabaseRows(rows)).toThrow('Invalid database rows');
    rows.profiles.pop();
    rows.foods[0]!.weightG = -1;
    expect(() => stateFromDatabaseRows(rows)).toThrow();
  });
});
