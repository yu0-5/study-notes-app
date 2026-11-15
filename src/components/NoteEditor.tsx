import { useId, useState } from 'react';
import { MarkdownPreview} from './MarkdownPreview';
import type { NoteExportResult } from '../utils/noteExport';

type NoteEditorProps = {
  documentId: string | null;
  documentTitle: string;
  note: string;
  loadError: string;
  editDisabled: boolean;
  saveDisabled: boolean;
  saveMessage: string;
  onNoteChange: (content: string) => void;
  onSave: () => void;
  exportDisabledReason: string;
  onExport: () => NoteExportResult;
};

type ExportFeedback = {
  documentId: string;
  note: string;
  result: NoteExportResult;
};

export function NoteEditor({
  documentId,
  documentTitle,
  note,
  loadError,
  editDisabled,
  saveDisabled,
  saveMessage,
  onNoteChange,
  onSave,
  exportDisabledReason,
  onExport,
}: NoteEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<ExportFeedback | null>(null);
  const exportHelpId = useId();
  const visibleExportResult =
    exportFeedback?.documentId === documentId && exportFeedback.note === note
      ? exportFeedback.result
      : null;

  function handleExport() {
    if (exportDisabledReason || !documentId) return;

    setExportFeedback({ documentId, note, result: onExport() });
  }
  return (
    <section className="workspace-column">
        <h2 className="column-title">我的笔记</h2>

        <div className="panel notes">
            <p className="note-source-title">
            当前资料:{documentTitle ?? '未选择资料'}
            </p>
            {loadError && <p role="alert">{loadError}</p>}
            <div className = "note-mode-switch">
              <button
                type="button"
                aria-pressed={!isPreview}
                onClick={() => 
                  setIsPreview(false)}
                >
                编辑
              </button>
              <button
                type="button"
                aria-pressed={isPreview}
                onClick={() => 
                  setIsPreview(true)}
                >
                预览
              </button>
            </div>
            {isPreview ? (
            <MarkdownPreview content={note || '暂无笔记'} />
          ) : (
            <textarea
              className="note-editor"
              aria-label="我的笔记"
              placeholder="记录你对这份资料的理解、重点和疑问"
              value={note}
              disabled={editDisabled}
              onChange={(event) => onNoteChange(event.target.value)}
            />
          )}
            <p>已输入 {note.length} 个字符</p> 
            <div className="note-actions">
              <button
                className="note-save"
                type="button"
                onClick={onSave}
                disabled={saveDisabled}
              >
                保存全部资料与笔记
              </button>
              <button
                className="note-export"
                type="button"
                disabled={Boolean(exportDisabledReason) || !documentId}
                aria-describedby={exportHelpId}
                onClick={handleExport}
              >
                导出 Markdown
              </button>
            </div>
            <p role="status">{saveMessage}</p>
            <p className="note-export-hint" id={exportHelpId}>
              {exportDisabledReason ||
                '导出包含当前尚未保存的编辑；浏览器内的修改仍需单独保存。'}
            </p>
            {visibleExportResult && (
              <p
                className="note-export-feedback"
                role={visibleExportResult.ok ? 'status' : 'alert'}
              >
                {visibleExportResult.ok
                  ? `已发起下载：${visibleExportResult.fileName}`
                  : visibleExportResult.message}
              </p>
            )}
            </div>    
      </section> 
  );
}
