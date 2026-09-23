import './styles/global.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('FitTrack root element is missing');

app.innerHTML = `
  <main class="shell">
    <header class="brand"><span class="brand-mark" aria-hidden="true">F</span> FitTrack</header>
    <section class="intro" aria-labelledby="title">
      <p class="eyebrow">每天一点，持续进步</p>
      <h1 id="title">了解身体，<br />记录改变。</h1>
      <p class="description">从每天的饮食、训练与体重开始，<br class="desktop-break" />让每一次坚持都有迹可循。</p>
      <div class="status"><span aria-hidden="true"></span> 开发中 · 工程基础已就绪</div>
    </section>
    <section class="features" aria-label="规划中的功能">
      <article><span class="number">01</span><h2>饮食与营养</h2><p>记录四餐，了解热量与三大营养素。</p></article>
      <article><span class="number">02</span><h2>训练与消耗</h2><p>留下训练记录，跟踪每日活动。</p></article>
      <article><span class="number">03</span><h2>体重与趋势</h2><p>通过长期趋势，观察自己的变化。</p></article>
    </section>
    <footer>第一阶段预览 · 记录功能将在后续阶段开放</footer>
  </main>
`;
