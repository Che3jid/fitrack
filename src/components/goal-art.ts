import type { Goal } from '../domain/models';

const illustrations: Record<Goal, { caption: string; drawing: string }> = {
  gain: {
    caption: '积累力量，循序渐进',
    drawing: `<ellipse cx="90" cy="96" rx="58" ry="8" fill="currentColor" opacity=".08"/>
      <path d="M24 85V69m10 16V57m10 28V45" stroke="currentColor" stroke-width="2" opacity=".25"/>
      <g transform="translate(92 57) rotate(-28)">
        <rect x="-45" y="-5" width="90" height="10" rx="4" fill="#303034"/>
        <rect x="-41" y="-24" width="15" height="48" rx="5" fill="#303034"/>
        <rect x="-53" y="-17" width="12" height="34" rx="4" fill="currentColor"/>
        <rect x="26" y="-24" width="15" height="48" rx="5" fill="#303034"/>
        <rect x="41" y="-17" width="12" height="34" rx="4" fill="currentColor"/>
        <path d="M-34-17v34m67-34v34" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
      </g>
      <path d="M141 25h10m-5-5v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  lose: {
    caption: '轻盈前行，稳稳坚持',
    drawing: `<g fill="none" stroke="currentColor" opacity=".22" stroke-width="2">
        <rect x="15" y="34" width="150" height="65" rx="32"/>
        <rect x="24" y="43" width="132" height="47" rx="23"/>
        <path d="M33 75c-9-24 14-40 36-40" stroke-dasharray="3 5"/>
      </g>
      <path d="M54 46l23 6 9 16 17 8 32 5c8 1 12 8 10 13H47c-5-11-2-17 6-21z" fill="#fff" stroke="#303034" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M48 85h94v9H47z" fill="currentColor" opacity=".8"/>
      <path d="M79 64l12-5m-6 13 12-5m-40-3 12 4" stroke="#303034" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M30 49h16m-21 9h17m-21 9h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="142" cy="28" r="4" fill="currentColor"/>`,
  },
  maintain: {
    caption: '保持节奏，享受平衡',
    drawing: `<ellipse cx="90" cy="98" rx="58" ry="7" fill="currentColor" opacity=".08"/>
      <circle cx="90" cy="55" r="43" fill="none" stroke="currentColor" opacity=".18" stroke-width="2" stroke-dasharray="3 6"/>
      <path d="M90 74l-12 22h24z" fill="#303034"/>
      <path d="M37 73h106" stroke="#303034" stroke-width="5" stroke-linecap="round"/>
      <circle cx="60" cy="54" r="17" fill="currentColor"/>
      <circle cx="120" cy="54" r="17" fill="#fff" stroke="#303034" stroke-width="2.5"/>
      <path d="M114 54h12m-6-6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M55 54l4 4 7-8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
};

export function goalArt(goal: Goal): string {
  const illustration = illustrations[goal];
  return `<figure class="goal-art goal-art-${goal}"><svg viewBox="0 0 180 112" fill="none" aria-hidden="true" focusable="false">${illustration.drawing}</svg><figcaption>${illustration.caption}</figcaption></figure>`;
}
