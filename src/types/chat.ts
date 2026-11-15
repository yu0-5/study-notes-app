export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'completed' | 'stopped' | 'error';
  error?: string;
};