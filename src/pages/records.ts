import { number, decimal } from '../components/layout';
import { sumNutrition } from '../domain/calculations';
import { MEALS } from '../domain/records';
import type { Entity } from '../domain/models';
import type { AppState } from '../storage/repository';
import { RecordService } from '../services/records';
import type { RecordKind } from '../services/records';
import { dailySummary } from '../services/summary';
import { escapeHtml as html } from '../utils/html';

export const recordRoutes: Record<RecordKind, string> = { foods: '/diet', trainings: '/training', weights: '/weight' };
const titles: Record<RecordKind, string> = { foods: '饮食记录', trainings: '训练记录', weights: '体重记录' };
export function recordUrl(kind: RecordKind, date: string, edit = false, id?: string): string {
  const query = new URLSearchParams({ date });
  if (id) query.set('id', id);
  return `#${recordRoutes[kind]}${edit ? '/edit' : ''}?${query}`;
}
function actions(kind: RecordKind, date: string, entry: Entity): string {
  return `<div class="record-actions"><a class="secondary" href="${recordUrl(kind, date, true, entry.id)}">编辑</a><button class="text-button danger" data-action="delete" data-id="${html(entry.id)}">删除</button></div>`;
}
function deletedList(state: AppState, kind: RecordKind, date: string): string {
  const entries = state[kind].filter((entry) => entry.date === date && entry.deletedAt);
  if (!entries.length) return '';
  return `<details class="card deleted-list"><summary>最近删除 · ${entries.length} 条（可恢复）</summary>${entries.map((entry) => {
    const label = 'name' in entry ? entry.name : 'exerciseType' in entry ? entry.exerciseType : `${entry.weightKg} kg`;
    return `<div class="record-row"><span>${html(label)}</span><button class="secondary" data-action="restore" data-id="${html(entry.id)}">恢复</button></div>`;
  }).join('')}</details>`;
}
export function recordsPage(state: AppState, kind: RecordKind, date: string, today: string): string {
  const summary = dailySummary(state, date);
  let content = '';
  if (kind === 'foods') {
    const total = summary.nutrition;
    const knownSodium = summary.foods.filter((entry) => entry.sodiumMg !== undefined);
    const sodiumMg = knownSodium.reduce((sum, entry) => sum + entry.sodiumMg!, 0);
    content = `<section class="card"><div class="section-heading"><h2>当日摄入</h2><span class="pill light">${summary.completed ? '已完成' : total ? '记录中' : '尚无记录'}</span></div>
      <strong class="metric">${total ? number(total.energyKcal) : '—'} <small>kcal</small></strong>
      <p class="muted">蛋白质 ${total ? decimal(total.proteinG) : '—'} g · 碳水 ${total ? decimal(total.carbsG) : '—'} g · 脂肪 ${total ? decimal(total.fatG) : '—'} g</p>
      <p class="muted">${knownSodium.length ? `已知钠 ${number(sodiumMg)} mg · 约合盐 ${decimal(sodiumMg * 2.5 / 1000)} g${knownSodium.length < summary.foods.length ? '（部分记录无钠数据）' : ''}` : '钠摄入：暂无可计算记录'}</p>
      <a class="secondary" href="#/library?${new URLSearchParams({ date, meal: 'breakfast' })}">用食材配方计算一餐</a>
      <button class="secondary" data-action="completion">${summary.completed ? '改为记录中' : '标记当日记录完成'}</button>
      <p class="field-help">${summary.completed ? '修改、删除或恢复食物后，会重新标记为记录中。' : '确认已录入当天所有饮食后再标记完成。无食物记录时，标记完成代表当天摄入为 0。'}</p></section>`;
    for (const [meal, label] of Object.entries(MEALS)) {
      const foods = summary.foods.filter((entry) => entry.mealType === meal);
      const kcal = sumNutrition(foods).energyKcal;
      content += `<section class="card"><div class="section-heading"><h2>${label}</h2><span class="muted">${foods.length ? number(kcal) + ' kcal' : '未记录'}</span></div>
        ${foods.length ? foods.map((entry) => `<article class="record-row"><div class="record-copy"><strong>${html(entry.name)}</strong><p>${entry.weightG} g · ${number(entry.energyKcal)} kcal</p><small>蛋白质 ${entry.proteinG} g / 碳水 ${entry.carbsG} g / 脂肪 ${entry.fatG} g${entry.sodiumMg === undefined ? '' : ` / 钠 ${number(entry.sodiumMg)} mg`}</small></div>${actions(kind, date, entry)}</article>`).join('') : '<p class="empty-copy">还没有食物记录</p>'}
        <a class="text-link" href="${recordUrl(kind, date, true)}&meal=${meal}">＋ 手动添加${label}</a> · <a class="text-link" href="#/library?${new URLSearchParams({ date, meal })}">按食材计算</a></section>`;
    }
  } else if (kind === 'trainings') {
    content = `<section class="card"><h2>当日训练</h2><strong class="metric">${summary.trainingMinutes} <small>分钟</small></strong><p class="muted">估算消耗 ${number(summary.trainingKcal)} kcal · ${summary.trainings.length} 次训练</p><p class="field-help">训练消耗单独展示，不重复叠加到 TDEE，也不自动增加饮食目标。</p></section>
      <section class="card"><div class="section-heading"><h2>训练记录</h2><a class="secondary" href="${recordUrl(kind, date, true)}">添加训练</a></div>
      ${summary.trainings.length ? summary.trainings.map((entry) => `<article class="record-row"><div class="record-copy"><strong>${html(entry.exerciseType)}</strong><p>${entry.durationMin} 分钟 · ${number(entry.estimatedKcal)} kcal</p><small>消耗由你手动估算</small></div>${actions(kind, date, entry)}</article>`).join('') : '<p class="empty-copy">这一天还没有训练记录。休息也是计划的一部分。</p>'}</section>`;
  } else {
    const weight = summary.weight;
    content = `<section class="card"><div class="section-heading"><h2>当日体重</h2><a class="secondary" href="${recordUrl(kind, date, true)}">${weight ? '修改体重' : '记录体重'}</a></div>
      ${weight ? `<article class="record-row"><strong class="metric">${weight.weightKg} <small>kg</small></strong><button class="text-button danger" data-action="delete" data-id="${html(weight.id)}">删除</button></article>` : '<p class="empty-copy">尚未记录体重，不会自动沿用其他日期的数据。</p>'}
      <p class="field-help">每天保留一条体重。较新的体重会同步到个人资料，并重算今日目标；补录更早的体重不覆盖较新的记录。</p></section>
      <section class="notice"><strong>删除与恢复</strong><p>删除后可在下方恢复。删除最新体重会回退到最近一条有效记录；若已无体重记录，个人资料仍保留最后已知体重。历史目标不会被重写。</p></section>`;
  }
  return `<section class="page-heading"><p class="eyebrow">${kind === 'foods' ? '01 / NUTRITION' : kind === 'trainings' ? '02 / TRAINING' : '03 / BODY'}</p><h1 tabindex="-1">${titles[kind]}</h1></section>
    <div class="date-toolbar"><label>记录日期<input id="record-date" type="date" min="1900-01-01" max="${today}" value="${date}" required /></label>${date !== today ? `<a class="secondary" href="${recordUrl(kind, today)}">回到今天</a>` : ''}</div>
    <p id="record-error" class="form-error" role="alert"></p>${content}${deletedList(state, kind, date)}`;
}

export function bindRecordList(root: HTMLElement, service: RecordService, kind: RecordKind, date: string, completed: boolean, refresh: () => Promise<void>): void {
  const picker = root.querySelector<HTMLInputElement>('#record-date')!;
  picker.addEventListener('change', () => {
    if (picker.reportValidity()) location.hash = recordUrl(kind, picker.value).slice(1);
  });
  let busy = false;
  root.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (busy) return;
      busy = true; button.disabled = true;
      const error = root.querySelector<HTMLElement>('#record-error')!;
      error.textContent = '';
      try {
        if (button.dataset.action === 'completion') await service.setDietCompleted(date, !completed);
        else await service.setDeleted(kind, button.dataset.id!, button.dataset.action === 'delete');
        await refresh();
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : '操作失败，请重试。';
        error.scrollIntoView({ block: 'center' });
      } finally { busy = false; button.disabled = false; }
    });
  });
}
