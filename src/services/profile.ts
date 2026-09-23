import { calculateEnergyPlan, validateProfile } from '../domain/calculations';
import type { DailyPlan, ProfileInput, UserProfile } from '../domain/models';
import type { AppState, Repository } from '../storage/repository';
import { dateKey } from '../utils/date';
import { createId } from '../utils/id';
function snapshot(profile: ProfileInput): ProfileInput {
  const { sex, ageYears, heightCm, weightKg, activityLevel, goal } = profile;
  return { sex, ageYears, heightCm, weightKg, activityLevel, goal };
}
export class ProfileService {
  constructor(private readonly repository: Repository, private readonly clock: () => Date = () => new Date(), private readonly id: () => string = createId) {}
  read(): Promise<AppState> { return this.repository.read(); }
  private plan(profile: UserProfile, now: Date, previous?: DailyPlan): DailyPlan {
    return {
      id: previous?.id ?? this.id(), userId: profile.userId, schemaVersion: 1,
      createdAt: previous?.createdAt ?? now.toISOString(), updatedAt: now.toISOString(),
      date: dateKey(now), profileSnapshot: snapshot(profile), ...calculateEnergyPlan(profile),
    };
  }
  async save(input: ProfileInput): Promise<AppState> {
    validateProfile(input);
    return this.repository.update((state) => {
      const now = this.clock();
      const today = dateKey(now);
      const timestamp = now.toISOString();
      const previous = state.profile;
      const userId = previous?.userId ?? this.id();
      const profile: UserProfile = {
        ...snapshot(input), id: previous?.id ?? this.id(), userId, schemaVersion: 1,
        createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp,
      };
      const plan = this.plan(profile, now, state.plans.find((entry) => entry.date === today));
      let weights = state.weights;
      if (!previous || previous.weightKg !== profile.weightKg) {
        const existing = weights.find((entry) => entry.date === today);
        weights = [...weights.filter((entry) => entry.date !== today), {
          id: existing?.id ?? this.id(), userId, schemaVersion: 1,
          createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp, date: today, weightKg: profile.weightKg,
        }];
      }
      return { ...state, profile, weights, plans: [...state.plans.filter((entry) => entry.date !== today), plan] };
    });
  }
  /** Create a snapshot for an opened day only; do not fabricate missed days. */
  async today(): Promise<AppState> {
    const state = await this.repository.read();
    const now = this.clock();
    if (!state.profile || state.plans.some((plan) => plan.date === dateKey(now))) return state;
    return this.repository.update((latest) => {
      if (!latest.profile || latest.plans.some((plan) => plan.date === dateKey(now))) return latest;
      return { ...latest, plans: [...latest.plans, this.plan(latest.profile, now)] };
    });
  }
}
