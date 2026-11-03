import express from 'express';
import {generationInputSchema} from './validators/generationInput.js';
import { randomUUID } from 'node:crypto';
import { buildDemoDraft } from './services/demoGeneration.js';

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
app.listen(PORT, '127.0.0.1', () => {
  console.log(`后端已启动：http://127.0.0.1:${PORT}`);
});