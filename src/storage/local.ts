import { validateProfile } from '../domain/calculations';
import { validateFood, validateTraining } from '../domain/records';
import type { FoodInput, TrainingInput } from '../domain/records';
import type { ProfileInput } from '../domain/models';
import { isDateKey } from '../utils/date';
import { emptyState } from './repository';
import type { AppState, Repository } from './repository';

export const STORAGE_KEY = 'fittrack.state.v1';
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function entity(value: unknown): value is Record<string, unknown> {
  return record(value) && value.schemaVersion === 1
    && ['id', 'userId'].every((key) => typeof value[key] === 'string' && value[key].length > 0)
    && ['createdAt', 'updatedAt'].every((key) => typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key])))
    && (value.deletedAt === undefined || (typeof value.deletedAt === 'string' && Number.isFinite(Date.parse(value.deletedAt))));
}
function profile(value: unknown): boolean {
  if (!record(value)) return false;
  try { validateProfile(value as unknown as ProfileInput); return true; } catch { return false; }
}
/** Reject unsupported/corrupt data without overwriting it. Migrations are explicit. */
export function parseState(raw: string): AppState {
  const value: unknown = JSON.parse(raw);
  if (!record(value) || ![1, 2].includes(Number(value.schemaVersion)) || typeof value.schemaVersion !== 'number' || !Array.isArray(value.plans) || !Array.isArray(value.weights)) throw new Error('Invalid storage schema');
  // Stage 2 data migrates in memory. The next successful atomic write persists v2.
  if (value.schemaVersion === 1) {
    value.schemaVersion = 2;
    value.foods = [];
    value.trainings = [];
    value.days = [];
  }
  if (!Array.isArray(value.foods) || !Array.isArray(value.trainings) || !Array.isArray(value.days)) throw new Error('Invalid record collections');
  if (value.profile === null) {
    if (value.plans.length || value.weights.length || value.foods.length || value.trainings.length || value.days.length) throw new Error('Orphaned records');
  } else if (!entity(value.profile) || !profile(value.profile)) throw new Error('Invalid profile');
  const owner = record(value.profile) ? value.profile.userId : null;
  for (const [kind, entries] of [['plans', value.plans], ['weights', value.weights], ['foods', value.foods], ['trainings', value.trainings], ['days', value.days]] as const) {
    const dates = new Set<string>();
    const ids = new Set<unknown>();
    for (const entry of entries) {
      if (!entity(entry) || entry.userId !== owner || !isDateKey(entry.date) || (['plans', 'weights', 'days'].includes(kind) && dates.has(entry.date)) || ids.has(entry.id)) throw new Error('Invalid daily record');
      dates.add(entry.date);
      ids.add(entry.id);
      if (kind === 'plans') {
        if (entry.calculationVersion !== 'mifflin-v1' || !profile(entry.profileSnapshot)
          || !['bmrKcal', 'tdeeKcal', 'targetKcal'].every((key) => typeof entry[key] === 'number' && Number.isFinite(entry[key]) && entry[key] > 0)) throw new Error('Invalid plan');
      } else if (kind === 'weights') {
        if (typeof entry.weightKg !== 'number' || !Number.isFinite(entry.weightKg) || entry.weightKg < 30 || entry.weightKg > 350) throw new Error('Invalid weight');
      } else if (kind === 'foods') validateFood(entry as unknown as FoodInput);
      else if (kind === 'trainings') {
        validateTraining(entry as unknown as TrainingInput);
        if (entry.estimateSource !== 'manual') throw new Error('Invalid estimate source');
      } else if (typeof entry.dietCompleted !== 'boolean') throw new Error('Invalid completion status');
    }
  }
  return value as unknown as AppState;
}
export class LocalRepository implements Repository {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly getStorage: () => KeyValueStorage) {}
  async read(): Promise<AppState> {
    let raw: string | null;
    try { raw = this.getStorage().getItem(STORAGE_KEY); }
    catch { throw new Error('无法读取浏览器存储，请检查浏览器隐私设置后重试。'); }
    if (raw === null) return emptyState();
    try { return parseState(raw); }
    catch { throw new Error('本地数据格式异常或版本不受支持。原始数据已保留，请勿清除浏览器数据。'); }
  }
  async update(change: (state: AppState) => AppState): Promise<AppState> {
    const write = async () => {
      const next = change(await this.read());
      const raw = JSON.stringify(next);
      parseState(raw);
      try { this.getStorage().setItem(STORAGE_KEY, raw); }
      catch { throw new Error('保存失败，可能是存储空间不足或浏览器限制。原有数据未更改，请重试。'); }
      return next;
    };
    const result = this.pending.then(() => {
      if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(STORAGE_KEY, write);
      return write();
    });
    this.pending = result.catch(() => undefined);
    return result;
  }
}
