import { GOAL_FACTORS } from './calculations';
import type { Goal } from './models';

export interface AdaptiveDay {
  date: string;
  /** Only a completed food diary is usable; explicit zero is valid. */
  intakeKcal: number | null;
  weightKg: number | null;
}

export interface AdaptiveCoverage {
  completedDays: number;
  weightDays: number;
  weightSpanDays: number;
}

export type AdaptiveRecommendation =
  | { status: 'collecting' | 'unstable'; coverage: AdaptiveCoverage }
  | { status: 'ready'; coverage: AdaptiveCoverage; dynamicTdeeKcal: number; suggestedTargetKcal: number };

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 28;
const ROUND_TO_KCAL = 50;
const roundTo = (value: number) => Math.round(value / ROUND_TO_KCAL) * ROUND_TO_KCAL;

/** A conservative trend estimate, not a replacement for a measured metabolic rate.
 * Uses only completed food days and repeated weigh-ins over four weeks. The
 * approximate 7,700 kcal/kg conversion is damped against the current plan,
 * with a 10% maximum adjustment to avoid reacting to short-term water changes.
 */
export function calculateAdaptiveRecommendation(days: readonly AdaptiveDay[], baselineTdeeKcal: number, goal: Goal): AdaptiveRecommendation {
  if (!Number.isFinite(baselineTdeeKcal) || baselineTdeeKcal <= 0 || !Object.hasOwn(GOAL_FACTORS, goal)) {
    throw new RangeError('Invalid baseline plan');
  }
  if (days.length !== WINDOW_DAYS) throw new RangeError('Expected 28 calendar days');
  const last = Date.parse(`${days.at(-1)!.date}T00:00:00Z`);
  if (!Number.isFinite(last)) throw new RangeError('Invalid date');

  const completed: number[] = [];
  const weights: { index: number; value: number }[] = [];
  days.forEach((day, index) => {
    const timestamp = Date.parse(`${day.date}T00:00:00Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== day.date
      || timestamp !== last - (WINDOW_DAYS - 1 - index) * DAY_MS) throw new RangeError('Expected consecutive dates');
    if (day.intakeKcal !== null) {
      if (!Number.isFinite(day.intakeKcal) || day.intakeKcal < 0) throw new RangeError('Invalid intake');
      completed.push(day.intakeKcal);
    }
    if (day.weightKg !== null) {
      if (!Number.isFinite(day.weightKg) || day.weightKg <= 0) throw new RangeError('Invalid weight');
      weights.push({ index, value: day.weightKg });
    }
  });

  const weightSpanDays = weights.length ? weights.at(-1)!.index - weights[0]!.index : 0;
  const coverage = { completedDays: completed.length, weightDays: weights.length, weightSpanDays };
  if (completed.length < 21 || weights.length < 6 || weightSpanDays < 21
    || weights.filter((item) => item.index < 7).length < 2
    || weights.filter((item) => item.index >= 21).length < 2) {
    return { status: 'collecting', coverage };
  }

  const meanDay = weights.reduce((sum, item) => sum + item.index, 0) / weights.length;
  const meanWeight = weights.reduce((sum, item) => sum + item.value, 0) / weights.length;
  const covariance = weights.reduce((sum, item) => sum + (item.index - meanDay) * (item.value - meanWeight), 0);
  const variance = weights.reduce((sum, item) => sum + (item.index - meanDay) ** 2, 0);
  const slopeKgPerDay = covariance / variance;
  const meanIntake = completed.reduce((sum, value) => sum + value, 0) / completed.length;
  const observedTdee = meanIntake - slopeKgPerDay * 7700;

  // Large changes are more likely to be distorted by incomplete records or
  // fluid shifts; keep the existing plan until the trend becomes steadier.
  if (Math.abs(slopeKgPerDay) > 0.08 || observedTdee < baselineTdeeKcal * 0.5
    || observedTdee > baselineTdeeKcal * 1.5) return { status: 'unstable', coverage };

  const adjustment = Math.max(-baselineTdeeKcal * 0.1,
    Math.min(baselineTdeeKcal * 0.1, (observedTdee - baselineTdeeKcal) * 0.35));
  const dynamicTdeeKcal = roundTo(baselineTdeeKcal + adjustment);
  return {
    status: 'ready', coverage, dynamicTdeeKcal,
    suggestedTargetKcal: roundTo(dynamicTdeeKcal * GOAL_FACTORS[goal]),
  };
}
