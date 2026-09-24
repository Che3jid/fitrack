import { currentData } from './backup';
import { parseState } from '../storage/local';
import type { AppData, Repository } from '../storage/repository';

export interface SyncPreview {
  local: AppData;
  remote: AppData;
  revision: number;
  localRaw: string;
}

function serverUrl(raw: string): string {
  const url = new URL(raw.trim());
  const host = url.hostname.toLowerCase();
  const privateHttp = ['localhost', '127.0.0.1', '[::1]'].includes(host)
    || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local');
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && privateHttp))) {
    throw new Error('请输入 HTTPS 地址，或可信局域网中的 HTTP 地址。');
  }
  return new URL('/api/state', url).href;
}

export class SyncService {
  constructor(private readonly repository: Repository, private readonly transport: typeof fetch = fetch) {}

  private async request(url: string, token: string, method: 'GET' | 'PUT', body?: object): Promise<{ revision: number; state?: AppData }> {
    if (!token.trim()) throw new Error('请输入服务器访问密钥。');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.transport(serverUrl(url), {
        method, redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${token.trim()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string' ? payload.error : `服务器返回 ${response.status}`;
        throw new Error(message);
      }
      if (!payload || typeof payload !== 'object' || !('revision' in payload)
        || !Number.isSafeInteger(payload.revision) || (payload.revision as number) < 0) throw new Error('服务器响应格式无效。');
      return payload as { revision: number; state?: AppData };
    } catch (cause) {
      if (cause instanceof TypeError || (cause instanceof DOMException && cause.name === 'AbortError')) throw new Error('无法连接数据库服务，请检查地址、网络与服务器状态。');
      throw cause;
    } finally { clearTimeout(timer); }
  }

  async preview(url: string, token: string): Promise<SyncPreview> {
    const [local, response] = await Promise.all([this.repository.read(), this.request(url, token, 'GET')]);
    const remote = currentData(parseState(JSON.stringify(response.state)));
    return { local: currentData(local), remote, revision: response.revision, localRaw: JSON.stringify(currentData(local)) };
  }

  async upload(url: string, token: string, preview: SyncPreview): Promise<void> {
    if (!preview.local.profile) throw new Error('本机尚无资料，无法上传。');
    if (JSON.stringify(currentData(await this.repository.read())) !== preview.localRaw) throw new Error('本机记录已变化，请重新检查服务器后再上传。');
    await this.request(url, token, 'PUT', { state: preview.local, expectedRevision: preview.revision });
  }

  async download(url: string, token: string, preview: SyncPreview): Promise<void> {
    if (!preview.remote.profile) throw new Error('服务器尚无资料，无法下载。');
    const latest = await this.request(url, token, 'GET');
    if (latest.revision !== preview.revision) throw new Error('服务器记录已变化，请重新检查后再下载。');
    const incoming = currentData(parseState(JSON.stringify(latest.state)));
    await this.repository.update((state) => {
      if (JSON.stringify(currentData(state)) !== preview.localRaw) throw new Error('本机记录已变化，请重新检查后再下载。');
      return { ...incoming, recovery: { savedAt: new Date().toISOString(), state: currentData(state) } };
    });
  }
}
