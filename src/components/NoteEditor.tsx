import { useState} from 'react';
import { MarkdownPreview} from './MarkdownPreview';

type NoteEditorProps = {
  documentTitle: string;
  note: string;
  loadError: string;
  editDisabled: boolean;
  saveDisabled: boolean;
  saveMessage: string;
  onNoteChange: (content: string) => void;
  onSave: () => void;
};

export function NoteEditor({
  
  documentTitle,
  note,
  loadError,
  editDisabled,
  saveDisabled,
  saveMessage,
  onNoteChange,
  onSave,
  
}: NoteEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  return (
    <section className="workspace-column">
        <h2 className="column-title">我的笔记</h2>

        <div className="panel notes">
            <p>
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
            <button 
            type="button" 
            onClick={onSave} 
            disabled={saveDisabled }
            >
            保存全部资料与笔记

            </button>
            <p role="status">{saveMessage}</p>
            </div>    
      </section> 
  );
}