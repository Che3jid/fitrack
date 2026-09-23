import { describe, expect, it } from 'vitest';
import { buildTrends, shiftDate } from '../src/services/trends';
import { BackupService, createBackup, currentData, MAX_BACKUP_BYTES, parseBackup, recordCounts } from '../src/services/backup';
import { LocalRepository, parseState } from '../src/storage/local';
import { ProfileService } from '../src/services/profile';
import { RecordService } from '../src/services/records';
import { emptyState } from '../src/storage/repository';
import { lineChart } from '../src/components/chart';

const now = new Date('2026-09-23T03:00:00Z');
const profile = { sex: 'male' as const, ageYears: 30, heightCm: 175, weightKg: 70, activityLevel: 'moderate' as const, goal: 'maintain' as const };
async function setup(weight = 70) {
  let raw: string | null = null;
  let fail = false;
  let id = 0;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { if (fail) throw new Error('quota'); raw = value; } };
  const repo = new LocalRepository(() => storage);
  await new ProfileService(repo, () => now, () => `entity-${++id}`).save({ ...profile, weightKg: weight });
  const records = new RecordService(repo, () => now, () => `entity-${++id}`);
  const backups = new BackupService(repo, () => now);
  return { repo, records, backups, storage, fail: (value: boolean) => { fail = value; } };
}
const food = (date: string, energyKcal: number) => ({ date, energyKcal, name: '测试食物', mealType: 'lunch' as const, weightG: 100, proteinG: 20, carbsG: 30, fatG: 10 });

describe('calendar trend series', () => {
  it('returns missing values rather than zero for a completely empty range', () => {
    const rows = buildTrends(emptyState(), '2026-09-23', 7);
    expect(rows).toHaveLength(7);
    expect(rows[0]?.date).toBe('2026-09-17');
    expect(rows.every((row) => row.weight === null && row.intake === null && row.balance === null)).toBe(true);
    expect(rows.at(-1)?.intakeAverage).toEqual({ average: null, count: 0 });
  });
  it('uses six days before the visible range when calculating its first average', async () => {
    const { repo, records } = await setup();
    await records.saveWeight({ date: '2026-09-11', weightKg: 80 });
    await records.saveWeight({ date: '2026-09-17', weightKg: 70 });
    await records.saveWeight({ date: '2026-09-10', weightKg: 100 });
    const rows = buildTrends(await repo.read(), '2026-09-23', 7);
    expect(rows[0]?.weightAverage).toEqual({ average: 75, count: 2 });
    expect(rows.at(-1)?.weightAverage).toEqual({ average: 70, count: 2 });
  });
  it('excludes unfinished intake from averages but displays it and includes an explicit completed zero', async () => {
    const { repo, records } = await setup();
    await records.saveFood(food('2026-09-21', 2000));
    await records.setDietCompleted('2026-09-21', true);
    await records.saveFood(food('2026-09-22', 500));
    await records.setDietCompleted('2026-09-23', true);
    const rows = buildTrends(await repo.read(), '2026-09-23', 7);
    expect(rows.find((row) => row.date === '2026-09-22')?.intake).toBe(500);
    expect(rows.at(-1)?.intakeAverage).toEqual({ average: 1000, count: 2 });
    expect(rows.at(-1)?.intake).toBe(0);
  });
  it('keeps historical plan values and leaves unplanned dates missing', async () => {
    const { repo, records } = await setup();
    await records.saveFood(food('2026-09-22', 1000));
    await records.setDietCompleted('2026-09-22', true);
    await records.saveFood(food('2026-09-23', 1000));
    const rows = buildTrends(await repo.read(), '2026-09-23', 7);
    expect(rows.find((row) => row.date === '2026-09-22')?.balance).toBeNull();
    expect(rows.at(-1)?.balance).toBe(1000 - 2555.5625);
  });
  it('excludes soft-deleted measurements and meals', async () => {
    const { repo, records } = await setup();
    const state = await records.saveFood(food('2026-09-23', 1000));
    await records.setDeleted('foods', state.foods[0]!.id, true);
    await records.setDeleted('weights', state.weights[0]!.id, true);
    const last = buildTrends(await repo.read(), '2026-09-23', 7).at(-1)!;
    expect(last.weightAverage.count).toBe(0);
    expect(last.intakeAverage.count).toBe(0);
  });
  it('handles leap/year boundaries and validates ranges', () => {
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(buildTrends(emptyState(), '2026-01-01', 90)).toHaveLength(90);
    expect(() => buildTrends(emptyState(), '2026-09-23', 8)).toThrow();
    expect(() => buildTrends(emptyState(), '2026-02-30', 7)).toThrow();
    expect(() => buildTrends(emptyState(), '1900-01-01', 90)).toThrow();
  });
  it('draws gaps and distinguishes provisional points', () => {
    const svg = lineChart('摄入', ['2026-09-21', '2026-09-22', '2026-09-23'], [
      { label: '摄入', color: '#28583e', values: [1000, null, 2000], provisional: [false, false, true] },
    ], 'kcal', true);
    expect(svg).toContain('（记录中）');
    expect(svg).not.toMatch(/d="M[^\"]*L/);
    expect(lineChart('体重', ['2026-09-23'], [{ label: '体重', color: '#28583e', values: [null] }], 'kg')).toContain('暂时没有体重数据');
  });
});

describe('backup validation and recovery', () => {
  it('exports and imports an exact roundtrip including deleted entries without touching source data', async () => {
    const { repo, records, backups } = await setup();
    const saved = await records.saveFood(food('2026-09-23', 500));
    await records.setDeleted('foods', saved.foods[0]!.id, true);
    const before = await repo.read();
    const file = await backups.export();
    expect(parseBackup(file, '2026-09-23').data).toEqual(before);
    const preview = await backups.preview(file);
    expect(preview.incoming).toEqual(before);
    expect(await repo.read()).toEqual(before);
    expect(recordCounts(preview.incoming).deleted).toBe(1);
  });
  it('replaces without duplicates, preserves a recovery point and supports undo', async () => {
    const target = await setup(70);
    const source = await setup(80);
    await source.records.saveFood(food('2026-09-22', 1234));
    const before = await target.repo.read();
    const incoming = await source.repo.read();
    const imported = await target.backups.restore(await target.backups.preview(await source.backups.export()));
    expect(currentData(imported)).toEqual(incoming);
    expect(imported.recovery?.state).toEqual(before);
    expect(await new LocalRepository(() => target.storage).read()).toEqual(imported);
    const again = await target.backups.restore(await target.backups.preview(await source.backups.export()));
    expect(again.foods).toHaveLength(1);
    expect(again.recovery?.state).not.toHaveProperty('recovery');
    const restored = await target.backups.undo(again);
    expect(restored).toEqual(incoming);
    expect(restored.recovery).toBeUndefined();
  });
  it('undo restores the exact pre-import data', async () => {
    const target = await setup(70);
    const source = await setup(80);
    const before = await target.repo.read();
    const result = await target.backups.restore(await target.backups.preview(await source.backups.export()));
    expect(await target.backups.undo(result)).toEqual(before);
  });
  it('does not export the recovery copy', async () => {
    const { repo, backups } = await setup();
    await backups.restore(await backups.preview(await backups.export()));
    expect((await repo.read()).recovery).toBeDefined();
    expect(JSON.parse(await backups.export()).data).not.toHaveProperty('recovery');
  });
  it('supports restoring on an empty browser and undoing back to empty', async () => {
    const source = await setup();
    let raw: string | null = null;
    const repo = new LocalRepository(() => ({ getItem: () => raw, setItem: (_key, value) => { raw = value; } }));
    const backup = new BackupService(repo, () => now);
    const result = await backup.restore(await backup.preview(await source.backups.export()));
    expect(result.profile?.weightKg).toBe(70);
    expect(await backup.undo(result)).toEqual(emptyState());
  });
  it('rejects a stale preview or recovery confirmation after another write', async () => {
    const { repo, records, backups } = await setup();
    const preview = await backups.preview(await backups.export());
    await records.saveFood(food('2026-09-23', 500));
    const before = await repo.read();
    await expect(backups.restore(preview)).rejects.toThrow('发生了变化');
    expect(await repo.read()).toEqual(before);
    const imported = await backups.restore(await backups.preview(await backups.export()));
    await records.saveFood(food('2026-09-22', 100));
    await expect(backups.undo(imported)).rejects.toThrow('已更新');
  });
  it('leaves current state and previous recovery untouched if storage fills up', async () => {
    const { backups, repo, fail } = await setup();
    await backups.restore(await backups.preview(await backups.export()));
    const before = await repo.read();
    const preview = await backups.preview(await backups.export());
    fail(true);
    await expect(backups.restore(preview)).rejects.toThrow('保存失败');
    expect(await repo.read()).toEqual(before);
    await expect(backups.undo(before)).rejects.toThrow('保存失败');
    expect(await repo.read()).toEqual(before);
  });
  it('accepts legacy schema v1 inside the versioned backup format', async () => {
    const { backups } = await setup();
    const file = JSON.parse(await backups.export());
    file.data.schemaVersion = 1;
    delete file.data.foods; delete file.data.trainings; delete file.data.days;
    expect(parseBackup(JSON.stringify(file), '2026-09-23').data.schemaVersion).toBe(2);
  });
  it.each(['format', 'version', 'units', 'timezone', 'profile', 'duplicate', 'future', 'plan', 'owner', 'numeric', 'nested'])('rejects invalid backup: %s', async (kind) => {
    const { backups, repo } = await setup();
    const before = await repo.read();
    const file = JSON.parse(await backups.export());
    if (kind === 'format') file.format = 'other';
    if (kind === 'version') file.version = 999;
    if (kind === 'units') file.units.weight = 'lb';
    if (kind === 'timezone') file.timezone = 'UTC';
    if (kind === 'profile') file.data.profile.ageYears = -1;
    if (kind === 'duplicate') file.data.weights.push(file.data.weights[0]);
    if (kind === 'future') file.data.weights[0].date = '2099-01-01';
    if (kind === 'plan') file.data.plans[0].targetKcal += 10;
    if (kind === 'owner') file.data.weights[0].userId = 'someone-else';
    if (kind === 'numeric') file.data.profile.weightKg = '70';
    if (kind === 'nested') file.data.recovery = { savedAt: now.toISOString(), state: before };
    await expect(backups.preview(JSON.stringify(file))).rejects.toThrow('备份无效');
    expect(await repo.read()).toEqual(before);
  });
  it('rejects malformed/oversized files and unsupported storage recovery nesting', async () => {
    expect(() => parseBackup('{', '2026-09-23')).toThrow();
    expect(() => parseBackup('x'.repeat(MAX_BACKUP_BYTES + 1), '2026-09-23')).toThrow('20 MB');
    const { repo } = await setup();
    const state = await repo.read();
    expect(() => parseState(JSON.stringify({ ...state, recovery: { savedAt: now.toISOString(), state: { ...state, recovery: { savedAt: now.toISOString(), state } } } }))).toThrow();
    expect(JSON.parse(createBackup(state, now)).exportedAt).toBe(now.toISOString());
  });
});
