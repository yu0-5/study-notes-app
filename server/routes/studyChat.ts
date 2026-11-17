import { Router } from 'express';
import { once } from 'node:events';
import { chatInputSchema } from '../validators/chatInput.js';
import { streamStudyChat } from '../services/studyChat.js';

type ChatDependencies = {
  stream: typeof streamStudyChat;
  acquire: () => (() => void) | null;
};

export function createStudyChatRouter({ stream, acquire }: ChatDependencies) {
  const router = Router();
  router.post('/api/chats/stream', async (request, response) => {
    const validated = chatInputSchema.safeParse(request.body as unknown);
    if (!validated.success) {
      response.status(400).json({ code: 'VALIDATION_ERROR',
        message: validated.error.issues[0]?.message ?? '问答输入校验失败' });
      return;
    }
    const release = acquire();
    if (!release) {
      response.status(409).json({ code: 'GENERATION_ACTIVE', message: '已有模型任务正在执行，请停止或稍后重试' });
      return;
    }
    const input = validated.data;
    const identity = { requestId: input.requestId, documentId: input.documentId };
    const controller = new AbortController();
    const handleClose = () => { if (!response.writableEnded) controller.abort(); };
    response.on('close', handleClose);
    async function send(event: string, data: object) {
      controller.signal.throwIfAborted();
      if (response.destroyed || response.writableEnded) throw new DOMException('连接已关闭', 'AbortError');
      if (!response.write(`event: ${event}\ndata: ${JSON.stringify({ ...identity, ...data })}\n\n`)) {
        await once(response, 'drain', {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
      }
    }
    try {
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders();
      await send('start', {});
      for await (const event of stream(input, controller.signal)) {
        if (event.type === 'delta') await send('delta', { text: event.text });
        else await send('done', { content: event.content, model: event.model });
      }
    } catch (error) {
      if (!controller.signal.aborted && !response.destroyed) {
        const timeout = error instanceof DOMException && error.name === 'TimeoutError';
        const message = timeout ? '问答超时，请稍后重试'
          : error instanceof TypeError ? '暂时无法连接模型服务，请稍后重试'
          : error instanceof Error ? error.message : '问答失败，请稍后重试';
        try { await send('error', { code: timeout ? 'MODEL_TIMEOUT' : 'CHAT_FAILED', message }); }
        catch { /* 客户端断开时无需继续写入 */ }
      }
    } finally {
      controller.abort();
      response.off('close', handleClose);
      if (!response.destroyed && !response.writableEnded) response.end();
      release();
    }
  });
  return router;
}
