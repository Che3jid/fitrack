import type { MealType, Nutrition } from './models';
import { isDateKey } from '../utils/date';

export const MEALS: Readonly<Record<MealType, string>> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐',
};
export interface FoodInput extends Nutrition {
  date: string;
  mealType: MealType;
  name: string;
  weightG: number;
  sodiumMg?: number;
}
export interface TrainingInput {
  date: string;
  exerciseType: string;
  durationMin: number;
  estimatedKcal: number;
}
export interface WeightInput { date: string; weightKg: number }

function range(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label}需在 ${min}–${max} 之间。`);
}
function name(value: string, label: string): void {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) throw new Error(`${label}需为 1–80 个字符。`);
}
export function validateRecordDate(date: string, today?: string): void {
  if (!isDateKey(date) || date < '1900-01-01') throw new Error('请选择有效日期。');
  if (today && date > today) throw new Error('不能记录未来日期。');
}
export function validateFood(input: FoodInput): void {
  validateRecordDate(input.date);
  if (!Object.hasOwn(MEALS, input.mealType)) throw new Error('请选择餐次。');
  name(input.name, '食物名称');
  range(input.weightG, 0.1, 10000, '食用重量（g）');
  range(input.energyKcal, 0, 50000, '热量（kcal）');
  for (const key of ['proteinG', 'carbsG', 'fatG'] as const) range(input[key], 0, 10000, '营养素（g）');
  if (input.sodiumMg !== undefined) range(input.sodiumMg, 0, 100_000, '钠（mg）');
}
export function validateTraining(input: TrainingInput): void {
  validateRecordDate(input.date);
  name(input.exerciseType, '运动类型');
  range(input.durationMin, 1, 1440, '时长（分钟）');
  range(input.estimatedKcal, 0, 50000, '估算消耗（kcal）');
}
export function validateWeight(input: WeightInput): void {
  validateRecordDate(input.date);
  range(input.weightKg, 30, 350, '体重（kg）');
}
