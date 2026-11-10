import { env } from 'node:process';
import { z } from 'zod';
import type { GenerationInput } from '../validators/generationInput.js';
import { buildGenerationPrompt } from './generationPrompt.js';
import {
  createDeepSeekStreamParser,
} from './deepSeekStreamParser.js';

const modelConfigSchema = z.object({
  MODEL_API_KEY: z.string().trim().min(1),
  MODEL_BASE_URL: z.literal('https://api.deepseek.com'),
  MODEL_NAME: z.enum(['deepseek-flash', 'deepseek-v4-pro']),
});

const completionSchema = z.object({
  model: z.string(),
  choices: z.array(z.object({
    finish_reason: z.string(),
    message: z.object({
      content: z.string().nullable(),
    }),
  })).min(1),
});

async function requestDeepSeek(
  input: GenerationInput,
  signal: AbortSignal,
  stream: boolean,
): Promise<Response>  {
    const configResult = modelConfigSchema.safeParse({
        MODEL_API_KEY: env.MODEL_API_KEY,
        MODEL_BASE_URL: env.MODEL_BASE_URL,
        MODEL_NAME: env.MODEL_NAME,
    });

    if(!configResult.success){
        throw new Error('模型配置缺失或无效，请检查本地.env');
    }

    const config = configResult.data;
    const prompt = buildGenerationPrompt(input);

    const response = await fetch(
        `${config.MODEL_BASE_URL}/chat/completions`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.MODEL_API_KEY}`,
            },
            body: JSON.stringify({
                model: config.MODEL_NAME,
                messages: [
                    { role: 'system', content:prompt.system  },
                    { role: 'user', content: prompt.user},
                ],
                thinking:{ type: 'disabled' },
                stream,
                max_tokens: 3000,
            }),
            signal: AbortSignal.any([
                signal,
                AbortSignal.timeout(120000),
            ]),        
          },
    );
    if(!response.ok) {
      await response.body?.cancel();

      if(response.status === 401 ||response.status === 403) {
        throw new Error('模型API密钥无效或已过期');
      }
      if (response.status === 402) {
      throw new Error('DeepSeek 账户余额不足');
    }

    if (response.status === 429) {
      throw new Error('DeepSeek 请求受到限制，请稍后重试');
    }

    throw new Error(`DeepSeek 请求失败，HTTP ${response.status}`);
  }
    return response;
  }

  export async function generateDeepSeekDraft(
    input: GenerationInput,
    signal: AbortSignal,
  ): Promise<{ content: string; model: string }> {
    const response = await requestDeepSeek(
      input,
      signal,
      false,
    );
  const body: unknown = await response.json();
  const result = completionSchema.safeParse(body);

  if (!result.success) {
    throw new Error('DeepSeek 返回的数据结构异常');
  }

  const choice = result.data.choices[0];

  if (choice.finish_reason === 'length') {
    throw new Error('模型输出达到长度上限，正文可能不完整，请缩小生成范围');
  }

  if (choice.finish_reason !== 'stop') {
    throw new Error('模型未正常完成生成，请重试');
  }

  const content = choice.message.content;

  if (!content || content.trim() === '') {
    throw new Error('模型未返回有效正文');
  }

  if (Array.from(content).length > 20000) {
    throw new Error('候选正文超过 20000 个字符，请缩小范围');
  }

  return {
    content,
    model: result.data.model,
  };
}

type DeepSeekStreamEvent =
  | {
      type: 'delta';
      text: string;
    }
  | {
      type: 'done';
      model: string;
      content: string;
    };

export async function* generateDeepSeekDraftStream(
  input: GenerationInput,
  signal: AbortSignal,
): AsyncGenerator<DeepSeekStreamEvent, void, unknown> {
  const streamSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(120000),
  ]);

  const response = await requestDeepSeek(
    input,
    streamSignal,
    true,
  );

  const contentType =
    response.headers.get('content-type') ?? '';

  if (
    !response.body ||
    !contentType.toLowerCase().startsWith('text/event-stream')
  ) {
    await response.body?.cancel();

    throw new Error('模型没有返回预期的 SSE 数据流');
  }

  const reader = response.body.getReader();
  const pendingDeltas: string[] = [];

  const parser = createDeepSeekStreamParser((text) => {
    pendingDeltas.push(text);
  });

  try {
    while (true) {
      streamSignal.throwIfAborted();

      const { done, value } = await reader.read();

      streamSignal.throwIfAborted();

      if (done) {
        break;
      }

      parser.push(value);

      for (const text of pendingDeltas) {
        streamSignal.throwIfAborted();

        yield {
          type: 'delta',
          text,
        };
      }

      pendingDeltas.length = 0;
    }

    const result = parser.finish();

    streamSignal.throwIfAborted();

    yield {
      type: 'done',
      model: result.model,
      content: result.content,
    };
  } catch (error) {
    streamSignal.throwIfAborted();
    throw error;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // 请求取消或连接异常时，流可能已经关闭
    }

    reader.releaseLock();
  }
}