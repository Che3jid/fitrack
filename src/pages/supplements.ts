import type { AppState } from '../storage/repository';
import { supplementProgress, SupplementService } from '../services/supplements';
import { escapeHtml as html } from '../utils/html';

export function supplementsPage(state: AppState, date: string): string {
  const items = state.profile?.supplementPlan ?? [];
  const taken = new Set(state.days.find((day) => day.date === date)?.supplementTakenIds ?? []);
  const progress = supplementProgress(state, date);
  return `<section class="page-heading"><p class="eyebrow">饮食 / 每日补给</p><h1 tabindex="-1">每日补给</h1><p class="muted">建立自己的清单，每天勾选已使用的项目。</p></section>
    <section class="card supplement-card"><div class="section-heading"><h2>${date} · 今日清单</h2><span class="pill light">${progress.taken} / ${progress.total} 已完成</span></div>
      ${items.length ? `<div class="supplement-list">${items.map((item) => `<div class="supplement-row"><label><input type="checkbox" data-supplement-id="${html(item.id)}" ${taken.has(item.id) ? 'checked' : ''} /><span>${html(item.name)}</span></label><button class="text-button" type="button" data-remove-supplement="${html(item.id)}" aria-label="从清单移除${html(item.name)}">移出清单</button></div>`).join('')}</div>` : '<p class="empty-copy">清单还是空的。只添加你自己决定使用的补给。</p>'}
      <form id="supplement-add" class="supplement-add"><label>添加补给名称<input name="name" maxlength="40" placeholder="例如：乳清蛋白、肌酸" autocomplete="off" required /></label><button class="secondary" type="submit">加入清单</button></form>
      <p id="supplement-error" class="form-error" role="alert"></p>
      <p class="field-help">清单仅用于记录，不代表每个人每天都需要这些补给；使用量请以个人情况和产品说明为准。</p>
    </section><p><a class="text-link" href="#/diet">← 返回饮食记录</a></p>`;
}

export function bindSupplements(root: HTMLElement, service: SupplementService, refresh: () => Promise<void>): void {
  const form = root.querySelector<HTMLFormElement>('#supplement-add')!;
  const error = root.querySelector<HTMLElement>('#supplement-error')!;
  let busy = false;
  const run = async (action: () => Promise<void>): Promise<void> => {
    if (busy) return;
    busy = true;
    error.textContent = '';
    try { await action(); await refresh(); }
    catch (cause) { error.textContent = cause instanceof Error ? cause.message : '保存失败，请重试。'; }
    finally { busy = false; }
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (form.reportValidity()) void run(() => service.add(String(new FormData(form).get('name') ?? '')));
  });
  root.querySelectorAll<HTMLInputElement>('[data-supplement-id]').forEach((input) => {
    input.addEventListener('change', () => { void run(() => service.setTaken(input.dataset.supplementId!, input.checked)); });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-remove-supplement]').forEach((button) => {
    button.addEventListener('click', () => { void run(() => service.remove(button.dataset.removeSupplement!)); });
  });
}
