import { sevenDayAverage } from '../domain/calculations';
import { validateRecordDate } from '../domain/records';
import type { AppState } from '../storage/repository';
import { dailySummary } from './summary';

export function shiftDate(date: string, offset: number): string {
  validateRecordDate(date);
  return new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}
export function buildTrends(state: AppState, endDate: string, days: number) {
  validateRecordDate(endDate);
  if (endDate < '1900-04-07') throw new Error('截止日期过早。');
  if (![7, 30, 90].includes(days)) throw new Error('请选择 7、30 或 90 天。');
  const start = shiftDate(endDate, -(days - 1));
  // Read six extra calendar days so the first visible rolling average is correct.
  const source = Array.from({ length: days + 6 }, (_, index) => {
    const date = shiftDate(start, index - 6);
    const summary = dailySummary(state, date);
    return {
      date, weight: summary.weight?.weightKg ?? null,
      intake: summary.nutrition?.energyKcal ?? null,
      completed: summary.completed,
      balance: summary.balance?.balanceKcal ?? null,
      hasPlan: summary.plan !== null,
    };
  });
  return source.slice(6).map((day) => ({
    ...day,
    weightAverage: sevenDayAverage(source.map((item) => ({ date: item.date, value: item.weight })), day.date),
    intakeAverage: sevenDayAverage(source.map((item) => ({ date: item.date, value: item.completed ? item.intake : null })), day.date),
  }));
}
export type TrendDay = ReturnType<typeof buildTrends>[number];
