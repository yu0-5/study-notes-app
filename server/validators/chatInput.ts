import { z } from 'zod';
import {
  CHAT_HISTORY_LIMIT, CHAT_HISTORY_TURNS, CHAT_QUESTION_LIMIT, CHAT_SOURCE_LIMIT,
  type StudyChatInput,
} from '../../shared/chat.js';

function text(label: string, limit: number) {
  return z.string().refine((value) => value.trim() !== '', `${label}不能为空`)
    .refine((value) => Array.from(value).length <= limit, `${label}不能超过 ${limit} 个字符`);
}

export const chatInputSchema: z.ZodType<StudyChatInput> = z.object({
  requestId: z.uuid(),
  documentId: text('资料 ID', 200),
  documentTitle: text('资料标题', 500),
  sourceText: text('参考原文', CHAT_SOURCE_LIMIT),
  question: text('问题', CHAT_QUESTION_LIMIT),
  history: z.array(z.object({
    question: text('历史问题', CHAT_QUESTION_LIMIT),
    answer: text('历史回答', CHAT_HISTORY_LIMIT),
  }).strict()).max(CHAT_HISTORY_TURNS, '历史问答不能超过 4 轮')
    .refine((turns) => turns.reduce((count, turn) =>
      count + Array.from(turn.question).length + Array.from(turn.answer).length, 0,
    ) <= CHAT_HISTORY_LIMIT, '历史问答总长度不能超过 12000 个字符'),
}).strict();
