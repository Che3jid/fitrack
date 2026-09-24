import { recordCounts } from '../services/backup';
import type { SyncPreview } from '../services/sync';
import { SyncService } from '../services/sync';
import type { AppData, AppState } from '../storage/repository';

function summary(data: AppData): string {
  const count = recordCounts(data);
  return `<dl class="details"><div><dt>个人资料</dt><dd>${data.profile ? '已设置' : '无'}</dd></div><div><dt>饮食 / 训练</dt><dd>${count.foods} / ${count.trainings} 条</dd></div><div><dt>体重 / 每日计划</dt><dd>${count.weights} / ${count.plans} 条</dd></div></dl>`;
}

export function syncPage(state: AppState): string {
  return `<section class="page-heading"><p class="eyebrow">数据库 / 手动同步</p><h1 tabindex="-1">连接你的数据库</h1><p class="muted">先核对两端记录，再决定上传或下载。</p></section>
    <form id="sync-connect" class="card"><h2>连接服务器</h2><div class="field-grid"><label>服务器地址<input name="url" type="url" placeholder="http://127.0.0.1:8787" required autocapitalize="off" autocomplete="off" spellcheck="false" /></label><label>访问密钥<input name="token" type="password" required autocomplete="off" /></label></div><button class="secondary" type="submit">检查数据库</button><p class="field-help">密钥只在当前页面使用，不写入浏览器数据库。iPhone 需填写 Mac 的局域网 IP，且两台设备连接同一可信网络。</p></form>
    <p id="sync-message" class="backup-message" role="status" aria-live="polite"></p>
    <section id="sync-preview" class="card" hidden><h2>同步前核对</h2><p class="muted">服务器修订版 <strong id="sync-revision"></strong></p><div class="metric-grid"><div><h3>这台设备</h3><div id="sync-local"></div></div><div><h3>服务器</h3><div id="sync-remote"></div></div></div><p class="field-help">上传会完整替换服务器记录；下载会完整替换这台设备的记录，并保留一次可从“数据备份”恢复的旧副本。不会自动合并。</p><label class="check-label"><input id="sync-confirm" type="checkbox" />我已核对两端记录，确认所选方向会替换目标数据</label><div class="quick-actions"><button id="sync-upload" class="primary" type="button">上传这台设备</button><button id="sync-download" class="secondary" type="button">下载到这台设备</button></div></section>
    <section class="notice"><strong>本机记录</strong><div>${summary(state)}</div><p>未主动操作前，本机 IndexedDB 与服务器数据互不覆盖。数据库运行在你的 Mac 上时，关闭服务器后仍可继续使用本机记录。</p></section>
    <a href="${state.profile ? '#/profile' : '#/onboarding'}" class="text-link">← 返回${state.profile ? '我的' : '首次设置'}</a>`;
}

export function bindSync(root: HTMLElement, service: SyncService, refresh: () => Promise<void>): void {
  const form = root.querySelector<HTMLFormElement>('#sync-connect')!;
  const panel = root.querySelector<HTMLElement>('#sync-preview')!;
  const message = root.querySelector<HTMLElement>('#sync-message')!;
  const confirm = root.querySelector<HTMLInputElement>('#sync-confirm')!;
  const upload = root.querySelector<HTMLButtonElement>('#sync-upload')!;
  const download = root.querySelector<HTMLButtonElement>('#sync-download')!;
  let preview: SyncPreview | null = null;
  let busy = false;
  const credentials = () => {
    const fields = new FormData(form);
    return { url: String(fields.get('url') ?? ''), token: String(fields.get('token') ?? '') };
  };
  const report = (cause: unknown) => { message.textContent = cause instanceof Error ? cause.message : '同步失败，本机记录未更改。'; };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true; panel.hidden = true; preview = null; message.textContent = '正在检查数据库…';
    try {
      const { url, token } = credentials();
      const result = await service.preview(url, token);
      preview = result;
      root.querySelector('#sync-revision')!.textContent = String(result.revision);
      root.querySelector('#sync-local')!.innerHTML = summary(result.local);
      root.querySelector('#sync-remote')!.innerHTML = summary(result.remote);
      upload.disabled = !result.local.profile;
      download.disabled = !result.remote.profile;
      confirm.checked = false;
      panel.hidden = false;
      message.textContent = '已连接。请核对两端数据后选择同步方向。';
    } catch (cause) { report(cause); }
    finally { busy = false; }
  });
  async function transfer(direction: 'upload' | 'download'): Promise<void> {
    if (busy || !preview) return;
    if (!confirm.checked) { message.textContent = '请先确认将要替换的数据。'; confirm.focus(); return; }
    busy = true; upload.disabled = true; download.disabled = true; message.textContent = '正在同步…';
    try {
      const { url, token } = credentials();
      if (direction === 'upload') {
        await service.upload(url, token, preview);
        panel.hidden = true; preview = null;
        message.textContent = '已上传到数据库。再次同步前请重新检查两端数据。';
      } else {
        await service.download(url, token, preview);
        await refresh();
        const currentMessage = root.querySelector<HTMLElement>('#sync-message');
        if (currentMessage) currentMessage.textContent = '已下载到这台设备。原记录可在“数据备份”恢复。';
      }
    } catch (cause) { report(cause); }
    finally { busy = false; if (preview) { upload.disabled = !preview.local.profile; download.disabled = !preview.remote.profile; } }
  }
  upload.addEventListener('click', () => { void transfer('upload'); });
  download.addEventListener('click', () => { void transfer('download'); });
}
