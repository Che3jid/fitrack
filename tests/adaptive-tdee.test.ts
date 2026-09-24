import { describe, expect, it } from 'vitest';
import { calculateAdaptiveRecommendation } from '../src/domain/adaptive-tdee';
import type { AdaptiveDay } from '../src/domain/adaptive-tdee';
import { calculateEnergyPlan } from '../src/domain/calculations';
import type { FoodEntry, WeightEntry, DayStatus } from '../src/domain/models';
import { adaptiveRecommendation } from '../src/services/recommendations';
import { emptyState } from '../src/storage/repository';

function fourWeeks(intake = 2200, dailyWeightChange = 0): AdaptiveDay[] {
  const start = Date.parse('2026-08-28T00:00:00Z');
  return Array.from({ length: 28 }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    intakeKcal: intake,
    weightKg: index % 3 === 0 ? 70 + index * dailyWeightChange : null,
  }));
}

describe('adaptive TDEE and target suggestion', () => {
  it('waits for completed diet days and repeated weigh-ins across the window', () => {
    const days = fourWeeks();
    days.slice(20).forEach((day) => { day.intakeKcal = null; });
    expect(calculateAdaptiveRecommendation(days, 2000, 'maintain')).toMatchObject({
      status: 'collecting', coverage: { completedDays: 20, weightDays: 10, weightSpanDays: 27 },
    });
    days.slice(20).forEach((day) => { day.intakeKcal = 2200; });
    days.forEach((day, index) => { if (index === 3 || index === 6) day.weightKg = null; });
    expect(calculateAdaptiveRecommendation(days, 2000, 'maintain').status).toBe('collecting');
  });

  it('uses a stable four-week trend and applies the existing goal factors', () => {
    const days = fourWeeks();
    const maintain = calculateAdaptiveRecommendation(days, 2000, 'maintain');
    const lose = calculateAdaptiveRecommendation(days, 2000, 'lose');
    expect(maintain).toMatchObject({ status: 'ready', dynamicTdeeKcal: 2050, suggestedTargetKcal: 2050 });
    expect(lose).toMatchObject({ status: 'ready', dynamicTdeeKcal: 2050, suggestedTargetKcal: 1750 });
  });

  it('lowers the estimate for a rising weight trend at the same intake', () => {
    const stable = calculateAdaptiveRecommendation(fourWeeks(), 2000, 'maintain');
    const rising = calculateAdaptiveRecommendation(fourWeeks(2200, 0.03), 2000, 'maintain');
    expect(stable.status).toBe('ready');
    expect(rising.status).toBe('ready');
    if (stable.status === 'ready' && rising.status === 'ready') {
      expect(rising.dynamicTdeeKcal).toBeLessThan(stable.dynamicTdeeKcal);
    }
  });

  it('keeps explicit zero intake and rejects a wildly unstable trend', () => {
    const days = fourWeeks();
    days[4]!.intakeKcal = 0;
    expect(calculateAdaptiveRecommendation(days, 2000, 'maintain').coverage.completedDays).toBe(28);
    expect(calculateAdaptiveRecommendation(fourWeeks(2200, 0.1), 2000, 'maintain').status).toBe('unstable');
  });

  it('requires consecutive calendar dates and valid observations', () => {
    const days = fourWeeks();
    days[4]!.date = days[3]!.date;
    expect(() => calculateAdaptiveRecommendation(days, 2000, 'maintain')).toThrow(RangeError);
    days[4]!.date = '2026-09-01';
    days[4]!.intakeKcal = -1;
    expect(() => calculateAdaptiveRecommendation(days, 2000, 'maintain')).toThrow(RangeError);
  });

  it('uses only completed food days and active weigh-ins from stored records', () => {
    const days = fourWeeks();
    const profile = { sex: 'male' as const, ageYears: 30, heightCm: 175, weightKg: 70, activityLevel: 'moderate' as const, goal: 'maintain' as const };
    const state = emptyState();
    const meta = (id: string) => ({ id, userId: 'user-1', schemaVersion: 1 as const, createdAt: '2026-08-28T00:00:00Z', updatedAt: '2026-08-28T00:00:00Z' });
    state.plans = [{ ...meta('plan'), date: days.at(-1)!.date, profileSnapshot: profile, ...calculateEnergyPlan(profile) }];
    state.days = days.map((day, index): DayStatus => ({ ...meta(`day-${index}`), date: day.date, dietCompleted: index !== 10 }));
    state.foods = days.map((day, index): FoodEntry => ({ ...meta(`food-${index}`), date: day.date, mealType: 'lunch', name: '测试餐', weightG: 300, energyKcal: index === 10 ? 5000 : 2200, proteinG: 80, carbsG: 200, fatG: 50 }));
    state.weights = days.flatMap((day, index): WeightEntry[] => day.weightKg === null ? [] : [{ ...meta(`weight-${index}`), date: day.date, weightKg: day.weightKg }]);
    const result = adaptiveRecommendation(state, days.at(-1)!.date);
    expect(result).toMatchObject({ status: 'ready', coverage: { completedDays: 27, weightDays: 10 } });
    state.weights[0]!.deletedAt = '2026-09-24T00:00:00Z';
    expect(adaptiveRecommendation(state, days.at(-1)!.date)?.coverage.weightDays).toBe(9);
  });
});
