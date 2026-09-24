import { describe, expect, it } from 'vitest';
import { ProfileService } from '../src/services/profile';
import { SyncService } from '../src/services/sync';
import { LocalRepository } from '../src/storage/local';
import { currentData } from '../src/services/backup';
import type { AppData } from '../src/storage/repository';

async function device(weightKg: number) {
  let raw: string | null = null;
  const repository = new LocalRepository(() => ({
    getItem: () => raw,
    setItem: (_key, value) => { raw = value; },
  }));
  await new ProfileService(repository, () => new Date('2026-09-24T00:00:00Z'), () => `profile-${weightKg}`).save({
    sex: 'female', ageYears: 28, heightCm: 165, weightKg, activityLevel: 'moderate', goal: 'maintain',
  });
  return repository;
}

describe('manual database sync', () => {
  it('previews both sides without changing local data, and preserves a recovery snapshot on download', async () => {
    const local = await device(60);
    const remote = currentData(await (await device(70)).read());
    const transport = (async (_url: string, options: RequestInit) => {
      expect(options.headers).toMatchObject({ Authorization: 'Bearer secret' });
      return Response.json({ revision: 3, state: remote });
    }) as typeof fetch;
    const service = new SyncService(local, transport);
    const before = await local.read();
    const preview = await service.preview('https://fittrack.example', 'secret');
    expect(await local.read()).toEqual(before);
    expect(preview.remote.profile?.weightKg).toBe(70);
    await service.download('https://fittrack.example', 'secret', preview);
    const after = await local.read();
    expect(currentData(after)).toEqual(remote);
    expect(after.recovery?.state).toEqual(currentData(before));
  });

  it('refuses upload after local changes and download after a remote revision change', async () => {
    const local = await device(60);
    const remote: AppData = currentData(await (await device(70)).read());
    let revision = 1;
    let writes = 0;
    const transport = (async (_url: string, options: RequestInit) => {
      if (options.method === 'PUT') { writes += 1; return Response.json({ revision: revision + 1 }); }
      return Response.json({ revision, state: remote });
    }) as typeof fetch;
    const service = new SyncService(local, transport);
    const preview = await service.preview('https://fittrack.example', 'secret');
    await new ProfileService(local, () => new Date('2026-09-24T00:00:00Z'), () => 'unused').save({
      sex: 'female', ageYears: 28, heightCm: 165, weightKg: 61, activityLevel: 'moderate', goal: 'maintain',
    });
    await expect(service.upload('https://fittrack.example', 'secret', preview)).rejects.toThrow('本机记录已变化');
    expect(writes).toBe(0);
    revision = 2;
    const changed = await local.read();
    await expect(service.download('https://fittrack.example', 'secret', preview)).rejects.toThrow('服务器记录已变化');
    expect(await local.read()).toEqual(changed);
  });
});
