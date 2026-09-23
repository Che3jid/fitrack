import type { DailyPlan, UserProfile, WeightEntry } from '../domain/models';
export interface AppState {
  schemaVersion: 1;
  profile: UserProfile | null;
  plans: DailyPlan[];
  weights: WeightEntry[];
}
export const emptyState = (): AppState => ({ schemaVersion: 1, profile: null, plans: [], weights: [] });
export interface Repository {
  read(): Promise<AppState>;
  /** Persist the entire update or leave the old state intact. */
  update(change: (state: AppState) => AppState): Promise<AppState>;
}
