import { calculateEnergyPlan } from '../domain/calculations';
import { validateFood, validateTraining, validateWeight, validateRecordDate } from '../domain/records';
import type { FoodInput, TrainingInput, WeightInput } from '../domain/records';
import type { Entity, UserProfile } from '../domain/models';
import type { AppState, Repository } from '../storage/repository';
import { dateKey } from '../utils/date';
import { createId } from '../utils/id';

export type RecordKind = 'foods' | 'trainings' | 'weights';

export class RecordService {
  constructor(
    private readonly repository: Repository,
    private readonly clock: () => Date = () => new Date(),
    private readonly id: () => string = createId,
  ) {}

  private metadata(profile: UserProfile, now: Date, existing?: Entity): Entity {
    return {
      id: existing?.id ?? this.id(), userId: profile.userId, schemaVersion: 1,
      createdAt: existing?.createdAt ?? now.toISOString(), updatedAt: now.toISOString(),
    };
  }

  private requireProfile(state: AppState): UserProfile {
    if (!state.profile) throw new Error('请先完成个人资料。');
    return state.profile;
  }

  private reopenDays(state: AppState, dates: string[], now: Date): void {
    state.days = state.days.map((entry) => dates.includes(entry.date)
      ? { ...entry, dietCompleted: false, updatedAt: now.toISOString() } : entry);
  }

  async saveFood(input: FoodInput, id?: string): Promise<AppState> {
    validateFood(input);
    return this.repository.update((state) => {
      const profile = this.requireProfile(state);
      const now = this.clock();
      validateRecordDate(input.date, dateKey(now));
      const existing = id ? state.foods.find((entry) => entry.id === id && !entry.deletedAt) : undefined;
      if (id && !existing) throw new Error('记录已更改或删除，请返回列表后重试。');
      const food = {
        ...this.metadata(profile, now, existing), date: input.date, mealType: input.mealType,
        name: input.name.trim(), weightG: input.weightG, energyKcal: input.energyKcal,
        proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG,
      };
      state.foods = [...state.foods.filter((entry) => entry.id !== food.id), food];
      this.reopenDays(state, [input.date, existing?.date ?? input.date], now);
      return state;
    });
  }

  async saveTraining(input: TrainingInput, id?: string): Promise<AppState> {
    validateTraining(input);
    return this.repository.update((state) => {
      const profile = this.requireProfile(state);
      const now = this.clock();
      validateRecordDate(input.date, dateKey(now));
      const existing = id ? state.trainings.find((entry) => entry.id === id && !entry.deletedAt) : undefined;
      if (id && !existing) throw new Error('记录已更改或删除，请返回列表后重试。');
      const training = {
        ...this.metadata(profile, now, existing), date: input.date, exerciseType: input.exerciseType.trim(),
        durationMin: input.durationMin, estimatedKcal: input.estimatedKcal, estimateSource: 'manual' as const,
      };
      return { ...state, trainings: [...state.trainings.filter((entry) => entry.id !== training.id), training] };
    });
  }

  /** The latest dated measurement drives current weight, never an older backfill.
   * Past daily plans remain untouched. If no measurements remain, retain the last
   * known profile weight until the user enters another measurement or edits it.
   */
  private syncCurrentWeight(state: AppState, now: Date): AppState {
    const profile = this.requireProfile(state);
    const latest = state.weights.filter((entry) => !entry.deletedAt).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest || latest.weightKg === profile.weightKg) return state;
    const updated = { ...profile, weightKg: latest.weightKg, updatedAt: now.toISOString() };
    const today = dateKey(now);
    const existing = state.plans.find((entry) => entry.date === today);
    const { sex, ageYears, heightCm, weightKg, activityLevel, goal } = updated;
    const profileSnapshot = { sex, ageYears, heightCm, weightKg, activityLevel, goal };
    const plan = {
      ...this.metadata(updated, now, existing), date: today,
      profileSnapshot, ...calculateEnergyPlan(profileSnapshot),
    };
    return { ...state, profile: updated, plans: [...state.plans.filter((entry) => entry.date !== today), plan] };
  }

  async saveWeight(input: WeightInput): Promise<AppState> {
    validateWeight(input);
    return this.repository.update((state) => {
      const profile = this.requireProfile(state);
      const now = this.clock();
      validateRecordDate(input.date, dateKey(now));
      const existing = state.weights.find((entry) => entry.date === input.date);
      state.weights = [...state.weights.filter((entry) => entry.date !== input.date), {
        ...this.metadata(profile, now, existing), date: input.date, weightKg: input.weightKg,
      }];
      return this.syncCurrentWeight(state, now);
    });
  }

  async setDietCompleted(date: string, completed: boolean): Promise<AppState> {
    return this.repository.update((state) => {
      const profile = this.requireProfile(state);
      const now = this.clock();
      validateRecordDate(date, dateKey(now));
      const existing = state.days.find((entry) => entry.date === date);
      return { ...state, days: [...state.days.filter((entry) => entry.date !== date), {
        ...this.metadata(profile, now, existing), date, dietCompleted: completed,
      }] };
    });
  }

  /** Soft deletion is reversible from the same date's recently deleted list. */
  async setDeleted(kind: RecordKind, id: string, deleted: boolean): Promise<AppState> {
    if (!['foods', 'trainings', 'weights'].includes(kind)) throw new Error('无效记录类型。');
    return this.repository.update((state) => {
      this.requireProfile(state);
      const now = this.clock();
      const entry = state[kind].find((item) => item.id === id);
      if (!entry) throw new Error('找不到记录，请刷新后重试。');
      if (deleted === Boolean(entry.deletedAt)) return state;
      entry.updatedAt = now.toISOString();
      if (deleted) entry.deletedAt = now.toISOString();
      else delete entry.deletedAt;
      if (kind === 'foods') this.reopenDays(state, [entry.date], now);
      return kind === 'weights' ? this.syncCurrentWeight(state, now) : state;
    });
  }
}
