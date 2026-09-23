export const activityLabels = {
  sedentary: '久坐 · 日常活动少', light: '轻度 · 每周训练 1–3 天', moderate: '中度 · 每周训练 3–5 天',
  high: '高度 · 每周训练 6–7 天', veryHigh: '极高 · 高强度训练或体力劳动',
};
export const goalLabels = { lose: '减脂', maintain: '维持', gain: '增肌' };
export const number = (value: number): string => Math.round(value).toLocaleString('zh-CN');
export const decimal = (value: number): string => value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
export function layout(content: string, active: 'today' | 'profile' | 'onboarding' | 'diet' | 'training'): string {
  return `<div class="shell"><header class="brand"><a href="#/today"><span class="brand-mark" aria-hidden="true">F</span>FitTrack</a><span class="local-badge">本地记录</span></header>
    <main id="main">${content}</main><footer>数据仅保存在当前浏览器 · 清除网站数据会丢失记录</footer>
    ${active === 'onboarding' ? '' : `<nav class="bottom-nav" aria-label="主导航">
      <a href="#/today" ${active === 'today' ? 'aria-current="page"' : ''}>◉ <span>今日</span></a>
      <a href="#/diet" ${active === 'diet' ? 'aria-current="page"' : ''}>▤ <span>饮食</span></a>
      <a href="#/training" ${active === 'training' ? 'aria-current="page"' : ''}>◇ <span>训练</span></a>
      <span class="coming">趋势<small>即将开放</small></span>
      <a href="#/profile" ${active === 'profile' ? 'aria-current="page"' : ''}>◎ <span>我的</span></a>
    </nav>`}</div>`;
}
