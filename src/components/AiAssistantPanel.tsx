import { useState } from 'react';
import type { ReactNode } from 'react';
import type { StudyDocument } from '../types/document';
import { ChatComposer } from './ChatComposer';

import { useStudyChat } from '../hooks/useStudyChat';
import { MarkdownPreview } from './MarkdownPreview';

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

  const {
    draft,
    messages,
    isReplying,
    replyingTo,
    changeDraft: handleDraftChange,
    send: handleSend,
    stop: handleStop,
  } = useStudyChat(document, disabled);
  const chatDisabled = disabled || !document;

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
          {isReplying
            ? `正在为《${replyingTo}》模拟回答，可停止后继续提问。`
            : '当前为模拟回答，不分析正文、不调用真实模型。'}
        </p>

        <div className="chat-messages" aria-label="对话记录">
          {messages.length === 0 ? (
            <p>从一个不理解的概念开始提问吧。</p>
          ) : (
            messages.map((message) => (
              <article
                className={message.role === 'user' ? 'chat-question' : 'chat-answer'}
                key={message.id}
              >
                <strong>{message.role === 'user' ? '你' : '助手（模拟）'}</strong>
                {message.role === 'user' ? (
                  <p>{message.content}</p>
                ) : (
                  <>
                    {message.content ? (
                      <MarkdownPreview content={message.content} />
                    ) : (
                      <p>尚未收到正文。</p>
                    )}
                    {message.status === 'streaming' && (
                      <p role="status">正在模拟回答……</p>
                    )}
                    {message.status === 'stopped' && (
                      <p>已停止，以上为未完成片段。</p>
                    )}
                    {message.status === 'completed' && <p>模拟回答已完成。</p>}
                    {message.status === 'error' && <p role="alert">{message.error}</p>}
                  </>
                )}
              </article>
            ))
          )}
        </div>

        <ChatComposer
          value={draft}
          disabled={chatDisabled}
          isReplying={isReplying}
          onChange={handleDraftChange}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>
    </section>
  );
}
