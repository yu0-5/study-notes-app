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

const demoDraftSchema = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  documentId: z.string().min(1),
  status: z.literal('completed'),
  mode: z.literal('demo'),
  content: z.string().refine(
    (content) => content.trim() !== '',
    { message: '候选正文不能为空' },
  ),
});

export type DemoDraft = z.infer<typeof demoDraftSchema>;

export async function generateDemoDraft(
  input: GenerationInputSnapshot,
  signal: AbortSignal,
): Promise<DemoDraft> {
  const response = await fetch('/api/demo/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(15000),
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

  const result = demoDraftSchema.safeParse(body);

  if (!result.success) {
    throw new Error('候选数据格式异常');
  }

  if (
    result.data.requestId !== input.requestId ||
    result.data.documentId !== input.documentId
  ) {
    throw new Error('候选结果与本次输入不匹配');
  }

  return result.data;
}