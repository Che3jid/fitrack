export const activityLabels = {
  sedentary: '久坐 · 日常活动少', light: '轻度 · 每周训练 1–3 天', moderate: '中度 · 每周训练 3–5 天',
  high: '高度 · 每周训练 6–7 天', veryHigh: '极高 · 高强度训练或体力劳动',
};
export const goalLabels = { lose: '减脂', maintain: '维持', gain: '增肌' };
export const number = (value: number): string => Math.round(value).toLocaleString('zh-CN');
export const decimal = (value: number): string => value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const tabIcons = {
  today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  diet: '<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M16 21V3c3 2 4 5 4 9h-4v9"/>',
  training: '<path d="M3 9v6m3-8v10m3-7v4m6-4v4m3-7v10m3-8v6M9 12h6"/>',
  trends: '<path d="M3 17l6-6 4 4 8-8M16 7h5v5"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
} as const;
const tab = (page: keyof typeof tabIcons, label: string, active: string) =>
  `<a href="#/${page}" ${active === page ? 'aria-current="page"' : ''}><svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tabIcons[page]}</svg><span>${label}</span></a>`;
export function layout(content: string, active: 'today' | 'profile' | 'onboarding' | 'diet' | 'training' | 'trends'): string {
  return `<div class="shell page-${active}"><header class="brand"><a href="#/today"><span class="brand-mark" aria-hidden="true">F</span><span class="brand-name">Fit<span>Track</span></span></a><span class="local-badge">本地记录</span></header>
    <main id="main">${content}</main><footer>数据仅保存在当前浏览器 · 清除网站数据会丢失记录</footer>
    ${active === 'onboarding' ? '' : `<nav class="bottom-nav" aria-label="主导航">
      ${tab('today', '今日', active)}
      ${tab('diet', '饮食', active)}
      ${tab('training', '训练', active)}
      ${tab('trends', '趋势', active)}
      ${tab('profile', '我的', active)}
    </nav>`}</div>`;
}
