import { useEffect, useRef, useState } from 'react';
import type { StudyDocument } from '../types/document';
import type { ChatMessage } from '../types/chat';
import { streamDemoChat } from '../services/demoChat';

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
  const activeReplyRef = useRef<ActiveReply | null>(null);

  const documentId = document?.id ?? '';
  const draft = draftsByDocument[documentId] ?? '';
  const messages = messagesByDocument[documentId] ?? [];
  const isReplying = replyingTo !== null;
  const lastMessage = messages.at(-1);

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
  ) {
    const controller = new AbortController();
    const activeReply: ActiveReply = { documentId: sourceId, controller };
    activeReplyRef.current = activeReply;
    setReplyingTo(sourceTitle);

    try {
      await streamDemoChat({
        documentTitle: sourceTitle,
        question,
        signal: controller.signal,
        onDelta: (text) => {
          if (
            controller.signal.aborted ||
            activeReplyRef.current !== activeReply
          ) {
            return;
          }

          updateMessage(sourceId, answerId, (message) => ({
            ...message,
            content: message.content + text,
          }));
        },
      });

      controller.signal.throwIfAborted();

      if (activeReplyRef.current !== activeReply) {
        return;
      }

      updateMessage(sourceId, answerId, (message) => ({
        ...message,
        status: 'completed',
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
            : '模拟回答失败',
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

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      status: 'completed',
    };

    const assistantMessage: ChatMessage = {
      id: answerId,
      role: 'assistant',
      content: '',
      status: 'streaming',
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

    await runReply(sourceId, sourceTitle, question, answerId);
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

    updateMessage(sourceId, answerId, (message) => ({
      ...message,
      content: '',
      status: 'streaming',
      error: undefined,
    }));

    await runReply(
      sourceId,
      sourceTitle,
      questionMessage.content,
      answerId,
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
