import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useStudyChat } from './useStudyChat';
import { streamStudyChat } from '../services/studyChatApi';
import type { StudyDocument } from '../types/document';

vi.mock('../services/studyChatApi', () => ({ streamStudyChat: vi.fn() }));
type Input = Parameters<typeof streamStudyChat>[0];
type Pending = { input: Input; signal: AbortSignal; delta: (text: string) => void;
  resolve: (value: { model: string; content: string }) => void; reject: (error: Error) => void };
let calls: Pending[];
const doc: StudyDocument = { id: 'a', title: '资料 A', content: '甲\r\n乙', projectId: 'project-default', format: 'text' };
function renderChat() {
  const hook = renderHook(({ document }: { document: StudyDocument }) => useStudyChat(document, false),
    { initialProps: { document: doc } });
  act(() => hook.result.current.changeMode('ai'));
  return hook;
}
function send(hook: ReturnType<typeof renderChat>, question = '问题') {
  act(() => hook.result.current.changeDraft(question));
  act(() => { void hook.result.current.send(); });
}
beforeEach(() => {
  calls = [];
  vi.mocked(streamStudyChat).mockReset().mockImplementation((input, signal, delta) =>
    new Promise((resolve, reject) => { calls.push({ input, signal, delta, resolve, reject }); }));
});
afterEach(cleanup);

it('真实发送包含原文快照，后续问题携带已完成的一轮真实上下文', async () => {
  const hook = renderChat();
  send(hook, '第一问');
  expect(calls[0].input.sourceText).toBe('甲\n乙');
  expect(calls[0].input.history).toEqual([]);
  await act(async () => { calls[0].delta('第一答'); calls[0].resolve({ model: 'm', content: '第一答' }); });
  expect(hook.result.current.messages[1].model).toBe('m');
  send(hook, '继续解释');
  expect(calls[1].input.history).toEqual([{ question: '第一问', answer: '第一答' }]);
});
it('停止保留片段，重试用原文和原问题、新请求 ID，且不清空下一问', async () => {
  const hook = renderChat(); send(hook);
  const original = calls[0].input;
  const answerId = hook.result.current.messages[1].id;
  act(() => calls[0].delta('片段'));
  act(() => hook.result.current.changeDraft('下一问'));
  await act(async () => { hook.result.current.stop(); calls[0].reject(new DOMException('停止', 'AbortError')); });
  expect(hook.result.current.messages[1].content).toBe('片段');
  hook.rerender({ document: { ...doc, content: '资料后来发生变化' } });
  act(() => hook.result.current.changeMode('demo'));
  act(() => { void hook.result.current.retryLastReply(); });
  expect(hook.result.current.mode).toBe('ai');
  expect(calls[1].input).toEqual({ ...original, requestId: calls[1].input.requestId });
  expect(calls[1].input.requestId).not.toBe(original.requestId);
  expect(hook.result.current.messages).toHaveLength(2);
  expect(hook.result.current.messages[1].id).toBe(answerId);
  expect(hook.result.current.draft).toBe('下一问');
});
it('切换资料后旧回答不串入新资料，删除来源任务允许立即启动新任务', async () => {
  const hook = renderChat(); send(hook);
  hook.rerender({ document: { ...doc, id: 'b', title: '资料 B' } });
  expect(hook.result.current.messages).toEqual([]);
  act(() => hook.result.current.clearDocument('a'));
  expect(calls[0].signal.aborted).toBe(true);
  send(hook, 'B 的问题');
  await act(async () => { calls[0].delta('迟到'); calls[0].resolve({ model: 'm', content: '迟到' }); });
  expect(hook.result.current.isReplying).toBe(true);
  expect(hook.result.current.messages[1].content).toBe('');
  expect(calls[1].input.documentId).toBe('b');
  expect(calls[1].input.history).toEqual([]);
});
it('超长原文真实发送被拦截，不静默截断', () => {
  const hook = renderChat();
  hook.rerender({ document: { ...doc, content: '字'.repeat(12001) } });
  expect(hook.result.current.sourceError).toContain('12000');
  send(hook);
  expect(calls).toHaveLength(0);
  expect(hook.result.current.messages).toEqual([]);
});
it('生成期间不能切换模式，网络失败后保留草稿并可重试', async () => {
  const hook = renderChat(); send(hook);
  act(() => hook.result.current.changeMode('demo'));
  expect(hook.result.current.mode).toBe('ai');
  act(() => hook.result.current.changeDraft('下一问'));
  await act(async () => { calls[0].reject(new TypeError('网络失败')); });
  expect(hook.result.current.messages[1].status).toBe('error');
  expect(hook.result.current.draft).toBe('下一问');
  act(() => { void hook.result.current.retryLastReply(); });
  expect(calls).toHaveLength(2);
});
