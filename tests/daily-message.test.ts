import { describe, expect, it } from 'vitest';
import { dailyMessage, dailyMessageCount, refreshDailyMessage } from '../src/components/daily-message';

describe('daily message', () => {
  it('stays the same throughout one Shanghai day', () => {
    expect(dailyMessage(new Date('2026-09-25T16:00:00Z'))).toEqual(dailyMessage(new Date('2026-09-26T15:59:59Z')));
  });

  it('changes at Shanghai midnight', () => {
    const before = dailyMessage(new Date('2026-09-26T15:59:59Z'));
    const after = dailyMessage(new Date('2026-09-26T16:00:00Z'));
    expect(before.date).toBe('2026-09-26');
    expect(after.date).toBe('2026-09-27');
    expect(after.text).not.toBe(before.text);
  });

  it('has no repeated full messages across 1,024 days, including leap days', () => {
    const start = Date.parse('2027-01-01T00:00:00Z');
    const messages = Array.from({ length: dailyMessageCount }, (_, day) => dailyMessage(new Date(start + day * 86_400_000)).text);
    expect(dailyMessageCount).toBe(1024);
    expect(new Set(messages).size).toBe(dailyMessageCount);
  });

  it('updates only the message when a form remains open across midnight', () => {
    const element = { dataset: { date: '2026-09-26' }, textContent: '旧寄语' };
    const root = { querySelector: () => element } as unknown as ParentNode;
    const now = new Date('2026-09-26T16:00:00Z');
    refreshDailyMessage(root, now);
    expect(element.dataset.date).toBe('2026-09-27');
    expect(element.textContent).toBe(dailyMessage(now).text);
  });
});
