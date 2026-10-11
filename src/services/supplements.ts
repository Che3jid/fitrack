import type { AppState, Repository } from '../storage/repository';
import { dateKey } from '../utils/date';
import { createId } from '../utils/id';

export function supplementProgress(state: AppState, date: string): { total: number; taken: number } {
  const plan = state.profile?.supplementPlan ?? [];
  const taken = new Set(state.days.find((day) => day.date === date)?.supplementTakenIds ?? []);
  return { total: plan.length, taken: plan.filter((item) => taken.has(item.id)).length };
}

export class SupplementService {
  constructor(
    private readonly repository: Repository,
    private readonly clock: () => Date = () => new Date(),
    private readonly id: () => string = createId,
  ) {}

  async add(name: string): Promise<void> {
    const normalized = name.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > 40) throw new Error('补给名称需为 1–40 个字。');
    await this.repository.update((state) => {
      if (!state.profile) throw new Error('请先完成个人资料。');
      const items = state.profile.supplementPlan ?? [];
      if (items.length >= 20) throw new Error('清单最多添加 20 项。');
      if (items.some((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) throw new Error('清单中已有这项补给。');
      return { ...state, profile: { ...state.profile, supplementPlan: [...items, { id: this.id(), name: normalized }], updatedAt: this.clock().toISOString() } };
    });
  }

  async remove(id: string): Promise<void> {
    await this.repository.update((state) => {
      if (!state.profile) throw new Error('请先完成个人资料。');
      const items = state.profile.supplementPlan ?? [];
      if (!items.some((item) => item.id === id)) throw new Error('找不到这项补给，请刷新后重试。');
      const timestamp = this.clock().toISOString();
      return {
        ...state,
        profile: { ...state.profile, supplementPlan: items.filter((item) => item.id !== id), updatedAt: timestamp },
        days: state.days.map((day) => day.supplementTakenIds?.includes(id)
          ? { ...day, supplementTakenIds: day.supplementTakenIds.filter((takenId) => takenId !== id), updatedAt: timestamp } : day),
      };
    });
  }

  async setTaken(id: string, taken: boolean): Promise<void> {
    await this.repository.update((state) => {
      if (!state.profile || !(state.profile.supplementPlan ?? []).some((item) => item.id === id)) throw new Error('找不到这项补给，请刷新后重试。');
      const now = this.clock();
      const date = dateKey(now);
      const current = state.days.find((day) => day.date === date);
      const ids = new Set(current?.supplementTakenIds ?? []);
      if (taken) ids.add(id);
      else ids.delete(id);
      const timestamp = now.toISOString();
      const day = {
        id: current?.id ?? this.id(), userId: state.profile.userId, schemaVersion: 1 as const,
        createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp,
        date, dietCompleted: current?.dietCompleted ?? false, supplementTakenIds: [...ids],
      };
      return { ...state, days: [...state.days.filter((entry) => entry.date !== date), day] };
    });
  }
}
