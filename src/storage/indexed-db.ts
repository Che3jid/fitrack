import { emptyState } from './repository';
import type { AppState, Repository } from './repository';
import { parseState } from './local';
import type { KeyValueStorage } from './local';
import type { DailyPlan, DayStatus, FoodEntry, TrainingEntry, UserProfile, WeightEntry } from '../domain/models';

export const DATABASE_NAME = 'fittrack-local';
export const DATABASE_VERSION = 1;
export const DATABASE_CHANNEL = 'fittrack-database-v1';

const STORE_NAMES = ['meta', 'profiles', 'plans', 'weights', 'foods', 'trainings', 'days'] as const;
const LEGACY_KEY = 'fittrack.state.v1';

interface DatabaseMeta {
  key: 'state';
  schemaVersion: 2;
  recovery?: AppState['recovery'];
}

export interface DatabaseRows {
  meta: DatabaseMeta;
  profiles: UserProfile[];
  plans: DailyPlan[];
  weights: WeightEntry[];
  foods: FoodEntry[];
  trainings: TrainingEntry[];
  days: DayStatus[];
}

export function databaseRows(state: AppState): DatabaseRows {
  const valid = parseState(JSON.stringify(state));
  return {
    meta: { key: 'state', schemaVersion: 2, ...(valid.recovery ? { recovery: valid.recovery } : {}) },
    profiles: valid.profile ? [valid.profile] : [],
    plans: valid.plans,
    weights: valid.weights,
    foods: valid.foods,
    trainings: valid.trainings,
    days: valid.days,
  };
}

export function stateFromDatabaseRows(rows: DatabaseRows): AppState {
  if (rows.profiles.length > 1 || rows.meta.key !== 'state' || rows.meta.schemaVersion !== 2) throw new Error('Invalid database rows');
  return parseState(JSON.stringify({
    schemaVersion: rows.meta.schemaVersion,
    profile: rows.profiles[0] ?? null,
    plans: rows.plans,
    weights: rows.weights,
    foods: rows.foods,
    trainings: rows.trainings,
    days: rows.days,
    ...(rows.meta.recovery ? { recovery: rows.meta.recovery } : {}),
  }));
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Database transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Database transaction failed'));
  });
}

function readRows(transaction: IDBTransaction): Promise<DatabaseRows> {
  return Promise.all([
    result(transaction.objectStore('meta').get('state')),
    result(transaction.objectStore('profiles').getAll()),
    result(transaction.objectStore('plans').getAll()),
    result(transaction.objectStore('weights').getAll()),
    result(transaction.objectStore('foods').getAll()),
    result(transaction.objectStore('trainings').getAll()),
    result(transaction.objectStore('days').getAll()),
  ]).then(([meta, profiles, plans, weights, foods, trainings, days]) => ({
    meta: meta as DatabaseMeta,
    profiles: profiles as UserProfile[],
    plans: plans as DailyPlan[],
    weights: weights as WeightEntry[],
    foods: foods as FoodEntry[],
    trainings: trainings as TrainingEntry[],
    days: days as DayStatus[],
  }));
}

function replaceRows(transaction: IDBTransaction, state: AppState): void {
  const rows = databaseRows(state);
  for (const store of STORE_NAMES) transaction.objectStore(store).clear();
  transaction.objectStore('meta').put(rows.meta);
  for (const store of ['profiles', 'plans', 'weights', 'foods', 'trainings', 'days'] as const) {
    for (const row of rows[store]) transaction.objectStore(store).put(row);
  }
}

export class IndexedDbRepository implements Repository {
  private readonly database: Promise<IDBDatabase>;
  private initialized?: Promise<void>;
  private readonly listeners = new Set<() => void>();
  private readonly channel?: BroadcastChannel;

  constructor(private readonly factory: IDBFactory, private readonly legacyStorage: () => KeyValueStorage) {
    this.database = this.open();
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(DATABASE_CHANNEL);
      this.channel.addEventListener('message', () => this.notify());
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' });
        for (const store of STORE_NAMES.filter((name) => name !== 'meta')) {
          if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Database upgrade blocked'));
    });
  }

  private prepare(): Promise<void> {
    this.initialized ??= this.initialize();
    return this.initialized;
  }

  private async initialize(): Promise<void> {
    let database: IDBDatabase;
    try { database = await this.database; }
    catch { throw new Error('无法打开本地数据库，请检查浏览器隐私设置后重试。'); }
    const transaction = database.transaction(STORE_NAMES, 'readwrite');
    try {
      const meta = await result(transaction.objectStore('meta').get('state'));
      if (meta) {
        await complete(transaction);
        return;
      }
      let initial = emptyState();
      let legacy: string | null = null;
      try { legacy = this.legacyStorage().getItem(LEGACY_KEY); }
      catch { /* IndexedDB can still work when legacy storage is unavailable. */ }
      if (legacy !== null) {
        try { initial = parseState(legacy); }
        catch {
          transaction.abort();
          throw new Error('旧版本地数据格式异常。原始数据已保留，数据库迁移已停止。');
        }
      }
      replaceRows(transaction, initial);
      await complete(transaction);
      try { this.legacyStorage().removeItem?.(LEGACY_KEY); } catch { /* Migration already committed. */ }
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('旧版')) throw cause;
      throw new Error('初始化本地数据库失败，现有数据未被修改，请重试。');
    }
  }

  async read(): Promise<AppState> {
    await this.prepare();
    try {
      const database = await this.database;
      const transaction = database.transaction(STORE_NAMES, 'readonly');
      const rows = await readRows(transaction);
      await complete(transaction);
      return stateFromDatabaseRows(rows);
    } catch {
      throw new Error('本地数据库数据异常或版本不受支持。请勿清除浏览器数据。');
    }
  }

  async update(change: (state: AppState) => AppState): Promise<AppState> {
    await this.prepare();
    const database = await this.database;
    const transaction = database.transaction(STORE_NAMES, 'readwrite');
    let next: AppState;
    try {
      next = change(stateFromDatabaseRows(await readRows(transaction)));
      parseState(JSON.stringify(next));
    } catch (cause) {
      transaction.abort();
      throw cause;
    }
    try {
      replaceRows(transaction, next);
      await complete(transaction);
    } catch {
      throw new Error('保存失败，可能是存储空间不足或浏览器限制。原有数据未更改，请重试。');
    }
    this.channel?.postMessage('changed');
    this.notify();
    return next;
  }
}
