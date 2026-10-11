import { dateKey } from '../utils/date';

// Original short phrases: 32 × 32 unique messages, one full cycle lasts 1,024 days.
const beginnings = [
  '慢一点也没关系', '今天也为自己留点时间', '每次开始都值得肯定', '把注意力放回自己',
  '不必追赶别人的节奏', '小小的进步也算数', '给身体一点耐心', '认真吃好这一餐',
  '让运动成为日常', '今天的努力不必盛大', '照顾自己也是一种能力', '从一个小目标开始',
  '允许状态有起伏', '记下今天真实的自己', '在忙碌中停一停', '找到适合自己的步调',
  '享受身体移动的感觉', '把目标拆成小步', '对自己温柔一点', '累了就好好休息',
  '把好习惯留给明天', '生活不只是一组数字', '每一天都可以重新开始', '把今天过得踏实一点',
  '学会听见身体的声音', '给努力留一点余地', '无需每次都做到最好', '平凡的一天也值得记录',
  '让坚持多一点轻松', '为自己的改变感到开心', '把健康放进生活里', '今天也值得好好对待',
] as const;
const endings = [
  '按自己的节奏前进', '长期的积累自有分量', '休息同样值得认真', '让每一步都走得稳一些',
  '不必用数字定义自己', '给变化留出时间', '记得肯定已经做到的事', '保持一点好奇和耐心',
  '让习惯慢慢生根', '好好吃饭也好好生活', '认真感受身体的反馈', '留点精力给喜欢的事',
  '不和昨天的疲惫较劲', '把过程也放在心上', '让目标服务于生活', '一点点靠近想要的状态',
  '不必急着看见结果', '为明天留一份从容', '把能做的事情先做好', '让每次记录都有意义',
  '在自己的路上走下去', '也记得享受当下', '用耐心陪伴每一次改变', '为坚持留一个舒服的空间',
  '今天的用心不会白费', '让心情和身体一起被照顾', '给自己一个真诚的鼓励', '把每一次尝试当成经验',
  '用适合自己的方式继续', '平衡比苛求更长久', '留意那些细小的进步', '让日常成为力量的来源',
] as const;

export const dailyMessageCount = beginnings.length * endings.length;

export function dailyMessage(now = new Date()): { date: string; text: string } {
  const date = dateKey(now);
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  // 37 is coprime to 1,024: both halves vary daily without repeats within a cycle.
  const index = ((day * 37) % dailyMessageCount + dailyMessageCount) % dailyMessageCount;
  return { date, text: `${beginnings[Math.floor(index / endings.length)]}，${endings[index % endings.length]}。` };
}

export function dailyMessageMarkup(): string {
  const message = dailyMessage();
  return `<aside class="daily-message" aria-label="每日寄语"><span class="daily-message-label">每日寄语</span><p data-daily-message data-date="${message.date}">${message.text}</p></aside>`;
}

export function refreshDailyMessage(root: ParentNode, now = new Date()): void {
  const element = root.querySelector<HTMLElement>('[data-daily-message]');
  if (!element) return;
  const message = dailyMessage(now);
  if (element.dataset.date === message.date) return;
  element.textContent = message.text;
  element.dataset.date = message.date;
}
