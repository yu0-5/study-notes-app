import { z } from 'zod';
import type { GenerationInput } from '../validators/generationInput.js';
import { buildGenerationPrompt } from './generationPrompt.js';
import { requestDeepSeekCompletion, streamDeepSeekCompletion, type ModelMessage } from './deepSeekClient.js';

const completionSchema = z.object({
  model: z.string(),
  choices: z.array(z.object({
    finish_reason: z.string(),
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
});

function messages(input: GenerationInput): ModelMessage[] {
  const prompt = buildGenerationPrompt(input);
  return [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }];
}

export async function generateDeepSeekDraft(
  input: GenerationInput, signal: AbortSignal,
): Promise<{ content: string; model: string }> {
  const response = await requestDeepSeekCompletion(messages(input), signal, false);
  const body: unknown = await response.json();
  const result = completionSchema.safeParse(body);
  if (!result.success) throw new Error('DeepSeek 返回的数据结构异常');
  const choice = result.data.choices[0];
  if (choice.finish_reason === 'length') throw new Error('模型输出达到长度上限，正文可能不完整，请缩小生成范围');
  if (choice.finish_reason !== 'stop') throw new Error('模型未正常完成生成，请重试');
  const content = choice.message.content;
  if (!content || content.trim() === '') throw new Error('模型未返回有效正文');
  if (Array.from(content).length > 20000) throw new Error('候选正文超过 20000 个字符，请缩小范围');
  return { content, model: result.data.model };
}

export function generateDeepSeekDraftStream(input: GenerationInput, signal: AbortSignal) {
  return streamDeepSeekCompletion(messages(input), signal);
}
