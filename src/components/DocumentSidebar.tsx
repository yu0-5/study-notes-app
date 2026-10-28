import type { StudyDocument } from '../types/document';

type DocumentSidebarProps = {
  documents: StudyDocument[];
  selectedId: string;
  importMessage: string;
  importDisabled: boolean;
  onSelect: (id: string) => void;
  onImport: (file: File) => void;
};

export function DocumentSidebar({
  documents,
  selectedId,
  importMessage,
  importDisabled,
  onSelect,
  onImport,
}: DocumentSidebarProps) {
  return (
    <aside className="sidebar">
            <h2>我的资料</h2>
            <label htmlFor="documents-file">导入学习资料</label>
            <input
              id="documents-file"
              type="file"
              accept=".txt,.md"
              disabled={importDisabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';//用于重置文件输入框，让用户之后重新选择同一个文件时，也能再次触发检查。
                if (!file) {
                  return; 
                }
                onImport(file);
              }}
            />
            <p role="status">{importMessage}</p >
            <ul>
              {documents.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className={doc.id === selectedId ? 'document-active' : ''}
                    onClick={() => onSelect(doc.id)}
                  >
                  {doc.title}</button>
                  
                </li>
              ))}
            </ul>
          </aside>
  );
}