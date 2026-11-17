import { expect, it } from 'vitest';
import { buildChatHistory, createChatInput } from './studyChatInput';
import type { ChatMessage } from '../types/chat';

function turn(index: number, answer = `回答${index}`): ChatMessage[] {
  return [
    { id: `u${index}`, role: 'user', content: `问题${index}`, mode: 'ai', status: 'completed' },
    { id: `a${index}`, role: 'assistant', content: answer, mode: 'ai', status: 'completed' },
  ];
}
it('仅带最近四轮，按时间顺序保持完整问答对', () => {
  expect(buildChatHistory([1, 2, 3, 4, 5].flatMap((i) => turn(i))))
    .toEqual([2, 3, 4, 5].map((i) => ({ question: `问题${i}`, answer: `回答${i}` })));
});
it.each(['streaming', 'stopped', 'error'] as const)('排除 %s 片段和模拟消息', (status) => {
  const partial = turn(2); partial[1].status = status;
  const simulated = turn(3).map((m) => ({ ...m, mode: 'demo' as const }));
  expect(buildChatHistory([...turn(1), ...partial, ...simulated]))
    .toEqual([{ question: '问题1', answer: '回答1' }]);
});
it('历史超限时丢弃最早的整轮，过大的最新回答不绕过预算', () => {
  expect(buildChatHistory([...turn(1, '字'.repeat(7000)), ...turn(2, '字'.repeat(7000))]))
    .toHaveLength(1);
  expect(buildChatHistory([...turn(1), ...turn(2, '字'.repeat(12000))])).toEqual([]);
});
it('输入固定原文并统一换行，请求 ID 每次不同，不修改资料或消息', () => {
  const doc = { id: 'a', title: '资料', projectId: 'project-default', content: '甲\r\n乙\r丙', format: 'text' as const };
  const first = createChatInput(doc, '问题', turn(1));
  expect(first.sourceText).toBe('甲\n乙\n丙');
  expect(first.requestId).not.toBe(createChatInput(doc, '问题', []).requestId);
  expect(doc.content).toBe('甲\r\n乙\r丙');
});
