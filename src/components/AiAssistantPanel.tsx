import { useState } from 'react';
import type { ReactNode } from 'react';
import type { StudyDocument } from '../types/document';
import { ChatComposer } from './ChatComposer';

import type { StudyChat } from '../hooks/useStudyChat';
import { MarkdownPreview } from './MarkdownPreview';

type AiAssistantPanelProps = {
  document: StudyDocument | undefined;
  disabled: boolean;
  chat: StudyChat;
  generationPanel: ReactNode;
};

export function AiAssistantPanel({
  document,
  disabled,
  chat,
  generationPanel,
}: AiAssistantPanelProps) {
  const [task, setTask] =
    useState<'generation' | 'chat'>('generation');

  const {
    draft,
    messages,
    isReplying,
    replyingTo,
    retryableMessageId,
    changeDraft: handleDraftChange,
    send: handleSend,
    stop: handleStop,
    retryLastReply: handleRetry,
    mode,
    changeMode,
    sourceCount,
    sourceError,
  } = chat;

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

        <label className="chat-mode-picker">
          问答方式
          <select value={mode} disabled={disabled || isReplying}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'demo' || value === 'ai') changeMode(value);
            }}>
            <option value="demo">模拟问答</option>
            <option value="ai">DeepSeek 真实问答</option>
          </select>
        </label>

        <p className="chat-demo-hint">
          {isReplying
            ? `正在为《${replyingTo}》${mode === 'ai' ? '生成真实回答' : '模拟回答'}，可停止后继续提问。`
            : mode === 'ai'
              ? `将发送当前整篇原文（${sourceCount} / 12000 个字符）与最近最多 4 轮完整真实问答给 DeepSeek，消耗 API 额度；历史合计最多 12000 字符。`
              : '当前为模拟回答，不分析正文、不调用真实模型。'}
        </p>
        {sourceError && <p role="alert">{sourceError}</p>}

        <div className="chat-messages" aria-label="对话记录">
          {messages.length === 0 ? (
            <p>从一个不理解的概念开始提问吧。</p>
          ) : (
            messages.map((message) => (
              <article
                className={message.role === 'user' ? 'chat-question' : 'chat-answer'}
                key={message.id}
              >
                <strong>{message.role === 'user' ? '你' : message.mode === 'ai' ? '助手（DeepSeek）' : '助手（模拟）'}</strong>
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
                      <p role="status">{message.mode === 'ai' ? '正在接收回答……' : '正在模拟回答……'}</p>
                    )}
                    {message.status === 'stopped' && (
                      <p>已停止，以上为未完成片段。</p>
                    )}
                    {message.status === 'completed' && <p>{message.mode === 'ai' ? `回答已完成，模型：${message.model}` : '模拟回答已完成。'}</p>}
                    {message.status === 'error' && <p role="alert">{message.error}</p>}
                    {message.id === retryableMessageId && (
                      <div>
                      <p>重试沿用这条回答原有的生成方式和资料快照。</p>
                      <button
                        type="button"
                        disabled={chatDisabled || isReplying}
                        onClick={handleRetry}
                      >
                        重试这条回答
                      </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            ))
          )}
        </div>

        <ChatComposer
          value={draft}
          disabled={chatDisabled || Boolean(sourceError)}
          isReplying={isReplying}
          onChange={handleDraftChange}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>
    </section>
  );
}
