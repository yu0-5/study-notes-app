export const CHAT_SOURCE_LIMIT = 12000;
export const CHAT_QUESTION_LIMIT = 1000;
export const CHAT_HISTORY_LIMIT = 12000;
export const CHAT_HISTORY_TURNS = 4;

export type ChatMode = 'demo' | 'ai';
export type StudyChatTurn = { question: string; answer: string };
export type StudyChatInput = {
  requestId: string;
  documentId: string;
  documentTitle: string;
  sourceText: string;
  question: string;
  history: StudyChatTurn[];
};
