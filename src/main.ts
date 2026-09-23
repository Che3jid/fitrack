import './styles/global.css';
import { layout } from './components/layout';
import { profilePage } from './pages/profile';
import { bindProfileForm, profileForm } from './pages/profile-form';
import { todayPage } from './pages/today';
import { ProfileService } from './services/profile';
import { LocalRepository, STORAGE_KEY } from './storage/local';
import { dateKey } from './utils/date';
import { validateRecordDate } from './domain/records';
import { RecordService } from './services/records';
import type { RecordKind } from './services/records';
import { dailySummary } from './services/summary';
import { recordsPage, bindRecordList } from './pages/records';
import { recordForm, bindRecordForm } from './pages/record-form';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('FitTrack root element is missing');
const app = root;
const repository = new LocalRepository(() => window.localStorage);
const service = new ProfileService(repository);
const records = new RecordService(repository);
let generation = 0;
let shownDate = dateKey(new Date());

async function render(): Promise<void> {
  const current = ++generation;
  try {
    const state = await service.today();
    if (current !== generation) return;
    shownDate = dateKey(new Date());
    const [path, query] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(query);
    let route = path || '/today';
    if (!state.profile) route = '/onboarding';
    else if (!['/today', '/profile', '/profile/edit', '/diet', '/diet/edit', '/training', '/training/edit', '/weight', '/weight/edit'].includes(route)) route = '/today';
    if (route !== path) history.replaceState(null, '', `#${route}`);
    const editing = route === '/profile/edit';
    const kind: RecordKind | null = route.startsWith('/diet') ? 'foods' : route.startsWith('/training') ? 'trainings' : route.startsWith('/weight') ? 'weights' : null;
    if (kind) {
      let date = params.get('date') ?? shownDate;
      try { validateRecordDate(date, shownDate); } catch { date = shownDate; }
      const id = params.get('id') ?? undefined;
      const active = kind === 'foods' ? 'diet' : kind === 'trainings' ? 'training' : 'profile';
      if (route.endsWith('/edit')) {
        app.innerHTML = layout(recordForm(state, kind, date, shownDate, id, params.get('meal') ?? 'breakfast'), active);
        bindRecordForm(app, records, kind, id);
      } else {
        app.innerHTML = layout(recordsPage(state, kind, date, shownDate), active);
        bindRecordList(app, records, kind, date, dailySummary(state, date).completed, render);
      }
      document.title = `${kind === 'foods' ? '饮食' : kind === 'trainings' ? '训练' : '体重'}记录 · FitTrack`;
    } else if (route === '/onboarding' || editing) {
      app.innerHTML = layout(profileForm(editing ? state.profile : null), editing ? 'profile' : 'onboarding');
      bindProfileForm(app, async (input) => {
        await service.save(input);
        location.hash = editing ? '/profile' : '/today';
      });
      document.title = `${editing ? '编辑资料' : '首次设置'} · FitTrack`;
    } else if (state.profile && route === '/profile') {
      app.innerHTML = layout(profilePage(state.profile), 'profile');
      document.title = '我的 · FitTrack';
    } else {
      app.innerHTML = layout(todayPage(dailySummary(state, shownDate), shownDate), 'today');
      document.title = '今日 · FitTrack';
    }
    app.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (cause) {
    if (current !== generation) return;
    app.innerHTML = layout('<section class="card error-panel"><h1>暂时无法读取数据</h1><p id="load-error" role="alert"></p><button class="primary" id="retry">重新尝试</button></section>', 'onboarding');
    app.querySelector('#load-error')!.textContent = cause instanceof Error ? cause.message : '读取失败，请重试。';
    app.querySelector('#retry')!.addEventListener('click', () => { void render(); });
  }
}
window.addEventListener('hashchange', () => { void render(); });
// Refresh a dashboard left open overnight, without discarding an unfinished form.
function refreshDay(): void {
  if (!app.querySelector('form') && shownDate !== dateKey(new Date())) void render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDay(); });
window.setInterval(refreshDay, 30_000);
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  if (!app.querySelector('form')) void render();
});
void render();
