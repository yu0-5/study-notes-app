import { env } from 'node:process';
import { z } from 'zod';
import type { GenerationInput } from '../validators/generationInput.js';
import { buildGenerationPrompt } from './generationPrompt.js';

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

export async function generateDeepSeekDraft(
    input: GenerationInput,
    signal: AbortSignal,
):Promise<{ content:string; model:string}> {
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
                stream: false,
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

