import type { StudyChatInput } from '../../shared/chat.js';
import { buildChatMessages } from './chatPrompt.js';
import { streamDeepSeekCompletion } from './deepSeekClient.js';

export function streamStudyChat(input: StudyChatInput, signal: AbortSignal) {
  return streamDeepSeekCompletion(buildChatMessages(input), signal);
}
