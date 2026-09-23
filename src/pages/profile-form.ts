import { calculateEnergyPlan } from '../domain/calculations';
import type { ActivityLevel, Goal, ProfileInput, Sex } from '../domain/models';
import { activityLabels, goalLabels, number } from '../components/layout';
export function profileForm(current: ProfileInput | null): string {
  const options = (values: Record<string, string>, selected: string) => Object.entries(values).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  return `<section class="page-heading"><p class="eyebrow">${current ? '个人设置' : '从了解自己开始'}</p><h1 tabindex="-1">${current ? '调整你的计划' : '为你计算每日目标'}</h1><p class="muted">${current ? '更新资料后，当天目标会重新计算，历史目标保持不变。' : '填写基础资料，找到适合当前目标的热量起点。'}</p></section>
    <div class="form-layout"><form id="profile-form" class="card"><h2>身体数据</h2><div class="field-grid">
      <label>公式使用的性别<select name="sex" required>${options({ '': '请选择', male: '男', female: '女' }, current?.sex ?? '')}</select></label>
      <label>年龄 <span class="unit">岁</span><input name="ageYears" type="number" inputmode="numeric" min="18" max="100" step="1" required value="${current?.ageYears ?? ''}" placeholder="18–100" /></label>
      <label>身高 <span class="unit">cm</span><input name="heightCm" type="number" inputmode="decimal" min="100" max="250" step="any" required value="${current?.heightCm ?? ''}" placeholder="例如 175" /></label>
      <label>体重 <span class="unit">kg</span><input name="weightKg" type="number" inputmode="decimal" min="30" max="350" step="any" required value="${current?.weightKg ?? ''}" placeholder="例如 70" /></label></div>
      <label>活动水平<select name="activityLevel">${options(activityLabels, current?.activityLevel ?? 'sedentary')}</select></label>
      <p class="field-help">综合考虑日常活动和训练；训练消耗已计入 TDEE。</p>
      <label>健身目标<select name="goal">${options(goalLabels, current?.goal ?? 'maintain')}</select></label>
      <p class="form-error" id="form-error" role="alert"></p>
      <div class="form-actions"><button type="submit" class="primary">${current ? '保存修改' : '保存并开始'}</button>${current ? '<a href="#/profile" class="secondary">取消</a>' : ''}</div>
      <p class="field-help">仅适用于成年人。首次保存或修改体重时，会记录当天体重。</p>
    </form><aside class="card plan-preview" aria-label="热量估算预览"><p class="eyebrow">你的每日计划</p><div id="plan-preview" aria-live="polite"></div><p class="field-help">使用 Mifflin–St Jeor 公式估算。减脂目标为 TDEE 的 85%，维持 100%，增肌 110%。结果是估算起点，不是个体化医疗建议。</p></aside></div>`;
}
function readInput(form: HTMLFormElement): ProfileInput {
  const data = new FormData(form);
  return { sex: String(data.get('sex')) as Sex, ageYears: Number(data.get('ageYears')), heightCm: Number(data.get('heightCm')), weightKg: Number(data.get('weightKg')), activityLevel: String(data.get('activityLevel')) as ActivityLevel, goal: String(data.get('goal')) as Goal };
}
export function bindProfileForm(root: HTMLElement, save: (input: ProfileInput) => Promise<void>): void {
  const form = root.querySelector<HTMLFormElement>('#profile-form')!;
  const preview = root.querySelector<HTMLElement>('#plan-preview')!;
  const error = root.querySelector<HTMLElement>('#form-error')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  let saving = false;
  const update = () => {
    try {
      const plan = calculateEnergyPlan(readInput(form));
      preview.innerHTML = `<strong class="hero-number">${number(plan.targetKcal)}<span>kcal / 天</span></strong><dl class="details"><div><dt>BMR（估算）</dt><dd>${number(plan.bmrKcal)} kcal</dd></div><div><dt>TDEE（估算）</dt><dd>${number(plan.tdeeKcal)} kcal</dd></div></dl>`;
    } catch { preview.innerHTML = '<p class="preview-empty">填写完整资料后，<br />这里会展示你的热量目标。</p>'; }
  };
  form.addEventListener('input', () => { error.textContent = ''; update(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    let input: ProfileInput;
    try { input = readInput(form); calculateEnergyPlan(input); }
    catch { error.textContent = '请检查性别、年龄、身高、体重和目标是否填写正确。'; return; }
    saving = true; button.disabled = true;
    const label = button.textContent;
    button.textContent = '正在保存…'; error.textContent = '';
    try { await save(input); }
    catch (cause) { error.textContent = cause instanceof Error ? cause.message : '保存失败，请重试。'; }
    finally { saving = false; button.disabled = false; button.textContent = label; }
  });
  update();
}
