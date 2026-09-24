import { goalLabels, number, decimal as grams } from '../components/layout';
import type { dailySummary } from '../services/summary';
import type { AdaptiveRecommendation } from '../domain/adaptive-tdee';
import { recordUrl } from './records';

function recommendationCard(recommendation: AdaptiveRecommendation | null): string {
  if (!recommendation) return '';
  const { completedDays, weightDays, weightSpanDays } = recommendation.coverage;
  const result = recommendation.status === 'ready'
    ? `<strong class="metric">${number(recommendation.dynamicTdeeKcal)} <small>kcal / 天</small></strong>
       <p class="muted">结合近期记录，建议每日摄入约 <strong>${number(recommendation.suggestedTargetKcal)} kcal</strong>，作为当前目标的参考。</p>`
    : recommendation.status === 'collecting'
      ? '<p class="muted">继续记录完整饮食与体重，达到四周观察期后显示趋势估算。</p>'
      : '<p class="muted">近期体重变化波动较大，暂沿用当前基础计划；继续记录后会自动复核。</p>';
  return `<section class="card adaptive-card"><div class="section-heading"><h2>动态 TDEE 与摄入建议</h2><span class="pill light">${recommendation.status === 'ready' ? '趋势试算' : '持续观察'}</span></div>
    ${result}<p class="field-help">近 28 天：完整饮食 ${completedDays}/28 天，体重 ${weightDays} 天，称重跨度 ${weightSpanDays} 天。需要至少 21 天完整饮食、6 次称重，且首周和末周都有记录。</p>
    <p class="field-help">估算会受水分与记录误差影响，不自动更改每日目标或历史数据。训练消耗不会重复叠加。</p><a class="text-link" href="#/trends">查看体重与摄入趋势 →</a></section>`;
}

export function todayPage(summary: ReturnType<typeof dailySummary>, date: string, recommendation: AdaptiveRecommendation | null = null): string {
  const { plan, nutrition, balance, completed, weight } = summary;
  if (!plan) throw new Error('无法读取今日计划，请重试。');
  const status = completed ? '当日记录已完成' : nutrition ? '记录中 · 还不是全天摄入' : '尚无饮食记录';
  const consumedKcal = nutrition?.energyKcal ?? 0;
  const progress = Math.min(100, Math.max(0, consumedKcal / plan.targetKcal * 100));
  const progressLabel = nutrition ? `${Math.round(consumedKcal / plan.targetKcal * 100)}%` : '等待记录';
  const gaugeLabel = nutrition
    ? `已摄入 ${number(consumedKcal)} 千卡，目标 ${number(plan.targetKcal)} 千卡，完成 ${progressLabel}`
    : `目标 ${number(plan.targetKcal)} 千卡，尚无饮食记录`;
  return `<section class="page-heading"><p class="eyebrow">${date} / 每日记录</p><h1 tabindex="-1">今日概览</h1><p class="muted">饮食、活动与体重，集中查看。</p></section>
    <div class="snapshot-strip" aria-label="今日记录概览">
      <a href="${recordUrl('foods', date)}" class="snapshot"><span class="snapshot-ring" style="--story-fill: ${progress}%"><span>${nutrition ? number(consumedKcal) : '—'}</span></span><span>卡路里</span></a>
      <a href="${recordUrl('trainings', date)}" class="snapshot"><span class="snapshot-ring"><span>${summary.trainingMinutes}</span></span><span>训练分钟</span></a>
      <a href="${recordUrl('weights', date)}" class="snapshot"><span class="snapshot-ring"><span>${weight ? weight.weightKg : '—'}</span></span><span>体重 kg</span></a>
      <a href="${recordUrl('foods', date, true)}" class="snapshot"><span class="snapshot-ring add"><span>＋</span></span><span>记一餐</span></a>
    </div>
    <section class="card energy-dashboard" aria-label="今日热量仪表盘">
      <div class="dashboard-intro"><span class="pill">${goalLabels[plan.profileSnapshot.goal]}计划</span><h2>热量进度</h2><p>${status}</p></div>
      <div class="calorie-gauge${consumedKcal > plan.targetKcal ? ' is-over-target' : ''}" role="img" aria-label="${gaugeLabel}" style="--gauge-target: ${progress}%">
        <span class="gauge-glow" aria-hidden="true"></span><span class="gauge-ticks" aria-hidden="true"></span><span class="gauge-sweep" aria-hidden="true"></span>
        <div class="gauge-center"><span>已摄入</span><strong>${nutrition ? number(consumedKcal) : '—'}</strong><small>/ ${number(plan.targetKcal)} kcal</small><b>${progressLabel}</b></div>
      </div>
      <dl class="dashboard-stats">
        <div><dt>今日目标</dt><dd>${number(plan.targetKcal)} <small>kcal</small></dd></div>
        <div><dt>预计总消耗</dt><dd>${number(plan.tdeeKcal)} <small>kcal</small></dd></div>
        <div><dt>今日热量差</dt><dd class="${balance && balance.balanceKcal > 0 ? 'is-over' : ''}">${balance ? number(balance.balanceKcal) : '—'} <small>kcal</small></dd></div>
        <div><dt>BMR（估算）</dt><dd>${number(plan.bmrKcal)} <small>kcal</small></dd></div>
      </dl>
    </section>
    <div class="quick-actions"><a class="primary" href="${recordUrl('foods', date, true)}">＋ 记录饮食</a><a class="secondary" href="${recordUrl('trainings', date, true)}">记录训练</a><a class="secondary" href="${recordUrl('weights', date, true)}">记录体重</a></div>
    <section class="card"><div class="section-heading"><h2>三大营养素</h2><span class="muted">${completed ? '已完成' : nutrition ? '记录中' : '尚无记录'}</span></div><div class="macro-grid"><div><span class="macro-dot protein"></span>蛋白质<strong>${nutrition ? grams(nutrition.proteinG) : '—'} <small>g</small></strong></div><div><span class="macro-dot carbs"></span>碳水<strong>${nutrition ? grams(nutrition.carbsG) : '—'} <small>g</small></strong></div><div><span class="macro-dot fat"></span>脂肪<strong>${nutrition ? grams(nutrition.fatG) : '—'} <small>g</small></strong></div></div>
    <p class="field-help">距目标剩余 ${balance ? number(balance.remainingKcal) : '—'} kcal${balance && balance.remainingKcal < 0 ? '（已超出目标）' : ''}。</p></section>
    <section class="metric-grid"><article class="card"><h2>今日训练</h2><strong class="metric">${summary.trainingMinutes} <small>分钟</small></strong><p class="muted">估算消耗 ${number(summary.trainingKcal)} kcal</p><a href="${recordUrl('trainings', date)}">查看训练</a></article><article class="card"><h2>今日体重</h2><strong class="metric">${weight ? weight.weightKg : '—'} <small>kg</small></strong><p class="muted">${weight ? '当天已记录' : '当天尚未称重'}</p><a href="${recordUrl('weights', date)}">管理体重记录</a></article></section>
    ${recommendationCard(recommendation)}
    <section class="notice"><strong>关于今日数据</strong><p>录完全天饮食后，在饮食页标记完成。当前记录中的热量差仅供参考。训练消耗已包含在活动水平估算中，不会再次叠加到 TDEE。</p><a href="${recordUrl('foods', date)}">查看今日饮食 →</a></section>`;
}
