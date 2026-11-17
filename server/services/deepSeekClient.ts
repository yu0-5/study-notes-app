import { env } from 'node:process';
import { z } from 'zod';
import { createDeepSeekStreamParser } from './deepSeekStreamParser.js';

export type ModelMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type DeepSeekStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; model: string; content: string };

const modelConfigSchema = z.object({
  MODEL_API_KEY: z.string().trim().min(1),
  MODEL_BASE_URL: z.literal('https://api.deepseek.com'),
  MODEL_NAME: z.enum(['deepseek-flash', 'deepseek-v4-pro']),
});

export async function requestDeepSeekCompletion(
  messages: ModelMessage[], signal: AbortSignal, stream: boolean,
): Promise<Response> {
  const result = modelConfigSchema.safeParse({
    MODEL_API_KEY: env.MODEL_API_KEY,
    MODEL_BASE_URL: env.MODEL_BASE_URL,
    MODEL_NAME: env.MODEL_NAME,
  });
  if (!result.success) throw new Error('模型配置缺失或无效，请检查本地.env');
  const config = result.data;
  const response = await fetch(`${config.MODEL_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.MODEL_API_KEY}` },
    body: JSON.stringify({ model: config.MODEL_NAME, messages,
      thinking: { type: 'disabled' }, stream, max_tokens: 3000 }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) throw new Error('模型API密钥无效或已过期');
    if (response.status === 402) throw new Error('DeepSeek 账户余额不足');
    if (response.status === 429) throw new Error('DeepSeek 请求受到限制，请稍后重试');
    throw new Error(`DeepSeek 请求失败，HTTP ${response.status}`);
  }
  return response;
}

export async function* streamDeepSeekCompletion(
  messages: ModelMessage[], signal: AbortSignal,
): AsyncGenerator<DeepSeekStreamEvent, void, unknown> {
  const streamSignal = AbortSignal.any([signal, AbortSignal.timeout(120000)]);
  const response = await requestDeepSeekCompletion(messages, streamSignal, true);
  if (!response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')) {
    await response.body?.cancel();
    throw new Error('模型没有返回预期的 SSE 数据流');
  }
  const reader = response.body.getReader();
  const deltas: string[] = [];
  const parser = createDeepSeekStreamParser((text) => deltas.push(text));
  try {
    while (true) {
      streamSignal.throwIfAborted();
      const { done, value } = await reader.read();
      streamSignal.throwIfAborted();
      if (done) break;
      parser.push(value);
      for (const text of deltas) {
        streamSignal.throwIfAborted();
        yield { type: 'delta', text };
      }
      deltas.length = 0;
    }
    const result = parser.finish();
    streamSignal.throwIfAborted();
    yield { type: 'done', ...result };
  } finally {
    try { await reader.cancel(); } catch { /* 取消时连接可能已关闭 */ }
    reader.releaseLock();
  }
}
