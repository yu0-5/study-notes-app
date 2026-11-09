import { z } from "zod";
import type { GenerationInputSnapshot } from "../types/generation";

const validationResponseSchema = z.object({
  requestId: z.string(),
  status: z.literal('validated'),
  characterCount: z.number().int().nonnegative(),
  message: z.string(),
});

const errorResponseSchema = z.object({
  message: z.string(),
  issues:z.array(z.object({
    field: z.string(),
    message: z.string(),
  })).optional(),
  
});

export async function validateGenerationInput(
  input: GenerationInputSnapshot,
){
    const response = await fetch('/api/generation-inputs/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
       
        body: JSON.stringify(input),
        signal:AbortSignal.timeout(15000),
    });
    const body:unknown = await response.json();

    if (!response.ok) {
      const error = errorResponseSchema.safeParse(body);

      const message = error.success
        ? error.data.issues?.[0]?.message ?? error.data.message        
        : `输入校验失败, HTTP ${response.status}`;

      throw new Error(message);
  }

  const result = validationResponseSchema.safeParse(body);

  if (!result.success) {
    throw new Error('服务器返回的数据格式异常');
  }

  if(
    result.data.requestId !== input.requestId ||
    result.data.characterCount !== input.characterCount
  ){
    throw new Error('服务器返回的结构与本次输入不匹配');
  }

  return result.data;
}  

const draftBaseSchema = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  documentId: z.string().min(1),
  status: z.literal('completed'),
  content: z.string().refine(
    (content) => content.trim() !== '',
    { message: '候选正文不能为空' },
  ),
});

const generatedDraftSchema = z.discriminatedUnion('mode', [
  draftBaseSchema.extend({
    mode: z.literal('demo'),
  }),
  draftBaseSchema.extend({
    mode: z.literal('ai'),
    model: z.string().min(1),
  }),
]);

export type GenerationMode = 'demo' | 'ai';

export type GeneratedDraft =
  z.infer<typeof generatedDraftSchema>;

export async function generateDraft(
  input: GenerationInputSnapshot,
  mode: GenerationMode,
  signal: AbortSignal,
): Promise<GeneratedDraft> {
  const path = mode === 'ai'
    ? '/api/generations'
    : '/api/demo/generations';

  const timeout = mode === 'ai' ? 130000 : 15000;

  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(timeout),
    ]),
  });

  const responseText = await response.text();
  let body: unknown;

  try {
    body = JSON.parse(responseText);
  } catch {
    throw new Error(
      `服务返回了非 JSON 数据，HTTP ${response.status}，请检查接口与代理`,
    );
  }

  if (!response.ok) {
    const error = errorResponseSchema.safeParse(body);

    throw new Error(
      error.success
        ? error.data.issues?.[0]?.message ?? error.data.message
        : `生成失败，HTTP ${response.status}`,
    );
  }

  const result = generatedDraftSchema.safeParse(body);

  if (!result.success) {
    throw new Error('候选数据格式异常');
  }

  if (
    result.data.requestId !== input.requestId ||
    result.data.documentId !== input.documentId ||
    result.data.mode !== mode
  ) {
    throw new Error('候选结果与本次请求不匹配');
  }

  return result.data;
}
