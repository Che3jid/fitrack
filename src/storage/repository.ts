import type { DailyPlan, UserProfile, WeightEntry, FoodEntry, TrainingEntry, DayStatus } from '../domain/models';
export interface AppData {
  schemaVersion: 2;
  profile: UserProfile | null;
  plans: DailyPlan[];
  weights: WeightEntry[];
  foods: FoodEntry[];
  trainings: TrainingEntry[];
  days: DayStatus[];
}
export interface AppState extends AppData {
  /** One bounded recovery snapshot; never nest recovery snapshots. */
  recovery?: { savedAt: string; state: AppData };
}
export const emptyState = (): AppState => ({ schemaVersion: 2, profile: null, plans: [], weights: [], foods: [], trainings: [], days: [] });
export interface Repository {
  read(): Promise<AppState>;
  /** Persist the entire update or leave the old state intact. */
  update(change: (state: AppState) => AppState): Promise<AppState>;
}
