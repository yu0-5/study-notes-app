import {
  CHAT_HISTORY_LIMIT, CHAT_HISTORY_TURNS, CHAT_QUESTION_LIMIT,
  type StudyChatInput, type StudyChatTurn,
} from '../../shared/chat';
import type { ChatMessage } from '../types/chat';
import type { StudyDocument } from '../types/document';

export function buildChatHistory(messages: ChatMessage[]): StudyChatTurn[] {
  const history: StudyChatTurn[] = [];
  let count = 0;
  for (let index = messages.length - 1; index > 0; index--) {
    const answer = messages[index];
    const question = messages[index - 1];
    if (answer.role !== 'assistant' || answer.status !== 'completed' || answer.mode !== 'ai' ||
        question.role !== 'user' || question.status !== 'completed' || question.mode !== 'ai') continue;
    const size = Array.from(question.content).length + Array.from(answer.content).length;
    if (history.length >= CHAT_HISTORY_TURNS || count + size > CHAT_HISTORY_LIMIT) break;
    if (!question.content.trim() || !answer.content.trim() ||
        Array.from(question.content).length > CHAT_QUESTION_LIMIT) continue;
    history.unshift({ question: question.content, answer: answer.content });
    count += size;
    index--;
  }
  return history;
}

export function createChatInput(document: StudyDocument, question: string, messages: ChatMessage[]): StudyChatInput {
  return {
    requestId: crypto.randomUUID(), documentId: document.id,
    documentTitle: document.title.trim() || '未命名资料',
    sourceText: document.content.replace(/\r\n?/g, '\n'),
    question, history: buildChatHistory(messages),
  };
}
