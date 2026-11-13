import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export type RightPanel = 'ai' | 'notes';

type RightWorkspaceProps = {
  activePanel: RightPanel;
  onPanelChange: (panel: RightPanel) => void;
  aiPanel: ReactNode;
  notesPanel: ReactNode;
};

export function RightWorkspace({
  activePanel,
  onPanelChange,
  aiPanel,
  notesPanel,
}: RightWorkspaceProps) {
  const id = useId();
  const aiTabRef = useRef<HTMLButtonElement>(null);
  const notesTabRef = useRef<HTMLButtonElement>(null);
  const previousPanelRef = useRef(activePanel);

  // 采纳草稿等操作也会切换面板，将焦点移到新标签，避免留在隐藏内容中。
  useEffect(() => {
    if (previousPanelRef.current === activePanel) {
      return;
    }

    previousPanelRef.current = activePanel;
    const tab = activePanel === 'ai' ? aiTabRef : notesTabRef;
    tab.current?.focus();
  }, [activePanel]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextPanel: RightPanel;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      nextPanel = activePanel === 'ai' ? 'notes' : 'ai';
    } else if (event.key === 'Home') {
      nextPanel = 'ai';
    } else if (event.key === 'End') {
      nextPanel = 'notes';
    } else {
      return;
    }

    event.preventDefault();
    onPanelChange(nextPanel);
    const tab = nextPanel === 'ai' ? aiTabRef : notesTabRef;
    tab.current?.focus();
  }

  return (
    <section
      className="workspace-column assistant-column right-workspace"
      aria-label="学习工作区"
    >
      <div className="right-workspace-tabs" role="tablist" aria-label="学习工具">
        <button
          ref={aiTabRef}
          id={`${id}-ai-tab`}
          type="button"
          role="tab"
          aria-selected={activePanel === 'ai'}
          aria-controls={`${id}-ai-panel`}
          tabIndex={activePanel === 'ai' ? 0 : -1}
          onClick={() => onPanelChange('ai')}
          onKeyDown={handleTabKeyDown}
        >
          AI 助手
        </button>
        <button
          ref={notesTabRef}
          id={`${id}-notes-tab`}
          type="button"
          role="tab"
          aria-selected={activePanel === 'notes'}
          aria-controls={`${id}-notes-panel`}
          tabIndex={activePanel === 'notes' ? 0 : -1}
          onClick={() => onPanelChange('notes')}
          onKeyDown={handleTabKeyDown}
        >
          我的笔记
        </button>
      </div>

      {/* 只切换可见性，保留候选状态和请求；重新确认输入仍由原 requestId 重置。 */}
      <div
        id={`${id}-ai-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-ai-tab`}
        className="right-workspace-panel"
        hidden={activePanel !== 'ai'}
        tabIndex={0}
      >
        {aiPanel}
      </div>
      <div
        id={`${id}-notes-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-notes-tab`}
        className="right-workspace-panel"
        hidden={activePanel !== 'notes'}
        tabIndex={0}
      >
        {notesPanel}
      </div>
    </section>
  );
}
