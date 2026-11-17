// @vitest-environment node
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, it, vi } from 'vitest';
import { createStudyChatRouter } from './studyChat.js';
import type { streamStudyChat } from '../services/studyChat.js';

const input = { requestId: '550e8400-e29b-41d4-a716-446655440000', documentId: 'a',
  documentTitle: '资料', sourceText: '原文', question: '问题', history: [] };

async function withServer(stream: typeof streamStudyChat, test: (url: string, locked: () => boolean) => Promise<void>) {
  let locked = false;
  const app = express();
  app.use(express.json());
  app.use(createStudyChatRouter({ stream, acquire: () => {
    if (locked) return null;
    locked = true;
    return () => { locked = false; };
  } }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await test(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/chats/stream`, () => locked);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
const post = (url: string, body: unknown = input, signal?: AbortSignal) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
});

it('真实 HTTP 路由校验后转发 start/delta/done，并释放任务锁', async () => {
  await withServer(async function* (received) {
    expect(received).toEqual(input);
    yield { type: 'delta', text: '回答' };
    yield { type: 'done', content: '回答', model: 'test-model' };
  }, async (url, locked) => {
    expect((await post(url, {})).status).toBe(400);
    expect(locked()).toBe(false);
    const response = await post(url);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const text = await response.text();
    expect(text).toContain('event: start'); expect(text).toContain('event: done');
    expect(text).toContain(input.requestId); expect(text).toContain('回答');
    expect(locked()).toBe(false);
  });
});

it('并发被拒绝，客户端停止会取消上游并解锁', async () => {
  let aborted = false;
  await withServer(async function* (_input, signal) {
    yield { type: 'delta', text: '片段' };
    await new Promise<void>((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    });
  }, async (url, locked) => {
    const controller = new AbortController();
    const response = await post(url, input, controller.signal);
    expect(locked()).toBe(true);
    expect((await post(url)).status).toBe(409);
    controller.abort();
    await response.body?.cancel().catch(() => {});
    await vi.waitFor(() => { expect(aborted).toBe(true); expect(locked()).toBe(false); });
  });
});

it('上游部分输出后失败，发送 error，不发送 done，仍会释放锁', async () => {
  await withServer(async function* () {
    yield { type: 'delta', text: '未完成片段' };
    throw new Error('模拟上游失败');
  }, async (url, locked) => {
    const text = await (await post(url)).text();
    expect(text).toContain('event: error'); expect(text).toContain('模拟上游失败');
    expect(text).not.toContain('event: done'); expect(locked()).toBe(false);
  });
});
