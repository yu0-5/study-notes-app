import { z } from 'zod';
import { createSseParser } from '../../shared/sse.js';

const streamChunkSchema = z.object({
  model: z.string().min(1),
  choices: z.array(
    z.object({
      index: z.literal(0),
      delta: z.object({
        content: z.string().nullish(),
      }),
      finish_reason: z.string().nullable(),
    }),
  ).length(1),
});

export function createDeepSeekStreamParser(
  onDelta: (text: string) => void,
) {
  let model = '';
  let content = '';
  let stopReceived = false;
  let doneReceived = false;

  const parser = createSseParser((message) => {
    if (doneReceived) {
      throw new Error('模型结束后仍返回了额外消息');
    }

    if (message.data === '[DONE]') {
      doneReceived = true;
      return;
    }

    let body: unknown;

    try {
      body = JSON.parse(message.data);
    } catch {
      throw new Error('模型流中包含无效 JSON');
    }

    const result = streamChunkSchema.safeParse(body);

    if (!result.success) {
      throw new Error('模型流消息格式异常');
    }

    const chunk = result.data;

    if (model !== '' && model !== chunk.model) {
      throw new Error('模型流中的模型信息不一致');
    }

    model = chunk.model;

    if (stopReceived) {
      throw new Error('模型完成后仍返回了额外数据');
    }

    const choice = chunk.choices[0];
    const delta = choice.delta.content ?? '';

    if (delta !== '') {
      content += delta;

      if (Array.from(content).length > 20000) {
        throw new Error('候选正文超过 20000 个字符');
      }

      onDelta(delta);
    }

    if (choice.finish_reason === 'length') {
      throw new Error('模型输出达到长度上限，正文可能不完整');
    }

    if (
      choice.finish_reason !== null &&
      choice.finish_reason !== 'stop'
    ) {
      throw new Error('模型未正常完成生成');
    }

    if (choice.finish_reason === 'stop') {
      stopReceived = true;
    }
  });

  return {
    push(chunk: Uint8Array) {
      parser.push(chunk);
    },

    finish() {
      parser.finish();

      if (!doneReceived || !stopReceived) {
        throw new Error('模型流未完整结束，请重试');
      }

      if (content.trim() === '') {
        throw new Error('模型未返回有效正文');
      }

      return {
        model,
        content,
      };
    },
  };
}