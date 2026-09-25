import './styles/global.css';
import './styles/iphone.css';
import { layout } from './components/layout';
import { profilePage } from './pages/profile';
import { bindProfileForm, profileForm } from './pages/profile-form';
import { todayPage } from './pages/today';
import { ProfileService } from './services/profile';
import { IndexedDbRepository } from './storage/indexed-db';
import { dateKey } from './utils/date';
import { validateRecordDate } from './domain/records';
import { RecordService } from './services/records';
import type { RecordKind } from './services/records';
import { dailySummary } from './services/summary';
import { recordsPage, bindRecordList } from './pages/records';
import { recordForm, bindRecordForm } from './pages/record-form';
import { buildTrends } from './services/trends';
import { trendsPage, bindTrends } from './pages/trends';
import { BackupService } from './services/backup';
import { backupPage, bindBackup } from './pages/backup';
import { adaptiveRecommendation } from './services/recommendations';
import { animateView, stopMotion } from './ui/motion';
import { SyncService } from './services/sync';
import { bindSync, syncPage } from './pages/sync';
import { bindFoodLibrary, foodLibraryPage } from './pages/food-library';
import { MEALS } from './domain/records';
import type { MealType } from './domain/models';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('FitTrack root element is missing');
const app = root;
const repository = new IndexedDbRepository(window.indexedDB, () => window.localStorage);
const service = new ProfileService(repository);
const records = new RecordService(repository);
const backups = new BackupService(repository);
const sync = new SyncService(repository);
let generation = 0;
let shownDate = dateKey(new Date());

async function render(): Promise<void> {
  const current = ++generation;
  try {
    // Backup and sync previews must not implicitly add a daily plan.
    const utilityPage = ['#/backup', '#/sync'].includes(location.hash.split('?')[0] ?? '');
    const state = utilityPage ? await repository.read() : await service.today();
    if (current !== generation) return;
    shownDate = dateKey(new Date());
    const [path, query] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(query);
    let route = path || '/today';
    if (!state.profile && route !== '/backup' && route !== '/sync') route = '/onboarding';
    else if (!['/today', '/profile', '/profile/edit', '/diet', '/diet/edit', '/library', '/training', '/training/edit', '/weight', '/weight/edit', '/trends', '/backup', '/sync', '/onboarding'].includes(route)) route = '/today';
    if (state.profile && route === '/onboarding') route = '/today';
    if (route !== path) history.replaceState(null, '', `#${route}`);
    const editing = route === '/profile/edit';
    const kind: RecordKind | null = route.startsWith('/diet') ? 'foods' : route.startsWith('/training') ? 'trainings' : route.startsWith('/weight') ? 'weights' : null;
    if (route === '/sync') {
      app.innerHTML = layout(syncPage(state), state.profile ? 'profile' : 'onboarding');
      bindSync(app, sync, render);
      document.title = '数据库同步 · FitTrack';
    } else if (route === '/backup') {
      app.innerHTML = layout(backupPage(state), state.profile ? 'profile' : 'onboarding');
      bindBackup(app, backups, state, render);
      document.title = '数据备份 · FitTrack';
    } else if (route === '/library') {
      let date = params.get('date') ?? shownDate;
      try { validateRecordDate(date, shownDate); } catch { date = shownDate; }
      const requestedMeal = params.get('meal') ?? 'breakfast';
      const meal = Object.hasOwn(MEALS, requestedMeal) ? requestedMeal as MealType : 'breakfast';
      app.innerHTML = layout(foodLibraryPage(date, shownDate, meal), 'diet');
      bindFoodLibrary(app, records);
      document.title = '食材与配方 · FitTrack';
    } else if (route === '/trends') {
      const requested = Number(params.get('days') ?? 30);
      const days = [7, 30, 90].includes(requested) ? requested : 30;
      let end = params.get('end') ?? shownDate;
      try { validateRecordDate(end, shownDate); if (end < '1900-04-07') end = shownDate; } catch { end = shownDate; }
      app.innerHTML = layout(trendsPage(buildTrends(state, end, days), end, days, shownDate), 'trends');
      bindTrends(app);
      document.title = '趋势 · FitTrack';
    } else if (kind) {
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
      if (!editing) app.querySelector('main')!.insertAdjacentHTML('beforeend', '<a class="text-link" href="#/backup">已有备份？导入恢复 →</a><p><a class="text-link" href="#/sync">已有数据库？连接下载 →</a></p>');
      bindProfileForm(app, async (input) => {
        await service.save(input);
        location.hash = editing ? '/profile' : '/today';
      });
      document.title = `${editing ? '编辑资料' : '首次设置'} · FitTrack`;
    } else if (state.profile && route === '/profile') {
      app.innerHTML = layout(profilePage(state.profile), 'profile');
      document.title = '我的 · FitTrack';
    } else {
      app.innerHTML = layout(todayPage(dailySummary(state, shownDate), shownDate, adaptiveRecommendation(state, shownDate)), 'today');
      document.title = '今日 · FitTrack';
    }
    app.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    animateView(app, route);
  } catch (cause) {
    if (current !== generation) return;
    stopMotion();
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
repository.onChange(() => {
  if (!app.querySelector('form')) void render();
});
void render();
