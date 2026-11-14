import { useState } from 'react';
import type { ReactNode } from 'react';
import type { StudyDocument } from '../types/document';
import { ChatComposer } from './ChatComposer';

type Question = {
  id: string;
  content: string;
};

type AiAssistantPanelProps = {
  document: StudyDocument | undefined;
  disabled: boolean;
  generationPanel: ReactNode;
};

export function AiAssistantPanel({
  document,
  disabled,
  generationPanel,
}: AiAssistantPanelProps) {
  const [task, setTask] =
    useState<'generation' | 'chat'>('generation');

  const [draftsByDocument, setDraftsByDocument] =
    useState<Record<string, string>>({});

  const [questionsByDocument, setQuestionsByDocument] =
    useState<Record<string, Question[]>>({});

  const documentId = document?.id ?? '';
  const draft = draftsByDocument[documentId] ?? '';
  const questions = questionsByDocument[documentId] ?? [];
  const chatDisabled = disabled || !document;

  function handleDraftChange(content: string) {
    if (!document) {
      return;
    }

    setDraftsByDocument((previous) => ({
      ...previous,
      [documentId]: content,
    }));
  }

  function handleSend() {
    const content = draft.trim();

    if (
      chatDisabled ||
      content === '' ||
      Array.from(draft).length > 1000
    ) {
      return;
    }

    const question: Question = {
      id: crypto.randomUUID(),
      content,
    };

    setQuestionsByDocument((previous) => ({
      ...previous,
      [documentId]: [
        ...(previous[documentId] ?? []),
        question,
      ],
    }));

    setDraftsByDocument((previous) => ({
      ...previous,
      [documentId]: '',
    }));
  }

  return (
    <section className="ai-assistant-panel" aria-label="AI 学习任务">
      <div className="ai-task-switch" role="group" aria-label="选择任务">
        <button
          type="button"
          aria-pressed={task === 'generation'}
          onClick={() => setTask('generation')}
        >
          生成笔记
        </button>

        <button
          type="button"
          aria-pressed={task === 'chat'}
          onClick={() => setTask('chat')}
        >
          资料问答
        </button>
      </div>

      <div
        className="ai-task-panel"
        hidden={task !== 'generation'}
      >
        {generationPanel}
      </div>

      <div
        className="ai-task-panel chat-task-panel"
        hidden={task !== 'chat'}
      >
        <p>
          当前资料：{document?.title ?? '请先选择资料'}
        </p>

        <p className="chat-demo-hint">
          当前验证输入交互，尚未接入 AI 回答。
        </p>

        <div className="chat-messages" aria-label="对话记录">
          {questions.length === 0 ? (
            <p>从一个不理解的概念开始提问吧。</p>
          ) : (
            questions.map((question) => (
              <article className="chat-question" key={question.id}>
                <strong>你</strong>
                <p>{question.content}</p>
              </article>
            ))
          )}
        </div>

        <ChatComposer
          value={draft}
          disabled={chatDisabled}
          onChange={handleDraftChange}
          onSend={handleSend}
        />
      </div>
    </section>
  );
}