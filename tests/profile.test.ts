import { describe, expect, it } from 'vitest';
import type { ProfileInput } from '../src/domain/models';
import { ProfileService } from '../src/services/profile';
import { LocalRepository, parseState, STORAGE_KEY } from '../src/storage/local';
import type { KeyValueStorage } from '../src/storage/local';
import { dateKey } from '../src/utils/date';

class MemoryStorage implements KeyValueStorage {
  values = new Map<string, string>();
  failWrite = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error('QuotaExceeded');
    this.values.set(key, value);
  }
}
const input: ProfileInput = { sex: 'male', ageYears: 30, heightCm: 175, weightKg: 70, activityLevel: 'moderate', goal: 'lose' };
function setup() {
  const storage = new MemoryStorage();
  const repo = new LocalRepository(() => storage);
  let now = new Date('2026-09-23T03:00:00Z');
  let id = 0;
  const service = new ProfileService(repo, () => now, () => `test-${++id}`);
  return { storage, repo, service, setTime: (value: string) => { now = new Date(value); } };
}
describe('profile persistence and plan history', () => {
  it('starts empty without seeding fake records', async () => {
    const { service, storage } = setup();
    expect(await service.today()).toEqual({ schemaVersion: 1, profile: null, plans: [], weights: [] });
    expect(storage.values.size).toBe(0);
  });
  it('saves a complete profile, daily plan and starting weight together, surviving a new repository instance', async () => {
    const { service, storage } = setup();
    const saved = await service.save(input);
    expect(saved.plans[0]?.targetKcal).toBeCloseTo(2172.228125);
    expect(saved.weights[0]?.weightKg).toBe(70);
    expect(saved.plans[0]?.profileSnapshot).toEqual(input);
    expect(await new ProfileService(new LocalRepository(() => storage)).read()).toEqual(saved);
  });
  it('updates today in place and avoids duplicate weight and plan records', async () => {
    const { service, setTime } = setup();
    const before = await service.save(input);
    setTime('2026-09-23T04:00:00Z');
    const after = await service.save({ ...input, weightKg: 72, goal: 'gain' });
    expect(after.plans).toHaveLength(1);
    expect(after.weights).toHaveLength(1);
    expect(after.profile?.id).toBe(before.profile?.id);
    expect(after.plans[0]?.id).toBe(before.plans[0]?.id);
    expect(after.plans[0]?.createdAt).toBe(before.plans[0]?.createdAt);
    expect(after.plans[0]?.updatedAt).not.toBe(before.plans[0]?.updatedAt);
    expect(after.weights[0]?.id).toBe(before.weights[0]?.id);
    expect(after.weights[0]?.weightKg).toBe(72);
    expect(after.plans[0]?.targetKcal).toBeCloseTo(2845.21875);
  });
  it('preserves past snapshots and weights after profile changes on the next day', async () => {
    const { service, setTime } = setup();
    const before = await service.save(input);
    setTime('2026-09-23T16:00:00Z');
    const after = await service.save({ ...input, weightKg: 68 });
    expect(after.plans).toHaveLength(2);
    expect(after.plans[0]).toEqual(before.plans[0]);
    expect(after.weights[0]).toEqual(before.weights[0]);
    expect(after.plans[1]?.date).toBe('2026-09-24');
    expect(after.weights[1]?.date).toBe('2026-09-24');
    expect(after.profile?.weightKg).toBe(68);
  });
  it('creates only the opened day, does not backfill missed days or fabricate weigh-ins', async () => {
    const { service, setTime } = setup();
    await service.save(input);
    setTime('2026-09-26T03:00:00Z');
    const after = await service.today();
    expect(after.plans.map((plan) => plan.date)).toEqual(['2026-09-23', '2026-09-26']);
    expect(after.weights).toHaveLength(1);
    expect(await service.today()).toEqual(after);
  });
  it('does not record an unchanged weight when only a goal is edited', async () => {
    const { service, setTime } = setup();
    const before = await service.save(input);
    setTime('2026-09-24T03:00:00Z');
    const after = await service.save({ ...input, goal: 'maintain' });
    expect(after.weights).toEqual(before.weights);
  });
  it('rejects invalid input without changing persistent state', async () => {
    const { service, storage } = setup();
    await service.save(input);
    const before = storage.getItem(STORAGE_KEY);
    await expect(service.save({ ...input, ageYears: 17 })).rejects.toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });
  it('preserves all previous state on quota failure and can retry', async () => {
    const { service, storage } = setup();
    const before = await service.save(input);
    storage.failWrite = true;
    await expect(service.save({ ...input, weightKg: 72 })).rejects.toThrow('保存失败');
    expect(await service.read()).toEqual(before);
    storage.failWrite = false;
    expect((await service.save({ ...input, weightKg: 72 })).profile?.weightKg).toBe(72);
  });
  it('serializes concurrent updates without losing a previous update', async () => {
    const { repo, service } = setup();
    await service.save(input);
    const increment = () => repo.update((state) => ({ ...state, profile: { ...state.profile!, weightKg: state.profile!.weightKg + 1 } }));
    await Promise.all([increment(), increment()]);
    expect((await repo.read()).profile?.weightKg).toBe(72);
  });
});

describe('storage boundaries', () => {
  it.each(['broken JSON', '{"schemaVersion":2,"profile":null,"plans":[],"weights":[]}', '{}'])('keeps unreadable data instead of resetting it: %s', async (raw) => {
    const { storage, service } = setup();
    storage.setItem(STORAGE_KEY, raw);
    await expect(service.read()).rejects.toThrow('原始数据已保留');
    await expect(service.save(input)).rejects.toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('reports unavailable browser storage', async () => {
    const repo = new LocalRepository(() => { throw new Error('SecurityError'); });
    await expect(repo.read()).rejects.toThrow('无法读取浏览器存储');
  });
  it('rejects tampered identities, dates, snapshots, duplicate dates and numeric values', async () => {
    const { service } = setup();
    const good = await service.save(input);
    for (const badPlan of [
      { ...good.plans[0], date: '2026-02-30' },
      { ...good.plans[0], targetKcal: '<img onerror=alert(1)>' },
      { ...good.plans[0], userId: 'another-user' },
      { ...good.plans[0], profileSnapshot: { ...input, sex: 'invalid' } },
    ]) expect(() => parseState(JSON.stringify({ ...good, plans: [badPlan] }))).toThrow();
    expect(() => parseState(JSON.stringify({ ...good, plans: [...good.plans, ...good.plans] }))).toThrow();
    expect(() => parseState(JSON.stringify({ ...good, profile: null }))).toThrow();
  });
});
describe('Shanghai business date', () => {
  it('rolls over at 16:00 UTC and handles a year boundary', () => {
    expect(dateKey(new Date('2026-09-23T15:59:59Z'))).toBe('2026-09-23');
    expect(dateKey(new Date('2026-09-23T16:00:00Z'))).toBe('2026-09-24');
    expect(dateKey(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01');
  });
});
