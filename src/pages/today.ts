import { goalLabels, number, decimal as grams } from '../components/layout';
import type { dailySummary } from '../services/summary';
import { recordUrl } from './records';

export function todayPage(summary: ReturnType<typeof dailySummary>, date: string): string {
  const { plan, nutrition, balance, completed, weight } = summary;
  if (!plan) throw new Error('无法读取今日计划，请重试。');
  const status = completed ? '当日记录已完成' : nutrition ? '记录中 · 还不是全天摄入' : '尚无饮食记录';
  const consumedKcal = nutrition?.energyKcal ?? 0;
  const progress = Math.min(100, Math.max(0, consumedKcal / plan.targetKcal * 100));
  const progressLabel = nutrition ? `${Math.round(consumedKcal / plan.targetKcal * 100)}%` : '等待记录';
  const gaugeLabel = nutrition
    ? `已摄入 ${number(consumedKcal)} 千卡，目标 ${number(plan.targetKcal)} 千卡，完成 ${progressLabel}`
    : `目标 ${number(plan.targetKcal)} 千卡，尚无饮食记录`;
  return `<section class="page-heading"><p class="eyebrow">${date} · 今天也向前一步</p><h1 tabindex="-1">每一天，都算数。</h1><p class="muted">保持节奏，从今天的一餐、一次训练开始。</p></section>
    <section class="card energy-dashboard" aria-label="今日热量仪表盘">
      <div class="dashboard-intro"><span class="pill">${goalLabels[plan.profileSnapshot.goal]}计划</span><h2>今日能量仪表盘</h2><p>${status}</p></div>
      <div class="calorie-gauge" role="img" aria-label="${gaugeLabel}" style="--gauge-progress: ${progress}%">
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
    <section class="metric-grid" aria-label="今日记录状态"><article class="card"><h2>已摄入热量</h2><strong class="metric">${nutrition ? number(nutrition.energyKcal) : '—'} <small>kcal</small></strong><p class="muted">${status}</p></article><article class="card"><h2>今日热量差</h2><strong class="metric">${balance ? number(balance.balanceKcal) : '—'} <small>kcal</small></strong><p class="muted">${balance ? '摄入 − TDEE · 负数表示缺口' : '有摄入记录后计算'}</p></article></section>
    <section class="card"><div class="section-heading"><h2>三大营养素</h2><span class="muted">${completed ? '已完成' : nutrition ? '记录中' : '尚无记录'}</span></div><div class="macro-grid"><div><span class="macro-dot protein"></span>蛋白质<strong>${nutrition ? grams(nutrition.proteinG) : '—'} <small>g</small></strong></div><div><span class="macro-dot carbs"></span>碳水<strong>${nutrition ? grams(nutrition.carbsG) : '—'} <small>g</small></strong></div><div><span class="macro-dot fat"></span>脂肪<strong>${nutrition ? grams(nutrition.fatG) : '—'} <small>g</small></strong></div></div>
    <p class="field-help">距目标剩余 ${balance ? number(balance.remainingKcal) : '—'} kcal${balance && balance.remainingKcal < 0 ? '（已超出目标）' : ''}。</p></section>
    <section class="metric-grid"><article class="card"><h2>今日训练</h2><strong class="metric">${summary.trainingMinutes} <small>分钟</small></strong><p class="muted">估算消耗 ${number(summary.trainingKcal)} kcal</p><a href="${recordUrl('trainings', date)}">查看训练</a></article><article class="card"><h2>今日体重</h2><strong class="metric">${weight ? weight.weightKg : '—'} <small>kg</small></strong><p class="muted">${weight ? '当天已记录' : '当天尚未称重'}</p><a href="${recordUrl('weights', date)}">管理体重记录</a></article></section>
    <section class="notice"><strong>记录完整，趋势才有意义</strong><p>录完全天饮食后，在饮食页标记完成。当前记录中的热量差仅供参考。训练消耗已包含在活动水平估算中，不会再次叠加到 TDEE。</p><a href="${recordUrl('foods', date)}">查看今日饮食 →</a></section>`;
}
