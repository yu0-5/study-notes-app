// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { streamStudyChat } from './studyChatApi';
import type { StudyChatInput } from '../../shared/chat';

const input: StudyChatInput = { requestId: '550e8400-e29b-41d4-a716-446655440000',
  documentId: 'a', documentTitle: '资料', sourceText: '原文', question: '问题', history: [] };
const identity = { requestId: input.requestId, documentId: input.documentId };
const frame = (event: string, data: object = {}) =>
  `event: ${event}\ndata: ${JSON.stringify({ ...identity, ...data })}\n\n`;
const start = frame('start');
const delta = frame('delta', { text: '你好😀' });
const done = frame('done', { content: '你好😀', model: 'test-model' });
afterEach(() => { vi.unstubAllGlobals(); });

function mockStream(source: string) {
  const bytes = new TextEncoder().encode(source);
  const response = new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
  vi.stubGlobal('fetch', vi.fn(async () => response));
}
it('真实请求协议可逐字节解析中文和 emoji，回传完整回答与模型', async () => {
  mockStream(start + delta + done);
  const chunks: string[] = [];
  expect(await streamStudyChat(input, new AbortController().signal, (s) => chunks.push(s)))
    .toEqual({ content: '你好😀', model: 'test-model' });
  expect(chunks.join('')).toBe('你好😀');
  const options = vi.mocked(fetch).mock.calls[0][1]!;
  expect(JSON.parse(options.body as string)).toEqual(input);
  expect(options.headers).not.toHaveProperty('Authorization');
});
it.each([
  [start + delta, '未收到完整回答'],
  [delta + done, '缺少问答开始消息'],
  [start + start, '重复收到问答开始消息'],
  [start + frame('delta', { documentId: 'b', text: '错误来源' }), '不匹配'],
  [start + delta + frame('done', { model: 'm', content: '不同的正文' }), '不一致'],
  [start + frame('error', { message: '余额不足' }), '余额不足'],
  [start + delta + done + delta, '额外消息'],
  ['event: delta\ndata: invalid-json\n\n', 'JSON'],
])('拒绝不完整或异常协议：%s', async (source, message) => {
  mockStream(source);
  await expect(streamStudyChat(input, new AbortController().signal, () => {})).rejects.toThrow(message);
});
it('HTTP 错误保留后端给用户的提示', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: '已有模型任务' }, { status: 409 })));
  await expect(streamStudyChat(input, new AbortController().signal, () => {})).rejects.toThrow('已有模型任务');
});
it('主动停止取消 reader，保留已经交付的片段而不报完成', async () => {
  const controller = new AbortController();
  let cancelled = false;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
    start(stream) { stream.enqueue(new TextEncoder().encode(start + delta)); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/event-stream' } })));
  let received = '';
  await expect(streamStudyChat(input, controller.signal, (text) => {
    received += text;
    controller.abort();
  })).rejects.toMatchObject({ name: 'AbortError' });
  expect(received).toBe('你好😀');
  expect(cancelled).toBe(true);
});
