import type { ActivityLevel, EnergyPlan, Goal, Nutrition, ProfileInput } from './models';

export const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = Object.freeze({
  sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, veryHigh: 1.9,
});
export const GOAL_FACTORS: Readonly<Record<Goal, number>> = Object.freeze({
  lose: 0.85, maintain: 1, gain: 1.1,
});

function bounded(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}`);
  }
}

function nonNegative(value: number, label: string): void {
  bounded(value, 0, Number.MAX_SAFE_INTEGER, label);
}

/** V1 adult input boundaries are product constraints, not clinical advice. */
export function validateProfile(profile: ProfileInput): void {
  if (profile.sex !== 'male' && profile.sex !== 'female') throw new RangeError('Invalid sex');
  bounded(profile.ageYears, 18, 100, 'ageYears');
  if (!Number.isInteger(profile.ageYears)) throw new RangeError('ageYears must be an integer');
  bounded(profile.heightCm, 100, 250, 'heightCm');
  bounded(profile.weightKg, 30, 350, 'weightKg');
  if (!Object.hasOwn(ACTIVITY_FACTORS, profile.activityLevel)) throw new RangeError('Invalid activityLevel');
  if (!Object.hasOwn(GOAL_FACTORS, profile.goal)) throw new RangeError('Invalid goal');
}

/** Mifflin–St Jeor estimates resting expenditure; keep full precision internally. */
export function calculateBmr(profile: ProfileInput): number {
  validateProfile(profile);
  return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.ageYears
    + (profile.sex === 'male' ? 5 : -161);
}

export function calculateEnergyPlan(profile: ProfileInput): EnergyPlan {
  const bmrKcal = calculateBmr(profile);
  const tdeeKcal = bmrKcal * ACTIVITY_FACTORS[profile.activityLevel];
  return { bmrKcal, tdeeKcal, targetKcal: tdeeKcal * GOAL_FACTORS[profile.goal], calculationVersion: 'mifflin-v1' };
}

export function sumNutrition(entries: readonly Nutrition[]): Nutrition {
  const total: Nutrition = { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const keys = ['energyKcal', 'proteinG', 'carbsG', 'fatG'] as const;
  for (const entry of entries) {
    for (const key of keys) {
      nonNegative(entry[key], key);
      total[key] += entry[key];
      nonNegative(total[key], key);
    }
  }
  return total;
}

/** Training is already represented by the activity factor and is not added again. */
export function calculateDailyBalance(intakeKcal: number, plan: EnergyPlan) {
  nonNegative(intakeKcal, 'intakeKcal');
  nonNegative(plan.tdeeKcal, 'tdeeKcal');
  nonNegative(plan.targetKcal, 'targetKcal');
  return {
    estimatedExpenditureKcal: plan.tdeeKcal,
    balanceKcal: intakeKcal - plan.tdeeKcal,
    remainingKcal: plan.targetKcal - intakeKcal,
  };
}

function dateTimestamp(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('Expected YYYY-MM-DD');
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new RangeError('Invalid calendar date');
  }
  return timestamp;
}

export interface DailyValue {
  date: string;
  /** null means missing; zero remains a valid observation. */
  value: number | null;
}

/** Inclusive calendar window [endDate - 6 days, endDate], not the last 7 records.
 * Pass only completed days for intake; values may be negative for energy balance.
 */
export function sevenDayAverage(entries: readonly DailyValue[], endDate: string) {
  const end = dateTimestamp(endDate);
  const start = end - 6 * 86_400_000;
  const seen = new Set<string>();
  let sum = 0;
  let count = 0;
  for (const entry of entries) {
    const timestamp = dateTimestamp(entry.date);
    if (seen.has(entry.date)) throw new RangeError('Duplicate daily value');
    seen.add(entry.date);
    if (entry.value !== null && !Number.isFinite(entry.value)) throw new RangeError('Invalid daily value');
    if (timestamp >= start && timestamp <= end && entry.value !== null) {
      sum += entry.value;
      count += 1;
    }
  }
  return { average: count === 0 ? null : sum / count, count };
}
