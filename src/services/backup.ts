import { calculateEnergyPlan } from '../domain/calculations';
import { parseState } from '../storage/local';
import type { AppData, AppState, Repository } from '../storage/repository';
import { dateKey } from '../utils/date';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const UNITS = { weight: 'kg', height: 'cm', foodWeight: 'g', energy: 'kcal', macros: 'g', duration: 'min' } as const;
export interface BackupPreview {
  incoming: AppData;
  previous: AppData;
  exportedAt: string;
}
export function currentData(state: AppState): AppData {
  const { recovery: _recovery, ...data } = state;
  return data;
}
export function recordCounts(state: AppData) {
  return {
    foods: state.foods.filter((entry) => !entry.deletedAt).length,
    trainings: state.trainings.filter((entry) => !entry.deletedAt).length,
    weights: state.weights.filter((entry) => !entry.deletedAt).length,
    plans: state.plans.length,
    deleted: [...state.foods, ...state.trainings, ...state.weights].filter((entry) => entry.deletedAt).length,
  };
}
export function createBackup(state: AppState, now: Date): string {
  return JSON.stringify({
    format: 'fittrack-backup', version: 1, exportedAt: now.toISOString(),
    timezone: 'Asia/Shanghai', units: UNITS, data: currentData(state),
  }, null, 2);
}
export function parseBackup(raw: string, today: string): { data: AppData; exportedAt: string } {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error('备份文件超过 20 MB，请选择较小的备份。');
  try {
    const file = JSON.parse(raw);
    if (!file || file.format !== 'fittrack-backup' || file.version !== 1
      || file.timezone !== 'Asia/Shanghai' || typeof file.exportedAt !== 'string'
      || !Number.isFinite(Date.parse(file.exportedAt)) || !file.units
      || !Object.entries(UNITS).every(([key, value]) => file.units[key] === value)
      || !file.data || file.data.recovery !== undefined) throw new Error('Invalid backup header');
    const data = parseState(JSON.stringify(file.data));
    if (!data.profile) throw new Error('No profile');
    const all = [...data.plans, ...data.weights, ...data.foods, ...data.trainings, ...data.days];
    if (all.some((entry) => entry.date > today || entry.date < '1900-01-01')) throw new Error('Invalid record date');
    for (const plan of data.plans) {
      const expected = calculateEnergyPlan(plan.profileSnapshot);
      if ((['bmrKcal', 'tdeeKcal', 'targetKcal'] as const).some((key) => Math.abs(plan[key] - expected[key]) > 0.000001)) throw new Error('Inconsistent historical plan');
    }
    return { data: currentData(data), exportedAt: file.exportedAt };
  } catch {
    throw new Error('备份无效或版本不受支持。请使用 FitTrack 导出的 JSON 文件；当前数据未更改。');
  }
}
export class BackupService {
  constructor(private readonly repository: Repository, private readonly clock: () => Date = () => new Date()) {}
  async export(): Promise<string> { return createBackup(await this.repository.read(), this.clock()); }
  async preview(raw: string): Promise<BackupPreview> {
    const { data, exportedAt } = parseBackup(raw, dateKey(this.clock()));
    return { incoming: data, previous: currentData(await this.repository.read()), exportedAt };
  }
  async restore(preview: BackupPreview): Promise<AppState> {
    // Revalidate at commit time; reject stale previews and retain exactly one recovery point.
    const incoming = parseBackup(createBackup(preview.incoming, this.clock()), dateKey(this.clock())).data;
    return this.repository.update((state) => {
      if (JSON.stringify(currentData(state)) !== JSON.stringify(preview.previous)) throw new Error('预览后本地数据发生了变化，请重新选择文件并核对后导入。');
      return { ...incoming, recovery: { savedAt: this.clock().toISOString(), state: currentData(state) } };
    });
  }
  async undo(expected: AppState): Promise<AppState> {
    return this.repository.update((state) => {
      if (!state.recovery) throw new Error('没有可恢复的导入前数据。');
      if (JSON.stringify(state) !== JSON.stringify(expected)) throw new Error('本地数据已更新，请刷新备份页后再确认恢复。');
      return parseState(JSON.stringify(state.recovery.state));
    });
  }
}
