import { useEffect, useRef, useState } from 'react';
import type { StudyDocument } from '../types/document';
import type { ChatMessage } from '../types/chat';
import { streamDemoChat } from '../services/demoChat';

export function useStudyChat(
  document: StudyDocument | undefined,
  disabled: boolean,
) {
  const [draftsByDocument, setDraftsByDocument] =
    useState<Record<string, string>>({});

  const [messagesByDocument, setMessagesByDocument] =
    useState<Record<string, ChatMessage[]>>({});

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const documentId = document?.id ?? '';
  const draft = draftsByDocument[documentId] ?? '';
  const messages = messagesByDocument[documentId] ?? [];
  const isReplying = replyingTo !== null;
  const lastMessage = messages.at(-1);

  const retryableMessageId =
    lastMessage?.role === 'assistant' &&
    (
        lastMessage.status === 'stopped' ||
        lastMessage.status === 'error'
    )
        ? lastMessage.id
        : null;

    useEffect(() => {
        return () => {
        controllerRef.current?.abort();
        controllerRef.current = null;
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
    setMessagesByDocument((previous) => ({
      ...previous,
      [sourceId]: (previous[sourceId] ?? []).map((message) =>
        message.id === messageId ? update(message) : message,
      ),
    }));
  }

  async function runReply(
    sourceId: string,
    sourceTitle: string,
    question: string,
    answerId: string,
    ) {
    const controller = new AbortController();
    controllerRef.current = controller;
    setReplyingTo(sourceTitle);

    try {
        await streamDemoChat({
        documentTitle: sourceTitle,
        question,
        signal: controller.signal,
        onDelta: (text) => {
            if (controller.signal.aborted) {
            return;
            }

            updateMessage(sourceId, answerId, (message) => ({
            ...message,
            content: message.content + text,
            }));
        },
        });

        controller.signal.throwIfAborted();

        updateMessage(sourceId, answerId, (message) => ({
        ...message,
        status: 'completed',
        }));
    } catch (error) {
        if (controllerRef.current !== controller) {
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
        if (controllerRef.current === controller) {
        controllerRef.current = null;
        setReplyingTo(null);
        }
    }
    }
  async function send() {
    if (
      !document ||
      disabled ||
      controllerRef.current ||
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
        controllerRef.current ||
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
    controllerRef.current?.abort();
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
  };
}