import { z } from "zod";
import type { GenerationInputSnapshot } from "../types/generation";
import { createSseParser } from '../../shared/sse';

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

//校验输入
const streamIdentitySchema = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  documentId: z.string().min(1),
  mode: z.literal('ai'),
});

const streamEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('start'),
    data: streamIdentitySchema,
  }),

  z.object({
    event: z.literal('delta'),
    data: streamIdentitySchema.extend({
      text: z.string(),
    }),
  }),

  z.object({
    event: z.literal('done'),
    data: generatedDraftSchema,
  }),

  z.object({
    event: z.literal('error'),
    data: streamIdentitySchema.extend({
      code: z.string(),
      message: z.string(),
    }),
  }),
]);

//增加前端流失请求函数
export async function generateDraftStream(
  input: GenerationInputSnapshot,
  signal: AbortSignal,
  onDelta: (text: string) => void,
): Promise<GeneratedDraft> {
  const requestSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(130000),
  ]);

  const response = await fetch('/api/generations/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: requestSignal,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => {
      requestSignal.throwIfAborted();
      return null;
    });

    const error = errorResponseSchema.safeParse(body);

    throw new Error(
      error.success
        ? error.data.issues?.[0]?.message ?? error.data.message
        : `流式生成失败，HTTP ${response.status}`,
    );
  }

  const contentType =
    response.headers.get('content-type') ?? '';

  if (
    !response.body ||
    !contentType.toLowerCase().startsWith('text/event-stream')
  ) {
    await response.body?.cancel();

    throw new Error('服务没有返回预期的 SSE 数据流');
  }

  const reader = response.body.getReader();

  let candidateId: string | null = null;
  let assembledContent = '';
  let completedDraft: GeneratedDraft | null = null;

  const parser = createSseParser((message) => {
    requestSignal.throwIfAborted();

    if (completedDraft !== null) {
      throw new Error('候选完成后仍收到额外消息');
    }

    let body: unknown;

    try {
      body = JSON.parse(message.data);
    } catch {
      throw new Error('流消息中包含无效 JSON');
    }

    const result = streamEventSchema.safeParse({
      event: message.event,
      data: body,
    });

    if (!result.success) {
      throw new Error('流消息格式异常');
    }

    const event = result.data;

    if (
      event.data.mode !== 'ai' ||
      event.data.requestId !== input.requestId ||
      event.data.documentId !== input.documentId
    ) {
      throw new Error('流消息与本次请求不匹配');
    }

    if (event.event === 'start') {
      if (candidateId !== null) {
        throw new Error('重复收到生成开始消息');
      }

      candidateId = event.data.id;
      return;
    }

    if (
      candidateId === null ||
      event.data.id !== candidateId
    ) {
      throw new Error('流消息的候选标识不匹配');
    }

    switch (event.event) {
      case 'delta': {
        assembledContent += event.data.text;

        if (Array.from(assembledContent).length > 20000) {
          throw new Error('候选正文超过 20000 个字符');
        }

        if (event.data.text !== '') {
          onDelta(event.data.text);
        }

        break;
      }

      case 'done': {
        if (event.data.content !== assembledContent) {
          throw new Error('完整候选与流式正文不一致');
        }

        completedDraft = event.data;
        break;
      }

      case 'error': {
        throw new Error(event.data.message);
      }
    }
  });

  try {
    while (true) {
      requestSignal.throwIfAborted();

      const { done, value } = await reader.read();

      requestSignal.throwIfAborted();

      if (done) {
        break;
      }

      parser.push(value);
    }

    parser.finish();
    requestSignal.throwIfAborted();

    if (completedDraft === null) {
      throw new Error('连接已结束，但未收到完整候选');
    }

    return completedDraft;
  } catch (error) {
    requestSignal.throwIfAborted();
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