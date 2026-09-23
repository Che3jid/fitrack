import type { DailyPlan, UserProfile, WeightEntry, FoodEntry, TrainingEntry, DayStatus } from '../domain/models';
export interface AppState {
  schemaVersion: 2;
  profile: UserProfile | null;
  plans: DailyPlan[];
  weights: WeightEntry[];
  foods: FoodEntry[];
  trainings: TrainingEntry[];
  days: DayStatus[];
}
export const emptyState = (): AppState => ({ schemaVersion: 2, profile: null, plans: [], weights: [], foods: [], trainings: [], days: [] });
export interface Repository {
  read(): Promise<AppState>;
  /** Persist the entire update or leave the old state intact. */
  update(change: (state: AppState) => AppState): Promise<AppState>;
}
