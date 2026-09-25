import { number, decimal } from '../components/layout';
import { foodCatalog, catalogSourceUrl } from '../data/food-catalog';
import { calculateRecipe } from '../domain/recipe';
import type { CookingMethod, RecipeLine } from '../domain/recipe';
import { MEALS } from '../domain/records';
import type { MealType } from '../domain/models';
import { RecordService } from '../services/records';
import { escapeHtml as html } from '../utils/html';
import { recordUrl } from './records';

const methods: Record<CookingMethod, string> = {
  raw: '不加热 / 凉拌', boil: '水煮 / 炖', steam: '清蒸', 'stir-fry': '翻炒',
  'pan-fry': '煎', bake: '烤 / 烘焙', 'deep-fry': '油炸',
};

export function foodLibraryPage(date: string, today: string, meal: MealType): string {
  const cards = foodCatalog.filter((food) => food.group !== '食用油').map((food) =>
    `<article class="catalog-food" data-name="${html(food.name)}" data-group="${food.group}"><div><strong>${html(food.name)}</strong><small>${food.group} · 每 100 g：${number(food.per100g.energyKcal)} kcal · 钠 ${number(food.per100g.sodiumMg)} mg</small></div><div class="catalog-actions"><a href="${catalogSourceUrl(food.fdcId)}" target="_blank" rel="noopener noreferrer" aria-label="查看${html(food.name)}的数据来源">USDA</a><button type="button" class="secondary" data-add="${food.id}">添加</button></div></article>`).join('');
  return `<section class="page-heading"><p class="eyebrow">食物库 / 配方计算</p><h1 tabindex="-1">从食材算一餐</h1><p class="muted">用原始食材、调味料和实际留在菜中的油估算成品营养。</p></section>
    <div class="recipe-layout"><section class="card catalog-panel"><div class="section-heading"><h2>选择食材</h2><span class="pill light">${foodCatalog.length} 种基础数据</span></div><div class="field-grid"><label>搜索<input id="catalog-search" type="search" placeholder="例如 鸡蛋、酱油" autocomplete="off" /></label><label>分类<select id="catalog-group"><option value="">全部</option><option value="食材">食材</option><option value="调味料">调味料</option></select></label></div><div class="catalog-list">${cards}</div><p id="catalog-empty" class="empty-copy" hidden>没有匹配的食材。</p><p class="field-help">数据为 USDA SR Legacy 每 100 g 可食部分值；生熟、品种和品牌不同会有差异。点击 USDA 可查看每项原始记录。</p></section>
    <form id="recipe-form" class="card recipe-panel"><h2>这道菜</h2><label>菜名<input name="dishName" type="text" maxlength="80" required placeholder="例如 番茄炒蛋" /></label><div id="recipe-lines" class="recipe-lines"><p class="empty-copy">从左侧添加食材或调味料。</p></div>
      <div class="field-grid"><label>烹饪方式<select name="method">${Object.entries(methods).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></label><label>使用的油<select name="oilId">${foodCatalog.filter((food) => food.group === '食用油').map((food) => `<option value="${food.id}">${food.name}</option>`).join('')}</select></label><label>实际留在菜中的油（g）<input name="retainedOilG" type="number" inputmode="decimal" min="0" max="500" step="any" value="0" required /></label><label>成品总重（g，可选）<input name="cookedWeightG" type="number" inputmode="decimal" min="0.1" max="100000" step="any" placeholder="称重后更准确" /></label><label>本次吃的成品重量（g，可选）<input name="servingWeightG" type="number" inputmode="decimal" min="0.1" max="100000" step="any" placeholder="留空＝整道菜" /></label><label>餐次<select name="mealType">${Object.entries(MEALS).map(([key, label]) => `<option value="${key}" ${key === meal ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>记录日期<input name="date" type="date" min="1900-01-01" max="${today}" value="${date}" required /></label></div>
      <p id="method-tip" class="field-help">凉拌时，请把实际食用的油和调味料都计入。</p><p class="field-help">烹饪方式本身不增加热量；油、糖和酱料按实际进入食物的量计入。水分变化只影响每 100 g 的数值。若倒掉汤汁或剩余油，请只填实际吃到的部分。</p><div id="recipe-result" class="recipe-result" aria-live="polite"><p class="empty-copy">添加食材后显示整道菜和本次食用份的估算。</p></div><p id="recipe-error" class="form-error" role="alert"></p><div class="form-actions"><button id="recipe-save" class="primary" type="submit" disabled>记入饮食</button><a class="secondary" href="${recordUrl('foods', date)}">返回饮食</a></div></form></div>`;
}

export function bindFoodLibrary(root: HTMLElement, service: RecordService): void {
  const catalog = new Map(foodCatalog.map((food) => [food.id, food]));
  const form = root.querySelector<HTMLFormElement>('#recipe-form')!;
  const linesRoot = root.querySelector<HTMLElement>('#recipe-lines')!;
  const resultRoot = root.querySelector<HTMLElement>('#recipe-result')!;
  const error = root.querySelector<HTMLElement>('#recipe-error')!;
  const save = root.querySelector<HTMLButtonElement>('#recipe-save')!;
  const methodTip = root.querySelector<HTMLElement>('#method-tip')!;
  const lines: RecipeLine[] = [];
  let saving = false;

  const value = (name: string): string => String(new FormData(form).get(name) ?? '').trim();
  const optional = (name: string): number | undefined => value(name) === '' ? undefined : Number(value(name));
  const input = () => ({
    lines, method: value('method') as CookingMethod, oilId: value('oilId'), retainedOilG: Number(value('retainedOilG')),
    cookedWeightG: optional('cookedWeightG'), servingWeightG: optional('servingWeightG'),
  });
  function updateResult(): void {
    if (!lines.length) { save.disabled = true; resultRoot.innerHTML = '<p class="empty-copy">添加食材后显示整道菜和本次食用份的估算。</p>'; return; }
    try {
      const result = calculateRecipe(input(), foodCatalog);
      save.disabled = saving;
      error.textContent = '';
      resultRoot.innerHTML = `<div><span>整道菜</span><strong>${number(result.total.energyKcal)} <small>kcal</small></strong><small>蛋白质 ${decimal(result.total.proteinG)} g · 碳水 ${decimal(result.total.carbsG)} g · 脂肪 ${decimal(result.total.fatG)} g</small></div><div><span>本次食用</span><strong>${number(result.serving.energyKcal)} <small>kcal</small></strong><small>${decimal(result.servingWeightG)} g · 每 100 g ${number(result.per100g.energyKcal)} kcal</small></div><p>本次钠约 ${number(result.serving.sodiumMg)} mg，折合食盐约 ${decimal(result.serving.sodiumMg * 2.5 / 1000)} g。${result.measuredCookedWeight ? '' : '未填写成品重量，暂以原料总重估算食用重量。'}</p>`;
    } catch (cause) {
      save.disabled = true;
      resultRoot.innerHTML = '';
      error.textContent = cause instanceof Error ? cause.message : '无法计算这道菜。';
    }
  }
  function renderLines(): void {
    linesRoot.innerHTML = lines.length ? lines.map((line, index) => {
      const food = catalog.get(line.foodId)!;
      return `<div class="recipe-line"><span>${html(food.name)}</span><label><input type="number" inputmode="decimal" min="0.1" max="10000" step="any" value="${line.weightG}" data-line="${index}" aria-label="${html(food.name)}重量，克" /> g</label><button type="button" class="text-button danger" data-remove="${index}" aria-label="移除${html(food.name)}">移除</button></div>`;
    }).join('') : '<p class="empty-copy">从左侧添加食材或调味料。</p>';
    updateResult();
  }
  root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((button) => button.addEventListener('click', () => {
    const food = catalog.get(button.dataset.add ?? '');
    if (!food || lines.length >= 30) { error.textContent = '最多添加 30 项。'; return; }
    lines.push({ foodId: food.id, weightG: food.group === '调味料' ? (food.id === 'salt' ? 2 : 5) : 100 });
    renderLines();
    linesRoot.scrollIntoView({ block: 'nearest' });
  }));
  linesRoot.addEventListener('input', (event) => {
    const field = event.target as HTMLInputElement;
    const index = Number(field.dataset.line);
    if (Number.isInteger(index) && lines[index]) { lines[index].weightG = Number(field.value); updateResult(); }
  });
  linesRoot.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (button) { lines.splice(Number(button.dataset.remove), 1); renderLines(); }
  });
  form.addEventListener('input', (event) => { if (!(event.target as HTMLElement).hasAttribute('data-line')) updateResult(); });
  form.addEventListener('change', () => {
    const method = value('method') as CookingMethod;
    methodTip.textContent = method === 'boil' || method === 'steam'
      ? '水煮、清蒸会改变含水量。倒掉的汤汁若带走油或调味料，请只计入最终吃下的部分。'
      : method === 'stir-fry' || method === 'pan-fry' || method === 'deep-fry'
        ? '炒、煎、炸请估算实际留在食物里的油；锅中剩油不要重复计入。'
        : method === 'bake' ? '烘烤会减少水分。流出的油脂若没有吃下，请不要计入成品。'
          : '凉拌时，请把实际食用的油和调味料都计入。';
    updateResult();
  });
  const search = root.querySelector<HTMLInputElement>('#catalog-search')!;
  const group = root.querySelector<HTMLSelectElement>('#catalog-group')!;
  function filter(): void {
    const query = search.value.trim().toLocaleLowerCase('zh-CN');
    let shown = 0;
    root.querySelectorAll<HTMLElement>('.catalog-food').forEach((row) => {
      row.hidden = Boolean((group.value && row.dataset.group !== group.value) || (query && !row.dataset.name?.toLocaleLowerCase('zh-CN').includes(query)));
      if (!row.hidden) shown += 1;
    });
    root.querySelector<HTMLElement>('#catalog-empty')!.hidden = shown > 0;
  }
  search.addEventListener('input', filter);
  group.addEventListener('change', filter);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    saving = true; save.disabled = true; error.textContent = '';
    try {
      const result = calculateRecipe(input(), foodCatalog);
      const rounded = (num: number) => Math.round(num * 10) / 10;
      await service.saveFood({
        date: value('date'), mealType: value('mealType') as MealType, name: value('dishName'),
        weightG: rounded(result.servingWeightG), energyKcal: rounded(result.serving.energyKcal),
        proteinG: rounded(result.serving.proteinG), carbsG: rounded(result.serving.carbsG),
        fatG: rounded(result.serving.fatG), sodiumMg: rounded(result.serving.sodiumMg),
      });
      location.hash = recordUrl('foods', value('date')).slice(1);
    } catch (cause) { error.textContent = cause instanceof Error ? cause.message : '保存失败，请重试。'; }
    finally { saving = false; updateResult(); }
  });
}
