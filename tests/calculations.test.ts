import { describe, expect, it } from 'vitest';
import { calculateBmr, calculateDailyBalance, calculateEnergyPlan, sevenDayAverage, sumNutrition } from '../src/domain/calculations';
import type { ActivityLevel, Goal, ProfileInput } from '../src/domain/models';

const profile: ProfileInput = {
  sex: 'male', ageYears: 30, heightCm: 175, weightKg: 70,
  activityLevel: 'moderate', goal: 'maintain',
};

describe('energy estimates', () => {
  it('calculates male and female reference examples', () => {
    expect(calculateBmr(profile)).toBe(1648.75);
    expect(calculateBmr({ ...profile, sex: 'female' })).toBe(1482.75);
  });
  it.each<[ActivityLevel, number]>([
    ['sedentary', 1.2], ['light', 1.375], ['moderate', 1.55], ['high', 1.725], ['veryHigh', 1.9],
  ])('uses the %s activity factor', (activityLevel, factor) => {
    expect(calculateEnergyPlan({ ...profile, activityLevel }).tdeeKcal).toBeCloseTo(1648.75 * factor, 8);
  });
  it.each<[Goal, number]>([['lose', 0.85], ['maintain', 1], ['gain', 1.1]])('uses the %s goal factor', (goal, factor) => {
    const plan = calculateEnergyPlan({ ...profile, goal });
    expect(plan.targetKcal).toBeCloseTo(2555.5625 * factor, 8);
    expect(plan.calculationVersion).toBe('mifflin-v1');
  });
  it.each([
    { ageYears: 17 }, { ageYears: 101 }, { ageYears: 30.5 },
    { weightKg: 0 }, { weightKg: -1 }, { weightKg: NaN }, { weightKg: Infinity },
    { heightCm: 251 }, { sex: 'unknown' }, { activityLevel: 'toString' }, { goal: 'invalid' },
  ])('rejects invalid profile %j', (patch) => {
    expect(() => calculateEnergyPlan({ ...profile, ...patch } as ProfileInput)).toThrow(RangeError);
  });
  it('accepts documented input boundaries', () => {
    expect(() => calculateBmr({ ...profile, ageYears: 18, heightCm: 100, weightKg: 30 })).not.toThrow();
    expect(() => calculateBmr({ ...profile, ageYears: 100, heightCm: 250, weightKg: 350 })).not.toThrow();
  });
  it('does not mutate the profile or round intermediate calculations', () => {
    const input = Object.freeze({ ...profile, goal: 'lose' as const });
    expect(calculateEnergyPlan(input).targetKcal).toBeCloseTo(2172.228125, 8);
    expect(input.weightKg).toBe(70);
  });
});

describe('daily nutrition and balance', () => {
  it('returns zeros for an empty food list', () => {
    expect(sumNutrition([])).toEqual({ energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
  it('adds actual portion values without deriving calories from macros', () => {
    const first = Object.freeze({ energyKcal: 123, proteinG: 10.5, carbsG: 15, fatG: 3 });
    const second = { energyKcal: 200, proteinG: 20, carbsG: 10.5, fatG: 7 };
    expect(sumNutrition([first, second])).toEqual({ energyKcal: 323, proteinG: 30.5, carbsG: 25.5, fatG: 10 });
  });
  it.each([-1, NaN, Infinity])('rejects invalid nutrition %s', (proteinG) => {
    expect(() => sumNutrition([{ energyKcal: 0, proteinG, carbsG: 0, fatG: 0 }])).toThrow();
  });
  it('distinguishes deficit from remaining target and uses TDEE alone', () => {
    const plan = { bmrKcal: 1600, tdeeKcal: 2400, targetKcal: 2040, calculationVersion: 'mifflin-v1' as const };
    expect(calculateDailyBalance(2100, plan)).toEqual({
      estimatedExpenditureKcal: 2400, balanceKcal: -300, remainingKcal: -60,
    });
    expect(calculateDailyBalance(2500, plan).balanceKcal).toBe(100);
    expect(calculateDailyBalance(2400, plan).balanceKcal).toBe(0);
    expect(() => calculateDailyBalance(-1, plan)).toThrow();
  });
});

describe('seven-day calendar averages', () => {
  it('uses an inclusive seven-day window across a month boundary', () => {
    expect(sevenDayAverage([
      { date: '2026-08-26', value: 9999 },
      { date: '2026-08-27', value: 70 },
      { date: '2026-08-30', value: null },
      { date: '2026-09-03', value: 9999 },
      { date: '2026-09-02', value: 72 },
    ], '2026-09-02')).toEqual({ average: 71, count: 2 });
  });
  it('does not replace missing records with zero', () => {
    expect(sevenDayAverage([], '2026-09-23')).toEqual({ average: null, count: 0 });
    expect(sevenDayAverage([{ date: '2026-09-23', value: null }], '2026-09-23')).toEqual({ average: null, count: 0 });
  });
  it('keeps explicit zero and negative balances', () => {
    expect(sevenDayAverage([
      { date: '2026-09-22', value: -300 }, { date: '2026-09-23', value: 0 },
    ], '2026-09-23')).toEqual({ average: -150, count: 2 });
  });
  it('handles leap days and year boundaries', () => {
    expect(sevenDayAverage([{ date: '2024-02-29', value: 70 }], '2024-03-01').count).toBe(1);
    expect(sevenDayAverage([{ date: '2025-12-31', value: 70 }], '2026-01-02').count).toBe(1);
  });
  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-9-1', 'invalid'])('rejects invalid date %s', (date) => {
    expect(() => sevenDayAverage([], date)).toThrow(RangeError);
    expect(() => sevenDayAverage([{ date, value: 1 }], '2026-09-23')).toThrow(RangeError);
  });
  it('rejects duplicate dates rather than silently double weighting a day', () => {
    expect(() => sevenDayAverage([
      { date: '2026-09-23', value: 70 }, { date: '2026-09-23', value: 72 },
    ], '2026-09-23')).toThrow(RangeError);
  });
  it('rejects non-finite observations', () => {
    expect(() => sevenDayAverage([{ date: '2026-09-23', value: NaN }], '2026-09-23')).toThrow();
  });
});
