import type { AppState } from '../storage/repository';
import type { FoodEntry, TrainingEntry, WeightEntry, MealType } from '../domain/models';
import { MEALS } from '../domain/records';
import type { RecordKind } from '../services/records';
import { RecordService } from '../services/records';
import { escapeHtml as html } from '../utils/html';
import { recordUrl } from './records';

function numeric(name: string, label: string, min: number, max: number, value?: number): string {
  return `<label>${label}<input name="${name}" type="number" inputmode="decimal" min="${min}" max="${max}" step="any" value="${value ?? ''}" required /></label>`;
}
export function recordForm(state: AppState, kind: RecordKind, date: string, today: string, id?: string, meal = 'breakfast'): string {
  let entry: FoodEntry | TrainingEntry | WeightEntry | undefined;
  if (kind === 'weights') entry = state.weights.find((item) => item.date === date && !item.deletedAt);
  else if (id) entry = state[kind].find((item) => item.id === id && !item.deletedAt);
  if (id && !entry && kind !== 'weights') throw new Error('记录不存在或已删除，请返回记录列表。');
  let fields = '';
  if (kind === 'foods') {
    const food = entry as FoodEntry | undefined;
    fields = `<label>餐次<select name="mealType">${Object.entries(MEALS).map(([value, label]) => `<option value="${value}" ${(food?.mealType ?? meal) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>食物名称<input name="name" type="text" maxlength="80" required value="${html(food?.name ?? '')}" placeholder="例如 鸡胸肉" /></label>
      <p class="field-help">以下全部填写本次实际食用份量的总值，不是每 100 g 的数值。修改重量不会自动换算营养数据。</p>
      <div class="field-grid">${numeric('weightG', '食用重量（g）', 0.1, 10000, food?.weightG)}${numeric('energyKcal', '热量（kcal）', 0, 50000, food?.energyKcal)}${numeric('proteinG', '蛋白质（g）', 0, 10000, food?.proteinG)}${numeric('carbsG', '碳水（g）', 0, 10000, food?.carbsG)}${numeric('fatG', '脂肪（g）', 0, 10000, food?.fatG)}</div>`;
  } else if (kind === 'trainings') {
    const training = entry as TrainingEntry | undefined;
    fields = `<label>运动类型<input name="exerciseType" type="text" maxlength="80" required value="${html(training?.exerciseType ?? '')}" placeholder="例如 力量训练、跑步" /></label>
      <div class="field-grid">${numeric('durationMin', '训练时长（分钟）', 1, 1440, training?.durationMin)}${numeric('estimatedKcal', '估算消耗（kcal）', 0, 50000, training?.estimatedKcal)}</div><p class="field-help">可填写运动设备或自己的估算值。本阶段不自动估算，也不将此值重复加到 TDEE。</p>`;
  } else {
    fields = `${numeric('weightKg', '体重（kg）', 30, 350, (entry as WeightEntry | undefined)?.weightKg)}<p class="field-help">每天一条，保存会替换该日期的体重。建议在相近的时间和条件下称重。</p>`;
  }
  return `<section class="page-heading"><p class="eyebrow">${entry ? '编辑记录' : '新的记录'}</p><h1 tabindex="-1">${kind === 'foods' ? '记录这一餐' : kind === 'trainings' ? '记录这次训练' : '记录今日的你'}</h1></section>
    <form id="record-form" class="card record-form"><label>记录日期<input name="date" type="date" min="1900-01-01" max="${today}" value="${entry?.date ?? date}" ${kind === 'weights' ? 'readonly' : ''} required /></label>${fields}
      <p class="form-error" id="form-error" role="alert"></p><div class="form-actions"><button class="primary" type="submit">保存记录</button><a class="secondary" href="${recordUrl(kind, date)}">取消</a></div></form>`;
}
export function bindRecordForm(root: HTMLElement, service: RecordService, kind: RecordKind, id?: string): void {
  const form = root.querySelector<HTMLFormElement>('#record-form')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const error = root.querySelector<HTMLElement>('#form-error')!;
  let saving = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    saving = true; button.disabled = true; button.textContent = '正在保存…'; error.textContent = '';
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? '');
    const num = (key: string) => text(key).trim() === '' ? NaN : Number(text(key));
    const date = text('date');
    try {
      if (kind === 'foods') await service.saveFood({ date, mealType: text('mealType') as MealType, name: text('name'), weightG: num('weightG'), energyKcal: num('energyKcal'), proteinG: num('proteinG'), carbsG: num('carbsG'), fatG: num('fatG') }, id);
      else if (kind === 'trainings') await service.saveTraining({ date, exerciseType: text('exerciseType'), durationMin: num('durationMin'), estimatedKcal: num('estimatedKcal') }, id);
      else await service.saveWeight({ date, weightKg: num('weightKg') });
      location.hash = recordUrl(kind, date).slice(1);
    } catch (cause) { error.textContent = cause instanceof Error ? cause.message : '保存失败，请重试。'; }
    finally { saving = false; button.disabled = false; button.textContent = '保存记录'; }
  });
}
