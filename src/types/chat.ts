import type { ChatMode, StudyChatInput } from '../../shared/chat';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'completed' | 'stopped' | 'error';
  error?: string;
  mode?: ChatMode;
  model?: string;
  input?: StudyChatInput;
};
