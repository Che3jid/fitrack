import { calculateDailyBalance, sumNutrition } from '../domain/calculations';
import type { AppState } from '../storage/repository';

export function dailySummary(state: AppState, date: string) {
  const foods = state.foods.filter((entry) => entry.date === date && !entry.deletedAt);
  const trainings = state.trainings.filter((entry) => entry.date === date && !entry.deletedAt);
  const completed = state.days.find((entry) => entry.date === date)?.dietCompleted ?? false;
  const hasIntake = foods.length > 0 || completed;
  const nutrition = hasIntake ? sumNutrition(foods) : null;
  const plan = state.plans.find((entry) => entry.date === date) ?? null;
  return {
    foods, trainings, completed, nutrition, plan,
    balance: nutrition && plan ? calculateDailyBalance(nutrition.energyKcal, plan) : null,
    trainingKcal: trainings.reduce((total, entry) => total + entry.estimatedKcal, 0),
    trainingMinutes: trainings.reduce((total, entry) => total + entry.durationMin, 0),
    weight: state.weights.find((entry) => entry.date === date && !entry.deletedAt) ?? null,
  };
}
