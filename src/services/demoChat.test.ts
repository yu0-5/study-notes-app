import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { streamDemoChat } from './demoChat';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('真实模拟服务逐段输出完整中文与 emoji，并明确声明没有调用模型', async () => {
  const chunks: string[] = [];
  const promise = streamDemoChat({
    documentTitle: '网络学习', question: '如何理解缓存😀？',
    signal: new AbortController().signal,
    onDelta: (text) => chunks.push(text),
  });
  expect(chunks).toHaveLength(0);
  await vi.runAllTimersAsync();
  await promise;
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.join('')).toContain('如何理解缓存😀？');
  expect(chunks.join('')).toContain('没有调用大模型');
  expect(chunks.join('')).not.toContain('\uFFFD');
  expect(vi.getTimerCount()).toBe(0);
});

it('停止后释放等待计时器，不再输出后续片段', async () => {
  const controller = new AbortController();
  const onDelta = vi.fn();
  const promise = streamDemoChat({
    documentTitle: '资料', question: '问题', signal: controller.signal, onDelta,
  });
  const rejection = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(100);
  expect(onDelta).toHaveBeenCalledTimes(1);
  controller.abort();
  await rejection;
  await vi.runAllTimersAsync();
  expect(onDelta).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
