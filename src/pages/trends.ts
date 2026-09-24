import { decimal, number } from '../components/layout';
import { lineChart } from '../components/chart';
import type { TrendDay } from '../services/trends';
import { escapeHtml as html } from '../utils/html';

export function trendsPage(rows: TrendDay[], endDate: string, days: number, today: string): string {
  const latest = rows.at(-1)!;
  const dates = rows.map((day) => day.date);
  const show = (value: number | null, round = false) => value === null ? '—' : round ? number(value) : decimal(value);
  const average = (value: { average: number | null; count: number }, unit: string) => `<strong class="metric">${show(value.average, unit === 'kcal')} <small>${unit}</small></strong><p class="muted">最近 7 个日历日 · ${value.count}/7 天有效记录</p>`;
  return `<section class="page-heading"><p class="eyebrow">数据 / 趋势</p><h1 tabindex="-1">趋势分析</h1><p class="muted">按日期查看体重、摄入与热量差。</p></section>
    <div class="trend-controls"><label>查看范围<select id="trend-range">${[7, 30, 90].map((value) => `<option value="${value}" ${days === value ? 'selected' : ''}>最近 ${value} 天</option>`).join('')}</select></label><label>截止日期<input id="trend-end" type="date" min="1900-04-07" max="${today}" value="${endDate}" required /></label></div>
    <section class="metric-grid"><article class="card"><h2>7 日平均体重</h2>${average(latest.weightAverage, 'kg')}</article><article class="card"><h2>7 日平均摄入</h2>${average(latest.intakeAverage, 'kcal')}</article></section>
    <section class="card chart-card"><h2>体重趋势 <small>kg</small></h2>${lineChart('体重', dates, [
      { label: '每日体重', color: '#70b9b9', values: rows.map((day) => day.weight) },
      { label: '7 日平均', color: '#e9b65a', dashed: true, values: rows.map((day) => day.weightAverage.average) },
    ], 'kg')}<p class="field-help">只统计有称重记录的日期，不沿用前一天体重。纵轴根据实际范围缩放。</p><a href="#/weight">记录体重 →</a></section>
    <section class="card chart-card"><h2>摄入趋势 <small>kcal</small></h2>${lineChart('摄入', dates, [
      { label: '每日摄入', color: '#70b9b9', values: rows.map((day) => day.intake), provisional: rows.map((day) => !day.completed) },
      { label: '7 日平均', color: '#e9b65a', dashed: true, values: rows.map((day) => day.intakeAverage.average) },
    ], 'kcal', true)}<p class="field-help">空心点表示记录中。7 日平均只统计已标记完成的日期；明确完成的零摄入日也参与平均。</p></section>
    <section class="card chart-card"><h2>热量差趋势 <small>kcal</small></h2>${lineChart('热量差', dates, [
      { label: '摄入 − 当日 TDEE', color: '#d47d70', values: rows.map((day) => day.balance), provisional: rows.map((day) => !day.completed) },
    ], 'kcal', true)}<p class="field-help">负值表示缺口，正值表示盈余。空心点为记录中；没有当日计划快照的日期不估造热量差。</p></section>
    <section class="card"><h2>每日明细</h2><p class="field-help">“—”表示缺失。均值后的天数是该日期向前 7 天窗口内的有效天数。可横向滚动查看。</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="每日趋势明细，可横向滚动"><table class="trend-table"><thead><tr><th scope="col">日期</th><th scope="col">体重 kg</th><th scope="col">7 日均重</th><th scope="col">摄入 kcal</th><th scope="col">7 日均摄入</th><th scope="col">热量差 kcal</th><th scope="col">饮食状态</th></tr></thead><tbody>${[...rows].reverse().map((day) => `<tr><th scope="row">${html(day.date)}</th><td>${show(day.weight)}</td><td>${show(day.weightAverage.average)} / ${day.weightAverage.count}天</td><td>${show(day.intake, true)}</td><td>${show(day.intakeAverage.average, true)} / ${day.intakeAverage.count}天</td><td>${show(day.balance, true)}${day.intake !== null && !day.hasPlan ? '（无计划）' : ''}</td><td>${day.completed ? '已完成' : day.intake !== null ? '记录中' : '未记录'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
export function bindTrends(root: HTMLElement): void {
  const range = root.querySelector<HTMLSelectElement>('#trend-range')!;
  const end = root.querySelector<HTMLInputElement>('#trend-end')!;
  const update = () => { if (end.reportValidity()) location.hash = `/trends?days=${range.value}&end=${end.value}`; };
  range.addEventListener('change', update);
  end.addEventListener('change', update);
}
