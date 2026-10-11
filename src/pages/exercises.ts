import { categoryLabels, equipmentLabels, exerciseAliases, exerciseCatalog, exerciseImageUrl,
  exerciseSourceUrl, filterExercises, levelLabels, muscleLabels } from '../data/exercises';
import type { Exercise, ExerciseFilter } from '../data/exercises';
import { loadExerciseCatalog } from '../services/exercises';
import { escapeHtml as html } from '../utils/html';
import { recordUrl } from './records';
import { hasEquipmentModel, mountEquipmentModel } from '../ui/equipment-3d';
import type { ModelEquipment } from '../ui/equipment-3d';

const PAGE_SIZE = 24;
const label = (value: string | null, labels: Record<string, string>): string => labels[value ?? 'other'] ?? value ?? '其他';
const option = (value: string, text: string): string => `<option value="${html(value)}">${html(text)}</option>`;

function exerciseCard(exercise: Exercise, date: string): string {
  const image = exercise.images[0];
  const aliases = exerciseAliases(exercise.name);
  const muscles = exercise.primaryMuscles.map((muscle) => label(muscle, muscleLabels)).join('、');
  const secondary = exercise.secondaryMuscles.map((muscle) => label(muscle, muscleLabels)).join('、');
  const record = `${recordUrl('trainings', date, true)}&exerciseId=${encodeURIComponent(exercise.id)}`;
  const model = hasEquipmentModel(exercise.equipment)
    ? `<div class="equipment-model-section"><button class="secondary equipment-model-toggle" type="button" data-equipment="${exercise.equipment}" aria-expanded="false">查看${label(exercise.equipment, equipmentLabels)} 3D 模型</button><div class="equipment-model-panel" hidden><div class="equipment-model-canvas"></div><p>单指拖动可旋转模型 · 仅展示器械外形，动作姿势请参考示意图</p></div></div>` : '';
  return `<article class="exercise-card"><details><summary>${image ? `<img src="${exerciseImageUrl(image)}" alt="${html(exercise.name)}动作示意" loading="lazy" decoding="async" />` : '<span class="exercise-no-image">无图片</span>'}<span class="exercise-copy"><strong>${html(exercise.name)}</strong><small>${aliases.length ? `${html(aliases.join(' / '))} · ` : ''}${html(muscles)} · ${html(label(exercise.equipment, equipmentLabels))}</small><small>${html(levelLabels[exercise.level])} · ${html(categoryLabels[exercise.category])}</small></span><span class="exercise-chevron" aria-hidden="true">＋</span></summary>
    <div class="exercise-detail"><div class="exercise-tags"><span>主要：${html(muscles || '未标注')}</span><span>辅助：${html(secondary || '未标注')}</span><span>器械：${html(label(exercise.equipment, equipmentLabels))}</span></div>${model}${exercise.images[1] ? `<img class="exercise-detail-image" src="${exerciseImageUrl(exercise.images[1])}" alt="${html(exercise.name)}第二步示意" loading="lazy" decoding="async" />` : ''}<h3>动作要点（原始英文）</h3>${exercise.instructions.length ? `<ol>${exercise.instructions.map((step) => `<li>${html(step)}</li>`).join('')}</ol>` : '<p>来源未提供文字步骤。</p>'}<div class="form-actions"><a class="primary" href="${record}">记录这个动作</a><a class="text-link" href="${exerciseSourceUrl(exercise.id)}" target="_blank" rel="noopener noreferrer">查看原始数据</a></div></div></details></article>`;
}

export function exercisesPage(): string {
  const defaultServer = location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname)
    ? location.origin : '';
  return `<section class="page-heading"><p class="eyebrow">02 / EXERCISE LIBRARY</p><h1 tabindex="-1">力量动作库</h1><p class="muted">按肌群、器械或名称查找动作，再进入训练记录。</p></section>
    <section class="card equipment-showcase" aria-labelledby="equipment-showcase-title"><div class="section-heading"><div><p class="eyebrow">EQUIPMENT / 3D</p><h2 id="equipment-showcase-title">3D 器械预览</h2></div><span class="pill light">可拖动旋转</span></div>
      <div class="equipment-showcase-layout"><div class="equipment-showcase-controls" role="group" aria-label="选择器械">
        <button type="button" data-showcase-equipment="dumbbell" aria-pressed="true">哑铃</button>
        <button type="button" data-showcase-equipment="barbell" aria-pressed="false">杠铃</button>
        <button type="button" data-showcase-equipment="kettlebells" aria-pressed="false">壶铃</button>
        <p>点选器械，拖动模型查看不同角度。模型展示外形，动作要点请在下方动作库查看。</p>
      </div><div class="equipment-model-panel"><div id="equipment-showcase-canvas" class="equipment-model-canvas" aria-label="哑铃 3D 预览"></div></div></div></section>
    <section class="card exercise-library"><div class="section-heading"><h2>浏览动作</h2><span id="exercise-count" class="pill light">${exerciseCatalog.length} 个动作</span></div>
    <details class="catalog-settings"><summary>动作库连接设置</summary><form id="exercise-connect" class="catalog-connect"><label>动作库服务器地址<input name="url" type="url" placeholder="http://Mac的局域网IP:8787" value="${defaultServer}" autocomplete="off" autocapitalize="off" spellcheck="false" required /></label><button class="secondary" type="submit">读取数据库</button></form></details><p id="exercise-status" class="field-help" role="status">当前使用离线动作目录；图片需要联网加载。</p>
    <div class="exercise-filters"><label>搜索名称或肌群<input id="exercise-search" type="search" placeholder="如 深蹲、Squat、胸肌" autocomplete="off" /></label><label>肌群<select id="exercise-muscle"><option value="">全部肌群</option></select></label><label>器械<select id="exercise-equipment"><option value="">全部器械</option></select></label><label>难度<select id="exercise-level"><option value="">全部难度</option>${Object.entries(levelLabels).map(([key, value]) => option(key, value)).join('')}</select></label><label>类别<select id="exercise-category"><option value="">全部类别</option>${Object.entries(categoryLabels).map(([key, value]) => option(key, value)).join('')}</select></label></div>
    <p id="exercise-results" class="field-help"></p><div id="exercise-list" class="exercise-list"></div><button id="exercise-more" class="secondary" type="button" hidden>显示更多动作</button><p class="field-help">数据：<a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener noreferrer">free-exercise-db</a>（Unlicense）；示意图为静态图片，联网时从固定版本加载。哑铃、杠铃和壶铃可离线查看器械 3D 模型；动作原始名称和步骤为英文。</p></section>`;
}

export function bindExercises(root: HTMLElement, date: string): void {
  let catalog: readonly Exercise[] = exerciseCatalog;
  let visible = PAGE_SIZE;
  const search = root.querySelector<HTMLInputElement>('#exercise-search')!;
  const muscle = root.querySelector<HTMLSelectElement>('#exercise-muscle')!;
  const equipment = root.querySelector<HTMLSelectElement>('#exercise-equipment')!;
  const level = root.querySelector<HTMLSelectElement>('#exercise-level')!;
  const category = root.querySelector<HTMLSelectElement>('#exercise-category')!;
  const list = root.querySelector<HTMLElement>('#exercise-list')!;
  const more = root.querySelector<HTMLButtonElement>('#exercise-more')!;
  const results = root.querySelector<HTMLElement>('#exercise-results')!;
  const count = root.querySelector<HTMLElement>('#exercise-count')!;
  const status = root.querySelector<HTMLElement>('#exercise-status')!;
  const connect = root.querySelector<HTMLFormElement>('#exercise-connect')!;
  const showcaseHost = root.querySelector<HTMLElement>('#equipment-showcase-canvas')!;
  const showcaseButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-showcase-equipment]')];
  let disposeShowcase: (() => void) | null = null;
  let disposeModel: (() => void) | null = null;
  let activeButton: HTMLButtonElement | null = null;

  function showEquipment(equipmentType: ModelEquipment): void {
    closeModel();
    disposeShowcase?.();
    showcaseButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.showcaseEquipment === equipmentType)));
    showcaseHost.setAttribute('aria-label', `${label(equipmentType, equipmentLabels)} 3D 预览`);
    disposeShowcase = mountEquipmentModel(showcaseHost, equipmentType);
  }
  showcaseButtons.forEach((button) => button.addEventListener('click', () => {
    const equipmentType = button.dataset.showcaseEquipment ?? null;
    if (hasEquipmentModel(equipmentType)) showEquipment(equipmentType);
  }));

  function closeModel(): void {
    disposeModel?.();
    disposeModel = null;
    if (activeButton) {
      activeButton.setAttribute('aria-expanded', 'false');
      activeButton.textContent = `查看${label(activeButton.dataset.equipment ?? null, equipmentLabels)} 3D 模型`;
      activeButton.nextElementSibling?.setAttribute('hidden', '');
      activeButton = null;
    }
  }
  list.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('.equipment-model-toggle');
    if (!button || !list.contains(button)) return;
    if (button === activeButton) { closeModel(); return; }
    closeModel();
    disposeShowcase?.();
    disposeShowcase = null;
    showcaseButtons.forEach((showcaseButton) => showcaseButton.setAttribute('aria-pressed', 'false'));
    showcaseHost.textContent = '点选器械以重新打开 3D 预览';
    const equipmentType = button.dataset.equipment ?? null;
    if (!hasEquipmentModel(equipmentType)) return;
    const panel = button.nextElementSibling as HTMLElement;
    const host = panel.querySelector<HTMLElement>('.equipment-model-canvas')!;
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.textContent = `关闭${label(equipmentType, equipmentLabels)} 3D 模型`;
    activeButton = button;
    disposeModel = mountEquipmentModel(host, equipmentType);
  });
  list.addEventListener('toggle', (event) => {
    if (event.target instanceof HTMLDetailsElement && !event.target.open && event.target.contains(activeButton)) closeModel();
  }, true);

  function filters(): ExerciseFilter {
    return { query: search.value, muscle: muscle.value, equipment: equipment.value, level: level.value, category: category.value };
  }
  function render(): void {
    closeModel();
    const matched = filterExercises(catalog, filters());
    list.innerHTML = matched.slice(0, visible).map((exercise) => exerciseCard(exercise, date)).join('') || '<p class="empty-copy">没有匹配的动作，请调整搜索条件。</p>';
    results.textContent = `匹配 ${matched.length} 个动作，已显示 ${Math.min(visible, matched.length)} 个。`;
    more.hidden = matched.length <= visible;
  }
  function renderOptions(): void {
    const selectedMuscle = muscle.value;
    const selectedEquipment = equipment.value;
    const muscles = [...new Set(catalog.flatMap((exercise) => [...exercise.primaryMuscles, ...exercise.secondaryMuscles]))]
      .sort((a, b) => label(a, muscleLabels).localeCompare(label(b, muscleLabels), 'zh-CN'));
    const equipments = [...new Set(catalog.map((exercise) => exercise.equipment ?? 'other'))]
      .sort((a, b) => label(a, equipmentLabels).localeCompare(label(b, equipmentLabels), 'zh-CN'));
    muscle.innerHTML = `<option value="">全部肌群</option>${muscles.map((value) => option(value, label(value, muscleLabels))).join('')}`;
    equipment.innerHTML = `<option value="">全部器械</option>${equipments.map((value) => option(value, label(value, equipmentLabels))).join('')}`;
    muscle.value = selectedMuscle;
    equipment.value = selectedEquipment;
  }
  for (const field of [search, muscle, equipment, level, category]) field.addEventListener(field === search ? 'input' : 'change', () => { visible = PAGE_SIZE; render(); });
  more.addEventListener('click', () => { visible += PAGE_SIZE; render(); });
  renderOptions();
  render();
  showEquipment('dumbbell');

  async function refreshCatalog(): Promise<void> {
    const button = connect.querySelector<HTMLButtonElement>('button')!;
    button.disabled = true;
    status.textContent = '正在读取后端动作库…';
    try {
      const url = String(new FormData(connect).get('url') ?? '');
      const remote = await loadExerciseCatalog(url);
      if (!root.isConnected) return;
      catalog = remote;
      visible = PAGE_SIZE;
      count.textContent = `${remote.length} 个数据库动作`;
      renderOptions();
      render();
      status.textContent = `已从后端数据库读取 ${remote.length} 个动作；图片需要联网加载。`;
    } catch (cause) {
      status.textContent = `${cause instanceof Error ? cause.message : '读取动作库失败。'} 当前继续使用${catalog === exerciseCatalog ? '离线' : '上次读取的数据库'}目录。`;
    } finally { button.disabled = false; }
  }
  connect.addEventListener('submit', (event) => { event.preventDefault(); if (connect.reportValidity()) void refreshCatalog(); });
  if ((connect.elements.namedItem('url') as HTMLInputElement).value) void refreshCatalog();
}
