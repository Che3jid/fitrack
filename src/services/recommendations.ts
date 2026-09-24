import { calculateAdaptiveRecommendation } from '../domain/adaptive-tdee';
import type { AdaptiveRecommendation } from '../domain/adaptive-tdee';
import type { AppState } from '../storage/repository';
import { buildTrends } from './trends';

export function adaptiveRecommendation(state: AppState, date: string): AdaptiveRecommendation | null {
  const plan = state.plans.find((entry) => entry.date === date);
  if (!plan) return null;
  const days = buildTrends(state, date, 30).slice(-28).map((day) => ({
    date: day.date,
    intakeKcal: day.completed ? day.intake : null,
    weightKg: day.weight,
  }));
  return calculateAdaptiveRecommendation(days, plan.tdeeKcal, plan.profileSnapshot.goal);
}
