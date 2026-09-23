import './styles/global.css';
import { layout } from './components/layout';
import { profilePage } from './pages/profile';
import { bindProfileForm, profileForm } from './pages/profile-form';
import { todayPage } from './pages/today';
import { ProfileService } from './services/profile';
import { LocalRepository, STORAGE_KEY } from './storage/local';
import { dateKey } from './utils/date';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('FitTrack root element is missing');
const app = root;
const service = new ProfileService(new LocalRepository(() => window.localStorage));
let generation = 0;
let shownDate = dateKey(new Date());

async function render(): Promise<void> {
  const current = ++generation;
  try {
    const state = await service.today();
    if (current !== generation) return;
    shownDate = dateKey(new Date());
    let route = location.hash.slice(1) || '/today';
    if (!state.profile) route = '/onboarding';
    else if (!['/today', '/profile', '/profile/edit'].includes(route)) route = '/today';
    if (location.hash !== `#${route}`) history.replaceState(null, '', `#${route}`);
    const editing = route === '/profile/edit';
    if (route === '/onboarding' || editing) {
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
      const plan = state.plans.find((entry) => entry.date === shownDate);
      if (!plan) throw new Error('无法读取今日计划，请重试。');
      app.innerHTML = layout(todayPage(plan), 'today');
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
  if (location.hash === '#/today' && shownDate !== dateKey(new Date())) void render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDay(); });
window.setInterval(refreshDay, 30_000);
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  if (!app.querySelector('form')) void render();
});
void render();
