import { describe, expect, it } from 'vitest';
import { ProfileService } from '../src/services/profile';
import { RecordService } from '../src/services/records';
import { SupplementService, supplementProgress } from '../src/services/supplements';
import { createBackup, parseBackup } from '../src/services/backup';
import { databaseRows, stateFromDatabaseRows } from '../src/storage/indexed-db';
import { LocalRepository, parseState } from '../src/storage/local';

const profile = { sex: 'female', ageYears: 28, heightCm: 165, weightKg: 60, activityLevel: 'moderate', goal: 'maintain' } as const;

async function setup() {
  let raw: string | null = null;
  let now = new Date('2026-09-30T15:30:00Z'); // 23:30 in Shanghai
  let sequence = 0;
  const repository = new LocalRepository(() => ({ getItem: () => raw, setItem: (_key, value) => { raw = value; } }));
  const clock = () => now;
  const id = () => `supplement-${++sequence}`;
  const profiles = new ProfileService(repository, clock, id);
  const records = new RecordService(repository, clock, id);
  const supplements = new SupplementService(repository, clock, id);
  await profiles.save(profile);
  return { repository, profiles, records, supplements, setTime: (iso: string) => { now = new Date(iso); } };
}

describe('daily supplement checklist', () => {
  it('keeps the plan through profile edits and starts each Shanghai day unchecked', async () => {
    const { repository, profiles, supplements, setTime } = await setup();
    await supplements.add(' 乳清蛋白 ');
    const id = (await repository.read()).profile!.supplementPlan![0]!.id;
    await supplements.setTaken(id, true);
    expect(supplementProgress(await repository.read(), '2026-09-30')).toEqual({ total: 1, taken: 1 });
    await profiles.save({ ...profile, weightKg: 61 });
    expect((await repository.read()).profile?.supplementPlan?.[0]?.name).toBe('乳清蛋白');
    setTime('2026-09-30T16:00:00Z');
    expect(supplementProgress(await repository.read(), '2026-10-01')).toEqual({ total: 1, taken: 0 });
    await supplements.setTaken(id, true);
    expect(supplementProgress(await repository.read(), '2026-10-01')).toEqual({ total: 1, taken: 1 });
    expect(supplementProgress(await repository.read(), '2026-09-30')).toEqual({ total: 1, taken: 1 });
  });

  it('preserves diet completion when checking supplements and preserves checks when changing diet completion', async () => {
    const { repository, records, supplements } = await setup();
    await supplements.add('肌酸');
    const id = (await repository.read()).profile!.supplementPlan![0]!.id;
    await records.setDietCompleted('2026-09-30', true);
    await supplements.setTaken(id, true);
    expect((await repository.read()).days[0]?.dietCompleted).toBe(true);
    await records.setDietCompleted('2026-09-30', false);
    expect((await repository.read()).days[0]?.supplementTakenIds).toEqual([id]);
    await supplements.remove(id);
    expect(supplementProgress(await repository.read(), '2026-09-30')).toEqual({ total: 0, taken: 0 });
  });

  it('survives IndexedDB mapping and JSON backup, and rejects corrupt checklists', async () => {
    const { repository, supplements } = await setup();
    await supplements.add('电解质饮品');
    const id = (await repository.read()).profile!.supplementPlan![0]!.id;
    await supplements.setTaken(id, true);
    const state = await repository.read();
    expect(stateFromDatabaseRows(databaseRows(state))).toEqual(state);
    const backup = createBackup(state, new Date('2026-09-30T15:31:00Z'));
    expect(parseBackup(backup, '2026-09-30').data.profile?.supplementPlan).toEqual(state.profile?.supplementPlan);
    expect(parseBackup(backup, '2026-09-30').data.days[0]?.supplementTakenIds).toEqual([id]);
    const invalid = structuredClone(state);
    invalid.days[0]!.supplementTakenIds = [id, id];
    expect(() => parseState(JSON.stringify(invalid))).toThrow('Invalid completion status');
  });
});
