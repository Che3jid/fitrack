import { calculateEnergyPlan } from '../domain/calculations';
import type { UserProfile } from '../domain/models';
import { activityLabels, goalLabels, number } from '../components/layout';
export function profilePage(profile: UserProfile): string {
  const plan = calculateEnergyPlan(profile);
  return `<section class="page-heading"><p class="eyebrow">我的 FitTrack</p><h1 tabindex="-1">你的身体，你的节奏。</h1><p class="muted">资料改变时，随时调整计划。</p></section>
    <section class="card"><div class="section-heading"><h2>个人资料</h2><a href="#/profile/edit" class="secondary">编辑资料</a></div><dl class="details"><div><dt>公式使用的性别</dt><dd>${profile.sex === 'male' ? '男' : '女'}</dd></div><div><dt>年龄</dt><dd>${profile.ageYears} 岁</dd></div><div><dt>身高</dt><dd>${profile.heightCm} cm</dd></div><div><dt>当前体重</dt><dd>${profile.weightKg} kg</dd></div><div><dt>活动水平</dt><dd>${activityLabels[profile.activityLevel]}</dd></div><div><dt>健身目标</dt><dd>${goalLabels[profile.goal]}</dd></div></dl></section>
    <section class="card"><h2>当前热量计划</h2><dl class="details"><div><dt>BMR（估算）</dt><dd>${number(plan.bmrKcal)} kcal</dd></div><div><dt>TDEE（估算）</dt><dd>${number(plan.tdeeKcal)} kcal</dd></div><div><dt>每日目标</dt><dd>${number(plan.targetKcal)} kcal</dd></div></dl></section>
    <section class="notice"><strong>关于本地数据</strong><p>资料仅保存在这个浏览器，不会自动同步到其他设备。数据备份功能将在后续阶段开放，请勿清除网站数据。</p></section>`;
}
