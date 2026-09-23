import type { DailyPlan } from '../domain/models';
import { goalLabels, number } from '../components/layout';
export function todayPage(plan: DailyPlan): string {
  return `<section class="page-heading"><p class="eyebrow">${plan.date} · 今天也向前一步</p><h1 tabindex="-1">每一天，都算数。</h1><p class="muted">保持节奏，从了解今天的目标开始。</p></section>
    <section class="card energy-card" aria-label="今日热量目标"><div><span class="pill">${goalLabels[plan.profileSnapshot.goal]}计划</span><h2>今日目标热量</h2><strong class="hero-number">${number(plan.targetKcal)}<span>kcal / 天</span></strong><p>依据当前身体数据和活动水平估算</p></div><div class="energy-detail"><div><span>BMR（估算）</span><strong>${number(plan.bmrKcal)} <small>kcal</small></strong></div><div><span>预计总消耗 · TDEE</span><strong>${number(plan.tdeeKcal)} <small>kcal</small></strong></div></div></section>
    <section class="metric-grid" aria-label="今日记录状态"><article class="card"><h2>已摄入热量</h2><strong class="metric">— <small>kcal</small></strong><p class="muted">尚无饮食记录</p></article><article class="card"><h2>今日热量差</h2><strong class="metric">— <small>kcal</small></strong><p class="muted">有摄入记录后计算</p></article></section>
    <section class="card"><div class="section-heading"><h2>三大营养素</h2><span class="muted">尚无记录</span></div><div class="macro-grid">${[['蛋白质', 'protein'], ['碳水', 'carbs'], ['脂肪', 'fat']].map(([label, key]) => `<div><span class="macro-dot ${key}"></span>${label}<strong>— <small>g</small></strong></div>`).join('')}</div></section>
    <section class="notice"><strong>先把目标设好，记录功能即将开放</strong><p>下一阶段将支持饮食、训练和每日体重记录。预计总消耗已包含活动水平中的训练消耗，不再重复叠加。</p><a href="#/profile">查看个人资料 →</a></section>`;
}
