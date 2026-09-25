export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'veryHigh';
export type Goal = 'lose' | 'maintain' | 'gain';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
/** YYYY-MM-DD, interpreted in Asia/Shanghai. Validate at application boundaries. */
export type DateKey = string;

export interface Entity {
  id: string;
  userId: string;
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  /** Reversible deletion for user-entered records. */
  deletedAt?: string;
}

export interface ProfileInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface UserProfile extends Entity, ProfileInput {}

/** All values describe the amount actually eaten, not values per 100 g. */
export interface Nutrition {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodEntry extends Entity, Nutrition {
  date: DateKey;
  mealType: MealType;
  name: string;
  weightG: number;
  /** Optional because older and manually entered records may not know sodium. */
  sodiumMg?: number;
}

export interface TrainingEntry extends Entity {
  date: DateKey;
  exerciseType: string;
  durationMin: number;
  estimatedKcal: number;
  estimateSource: 'manual';
}

export interface WeightEntry extends Entity {
  date: DateKey;
  weightKg: number;
}

export interface EnergyPlan {
  bmrKcal: number;
  tdeeKcal: number;
  targetKcal: number;
  calculationVersion: 'mifflin-v1';
}

export interface DailyPlan extends Entity, EnergyPlan {
  date: DateKey;
  profileSnapshot: ProfileInput;
}

export interface DayStatus extends Entity {
  date: DateKey;
  dietCompleted: boolean;
}
