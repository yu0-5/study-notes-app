import { z } from 'zod';
import type { StudyChatInput } from '../../shared/chat';
import { createSseParser } from '../../shared/sse';

const identity = z.object({ requestId: z.uuid(), documentId: z.string().min(1) });
const eventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('start'), data: identity }),
  z.object({ event: z.literal('delta'), data: identity.extend({ text: z.string() }) }),
  z.object({ event: z.literal('done'), data: identity.extend({ content: z.string().min(1), model: z.string().min(1) }) }),
  z.object({ event: z.literal('error'), data: identity.extend({ message: z.string() }) }),
]);

export async function streamStudyChat(
  input: StudyChatInput, signal: AbortSignal, onDelta: (text: string) => void,
): Promise<{ model: string; content: string }> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(130000)]);
  const response = await fetch('/api/chats/stream', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: requestSignal,
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    requestSignal.throwIfAborted();
    const error = z.object({ message: z.string() }).safeParse(body);
    throw new Error(error.success ? error.data.message : `问答请求失败，HTTP ${response.status}`);
  }
  if (!response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')) {
    await response.body?.cancel();
    throw new Error('问答服务未返回 SSE 数据流');
  }
  const reader = response.body.getReader();
  let started = false;
  let content = '';
  let completed: { model: string; content: string } | null = null;
  const parser = createSseParser((message) => {
    requestSignal.throwIfAborted();
    if (completed) throw new Error('问答完成后仍收到额外消息');
    const body: unknown = JSON.parse(message.data);
    const parsed = eventSchema.safeParse({ event: message.event, data: body });
    if (!parsed.success) throw new Error('问答流消息格式异常');
    const event = parsed.data;
    if (event.data.requestId !== input.requestId || event.data.documentId !== input.documentId) {
      throw new Error('问答流与当前请求不匹配');
    }
    if (event.event === 'start') {
      if (started) throw new Error('重复收到问答开始消息');
      started = true;
      return;
    }
    if (!started) throw new Error('缺少问答开始消息');
    if (event.event === 'error') throw new Error(event.data.message);
    if (event.event === 'delta') {
      content += event.data.text;
      if (Array.from(content).length > 20000) throw new Error('回答超过 20000 个字符');
      if (event.data.text) onDelta(event.data.text);
    } else {
      if (!content.trim() || event.data.content !== content) throw new Error('完整回答与流式正文不一致');
      completed = { content, model: event.data.model };
    }
  });
  try {
    while (true) {
      requestSignal.throwIfAborted();
      const { done, value } = await reader.read();
      requestSignal.throwIfAborted();
      if (done) break;
      parser.push(value);
    }
    parser.finish();
    requestSignal.throwIfAborted();
    if (!completed) throw new Error('连接已结束，但未收到完整回答');
    return completed;
  } finally {
    try { await reader.cancel(); } catch { /* 取消时连接可能已关闭 */ }
    reader.releaseLock();
  }
}
