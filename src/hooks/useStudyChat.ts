import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudyDocument } from '../types/document';
import type { ChatMessage } from '../types/chat';
import { streamDemoChat } from '../services/demoChat';
import { streamStudyChat } from '../services/studyChatApi';
import { createChatInput } from '../utils/studyChatInput';
import { CHAT_SOURCE_LIMIT, type ChatMode, type StudyChatInput } from '../../shared/chat';

type ActiveReply = {
  documentId: string;
  controller: AbortController;
};

export function useStudyChat(
  document: StudyDocument | undefined,
  disabled: boolean,
) {
  const [draftsByDocument, setDraftsByDocument] =
    useState<Record<string, string>>({});

  const [messagesByDocument, setMessagesByDocument] =
    useState<Record<string, ChatMessage[]>>({});

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>('demo');
  const activeReplyRef = useRef<ActiveReply | null>(null);

  const documentId = document?.id ?? '';
  const draft = draftsByDocument[documentId] ?? '';
  const messages = messagesByDocument[documentId] ?? [];
  const isReplying = replyingTo !== null;
  const lastMessage = messages.at(-1);
  const sourceCount = useMemo(() =>
    Array.from(document?.content.replace(/\r\n?/g, '\n') ?? '').length,
  [document?.content]);
  const sourceError = mode !== 'ai' || !document ? ''
    : !document.content.trim() ? '当前资料没有可供问答的正文'
    : sourceCount > CHAT_SOURCE_LIMIT ? '当前原文超过 12000 个字符，真实问答暂支持整篇短资料，请先导入精简后的内容' : '';

  const retryableMessageId =
    lastMessage?.role === 'assistant' &&
    (lastMessage.status === 'stopped' || lastMessage.status === 'error')
      ? lastMessage.id
      : null;

  useEffect(() => {
    return () => {
      const activeReply = activeReplyRef.current;
      activeReplyRef.current = null;
      activeReply?.controller.abort();
    };
  }, []);

  function changeDraft(content: string) {
    if (!document) {
      return;
    }

    setDraftsByDocument((previous) => ({
      ...previous,
      [document.id]: content,
    }));
  }

  function updateMessage(
    sourceId: string,
    messageId: string,
    update: (message: ChatMessage) => ChatMessage,
  ) {
    setMessagesByDocument((previous) => {
      const sourceMessages = previous[sourceId];

      // 已删除的会话不能被迟到的回调重新创建。
      if (!sourceMessages?.some((message) => message.id === messageId)) {
        return previous;
      }

      return {
        ...previous,
        [sourceId]: sourceMessages.map((message) =>
          message.id === messageId ? update(message) : message,
        ),
      };
    });
  }

  async function runReply(
    sourceId: string,
    sourceTitle: string,
    question: string,
    answerId: string,
    replyMode: ChatMode,
    input?: StudyChatInput,
  ) {
    const controller = new AbortController();
    const activeReply: ActiveReply = { documentId: sourceId, controller };
    activeReplyRef.current = activeReply;
    setReplyingTo(sourceTitle);

    try {
      const onDelta = (text: string) => {
        if (controller.signal.aborted || activeReplyRef.current !== activeReply) return;

        updateMessage(sourceId, answerId, (message) => ({
          ...message,
          content: message.content + text,
        }));
      };
      let model: string | undefined;
      if (replyMode === 'ai') {
        if (!input) throw new Error('问答输入缺失，请重新提问');
        const result = await streamStudyChat(input, controller.signal, onDelta);
        model = result.model;
      } else {
        await streamDemoChat({ documentTitle: sourceTitle, question, signal: controller.signal, onDelta });
      }

      controller.signal.throwIfAborted();

      if (activeReplyRef.current !== activeReply) {
        return;
      }

      updateMessage(sourceId, answerId, (message) => ({
        ...message,
        status: 'completed',
        model,
      }));
    } catch (error) {
      if (activeReplyRef.current !== activeReply) {
        return;
      }

      updateMessage(sourceId, answerId, (message) => ({
        ...message,
        status: controller.signal.aborted ? 'stopped' : 'error',
        error: controller.signal.aborted
          ? undefined
          : error instanceof Error
            ? error.message
            : '回答失败，请重试',
      }));
    } finally {
      if (activeReplyRef.current === activeReply) {
        activeReplyRef.current = null;
        setReplyingTo(null);
      }
    }
  }

  async function send() {
    if (
      !document ||
      disabled ||
      sourceError ||
      activeReplyRef.current ||
      draft.trim() === '' ||
      Array.from(draft).length > 1000
    ) {
      return;
    }

    // 固定本次操作的来源，后续不再读取当前选中的资料。
    const sourceId = document.id;
    const sourceTitle = document.title || '未命名资料';
    const question = draft.trim();
    const answerId = crypto.randomUUID();
    const input = mode === 'ai' ? createChatInput(document, question, messages) : undefined;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      status: 'completed',
      mode,
    };

    const assistantMessage: ChatMessage = {
      id: answerId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      mode,
      input,
    };

    setMessagesByDocument((previous) => ({
      ...previous,
      [sourceId]: [
        ...(previous[sourceId] ?? []),
        userMessage,
        assistantMessage,
      ],
    }));

    setDraftsByDocument((previous) => ({
      ...previous,
      [sourceId]: '',
    }));

    await runReply(sourceId, sourceTitle, question, answerId, mode, input);
  }

  async function retryLastReply() {
    if (
      !document ||
      disabled ||
      activeReplyRef.current ||
      !retryableMessageId
    ) {
      return;
    }

    const questionMessage = messages.at(-2);

    if (questionMessage?.role !== 'user') {
      return;
    }

    const sourceId = document.id;
    const sourceTitle = document.title || '未命名资料';
    const answerId = retryableMessageId;
    const previousAnswer = messages.at(-1)!;
    const replyMode = previousAnswer.mode ?? 'demo';
    setMode(replyMode);
    // 重试复用原问题、原文和历史快照，但使用新的传输请求 ID。
    const input = previousAnswer.input
      ? { ...previousAnswer.input, requestId: crypto.randomUUID() }
      : undefined;

    updateMessage(sourceId, answerId, (message) => ({
      ...message,
      content: '',
      status: 'streaming',
      error: undefined,
      input,
    }));

    await runReply(
      sourceId,
      sourceTitle,
      questionMessage.content,
      answerId,
      replyMode,
      input,
    );
  }

  function stop() {
    activeReplyRef.current?.controller.abort();
  }

  function clearDocument(id: string) {
    const activeReply = activeReplyRef.current;

    if (activeReply?.documentId === id) {
      // 先使旧任务失效，再取消，避免它的 catch/finally 干扰新任务。
      activeReplyRef.current = null;
      activeReply.controller.abort();
      setReplyingTo(null);
    }

    setDraftsByDocument((previous) => {
      if (!(id in previous)) return previous;
      const next = { ...previous };
      delete next[id];
      return next;
    });

    setMessagesByDocument((previous) => {
      if (!(id in previous)) return previous;
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  return {
    mode,
    changeMode: (nextMode: ChatMode) => {
      if (!activeReplyRef.current) setMode(nextMode);
    },
    sourceCount,
    sourceError,
    draft,
    messages,
    isReplying,
    replyingTo,
    retryableMessageId,
    changeDraft,
    send,
    stop,
    retryLastReply,
    clearDocument,
  };
}

export type StudyChat = ReturnType<typeof useStudyChat>;
