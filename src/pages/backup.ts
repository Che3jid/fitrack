import type { AppData, AppState } from '../storage/repository';
import { BackupService, MAX_BACKUP_BYTES, recordCounts } from '../services/backup';
import type { BackupPreview } from '../services/backup';
import { dateKey } from '../utils/date';

function counts(state: AppData): string {
  const count = recordCounts(state);
  return `<dl class="details"><div><dt>饮食 / 训练</dt><dd>${count.foods} / ${count.trainings} 条</dd></div><div><dt>体重 / 目标快照</dt><dd>${count.weights} / ${count.plans} 条</dd></div><div><dt>可恢复的删除记录</dt><dd>${count.deleted} 条</dd></div></dl>`;
}
export function backupPage(state: AppState): string {
  return `<section class="page-heading"><p class="eyebrow">数据备份 · 为记录留一份副本</p><h1 tabindex="-1">你的记录，由你保管。</h1><p class="muted">备份文件只在设备上生成和读取，不上传服务器。</p></section>
    <p id="backup-message" class="backup-message" role="status" aria-live="polite"></p>
    <section class="card"><h2>导出当前数据</h2>${counts(state)}<button class="primary" id="export-backup" ${state.profile ? '' : 'disabled'}>下载 JSON 备份</button><p class="field-help">包括资料、原始记录、完成状态和历史目标，保留记录 ID。文件包含身体与饮食信息，请妥善保存。不会导出上次导入前的恢复副本。</p></section>
    <form id="backup-form" class="card"><h2>从备份恢复</h2><p class="muted">选择 FitTrack 导出的 JSON 文件（最多 ${MAX_BACKUP_BYTES / 1024 / 1024} MB）。先查看内容摘要，再决定是否替换。</p>
      <label>选择备份文件<input id="backup-file" type="file" accept=".json,application/json" /></label>
      <p id="backup-error" class="form-error" role="alert"></p>
      <section id="backup-preview" hidden><h3>待导入的数据</h3><p id="backup-filename" class="muted"></p><div id="backup-counts"></div>
        <p class="field-help">这是完整替换，不合并。现有记录会被备份内容替换；导入成功后，可恢复到本次导入前。仅保留最近一次导入前的副本。</p>
        <label class="check-label"><input id="confirm-import" type="checkbox" required />我已核对，确认用备份替换当前数据</label>
        <button type="submit" class="primary">确认导入并替换</button>
      </section>
    </form>
    ${state.recovery ? `<form id="undo-form" class="card"><h2>恢复导入前的数据</h2><p class="muted">恢复到 ${new Date(state.recovery.savedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} 导入前的状态。</p>${counts(state.recovery.state)}<p class="field-help">这会替换当前数据，包括导入后新增的记录。建议先导出当前数据。恢复后，这个恢复副本将被移除。</p><label class="check-label"><input type="checkbox" required />确认恢复导入前数据，替换当前记录</label><button type="submit" class="secondary">恢复导入前数据</button></form>` : ''}
    <a href="${state.profile ? '#/profile' : '#/onboarding'}" class="text-link">← ${state.profile ? '返回我的' : '返回首次设置'}</a>`;
}
function download(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `fittrack-backup-${dateKey(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
export function bindBackup(root: HTMLElement, service: BackupService, state: AppState, refresh: () => Promise<void>): void {
  const fileInput = root.querySelector<HTMLInputElement>('#backup-file')!;
  const panel = root.querySelector<HTMLElement>('#backup-preview')!;
  const error = root.querySelector<HTMLElement>('#backup-error')!;
  const message = () => root.querySelector<HTMLElement>('#backup-message');
  let preview: BackupPreview | null = null;
  let readVersion = 0;
  let busy = false;
  const report = (cause: unknown) => { error.textContent = cause instanceof Error ? cause.message : '操作失败，当前数据未更改。'; };
  root.querySelector('#export-backup')!.addEventListener('click', async () => {
    try { download(await service.export()); if (message()) message()!.textContent = '已生成备份，请确认文件已保存到下载目录或“文件”中。'; }
    catch (cause) { report(cause); }
  });
  fileInput.addEventListener('change', async () => {
    const version = ++readVersion;
    preview = null; panel.hidden = true; error.textContent = '';
    const confirmation = root.querySelector<HTMLInputElement>('#confirm-import')!;
    confirmation.checked = false;
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error(`文件超过 ${MAX_BACKUP_BYTES / 1024 / 1024} MB，未读取或修改本地数据。`);
      const result = await service.preview(await file.text());
      if (version !== readVersion) return;
      preview = result;
      root.querySelector('#backup-filename')!.textContent = `${file.name} · 导出时间 ${new Date(result.exportedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
      root.querySelector('#backup-counts')!.innerHTML = counts(result.incoming);
      panel.hidden = false;
    } catch (cause) { if (version === readVersion) report(cause); }
  });
  root.querySelector<HTMLFormElement>('#backup-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (busy || !preview || !form.reportValidity()) return;
    busy = true;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true; fileInput.disabled = true; error.textContent = '';
    try {
      await service.restore(preview);
      await refresh();
      if (message()) message()!.textContent = '导入成功。可从下方恢复到本次导入前的数据。';
    } catch (cause) { report(cause); }
    finally { busy = false; button.disabled = false; fileInput.disabled = false; }
  });
  root.querySelector<HTMLFormElement>('#undo-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (busy || !form.reportValidity()) return;
    busy = true;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    try {
      await service.undo(state);
      await refresh();
      if (message()) message()!.textContent = '已恢复导入前的数据。';
    } catch (cause) { report(cause); }
    finally { busy = false; button.disabled = false; }
  });
}
