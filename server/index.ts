import { existsSync }from 'node:fs';
import { loadEnvFile }from 'node:process';
import { generateDeepSeekDraft } from './services/deepSeekGeneration.js';

import express from 'express';
import {generationInputSchema} from './validators/generationInput.js';
import { randomUUID } from 'node:crypto';
import { buildDemoDraft } from './services/demoGeneration.js';

const envPath = new URL('../.env', import.meta.url);

if (existsSync(envPath)) {
  loadEnvFile(envPath);
}
const app = express();
const PORT = 3001;

app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'study-notes-api',
  });
});

app.post('/api/generation-inputs/validate', (request, response) => {
  const body: unknown = request.body;
  const result = generationInputSchema.safeParse(body);

  if (!result.success) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: '生成输入校验失败',
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const input = result.data;

  response.json({
    requestId: input.requestId,
    status: 'validated',
    characterCount: Array.from(input.sourceText).length,
    message: '输入校验通过，可以进入后续生成流程',
  });
});

app.post('/api/demo/generations', (request, response) => {
  const body: unknown = request.body;
  const result = generationInputSchema.safeParse(body);

  if (!result.success) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: '生成输入校验失败',
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const input = result.data;
  const content = buildDemoDraft(input);

  response.json({
    id: randomUUID(),
    requestId: input.requestId,
    documentId: input.documentId,
    status: 'completed',
    mode: 'demo',
    content,
    message: '生成成功',
  });
});
let isModleGenerating = false;

app.post('/api/generations', async (request, response) => { 
  const body : unknown = request.body;
  const result = generationInputSchema.safeParse(body);

  if (!result.success) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: '生成输入校验失败',
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if(isModleGenerating) {
    response.status(409).json({
      code: 'GENERATION_ACTIVE',
      message: '已有生成任务正在执行，请稍后再试',
    });
    return;
  }
  isModleGenerating = true;

  const input = result.data;
  const controller = new AbortController();

  function handleClose() {
    if(!response.writableEnded){
      controller.abort();
    }
  }

  response.on('close', handleClose);

  try{
    const draft = await generateDeepSeekDraft(
      input, 
      controller.signal
    );

    if(controller.signal.aborted || response.destroyed) {
      return;
    }

    response.json({
      id: randomUUID(),
      requestId: input.requestId,
      documentId: input.documentId,
      status: 'completed',
      mode: 'ai',
      model:draft.model,
      content: draft.content,
      message: '生成成功',

    });
  }catch(error) {
    if(controller.signal.aborted || response.destroyed) {
      return;
    }
    const isTimeout =
      error instanceof DOMException && 
      error.name === 'TimeoutError';

    const message = isTimeout 
      ? '模型生成超时,请缩小范围后重试' 
      : error instanceof TypeError
        ? '暂时无法连接系统模型,请稍后重试'
        : error instanceof Error
          ? error.message
          : '生成失败,请稍后重试'

    response.status(isTimeout ? 504 : 502).json({
      code: isTimeout ? 'MODEL_TIMEOUT' : 'MODEL_UNAVAILABLE',
      requestId: input.requestId,
      message,
    });
  }finally{
    response.off('close', handleClose);
    isModleGenerating = false;
  }
});
app.listen(PORT, '127.0.0.1', () => {
  console.log(`后端已启动：http://127.0.0.1:${PORT}`);
});