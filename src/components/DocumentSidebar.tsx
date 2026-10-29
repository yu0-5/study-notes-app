import type { 
    StudyDocument, 
    StudyProject,
} from '../types/document';

type DocumentSidebarProps = {
  documents: StudyDocument[];
  selectedId: string;
  importMessage: string;
  importDisabled: boolean;
  onSelect: (id: string) => void;
  onImport: (file: File) => void;
  searchQuery: string;
  projects: StudyProject[];
  deleteDisabled: boolean;
  onDelete: (id: string) => void;
};

export function DocumentSidebar({
  projects,
  
  documents,
  selectedId,
  importMessage,
  importDisabled,
  onSelect,
  onImport,
  searchQuery,
  deleteDisabled,
  onDelete,

}: DocumentSidebarProps) {
  return (
    
    
    <aside className="workspace-column">
        <h2 className="column-title">项目与资料</h2>
        <div className="panel sidebar">
            

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
            <p role="status">显示 {documents.length} 份资料</p>

            {documents.length === 0 && (
            <p>
                {searchQuery.trim()
                ? '没有匹配的资料，请更换关键词'
                : '暂无资料，请先导入'}
            </p>
            )}
            <ul className="project-list">
              {projects.map((project) => {
                const projectDocuments = documents.filter(
                  (doc) => doc.projectId === project.id
                );
                return(
                  <li key={project.id}>
                    <details open>
                        <summary className="project-name">
                            {project.name}
                            <span>({projectDocuments.length})</span>
                        </summary>

                        {projectDocuments.length === 0 ? (
                            <p>
                                {searchQuery.trim()
                                ? '没有匹配的资料，请更换关键词'
                                : '暂无资料，请先导入'}
                            </p>
                        ):(
                            <ul className="project-documents">
                                {projectDocuments.map((doc) => (
                                <li key={doc.id} className="document-row">
                                    <button
                                      type="button"
                                      className={
                                        doc.id === selectedId
                                         ? 'document-title document-active' 
                                         : 'document-title'}                           
                                    onClick={() => onSelect(doc.id)}
                                    >
                                      {doc.title}
                                    </button>
                                    
                                    <button
                                    type="button"
                                    className="document-delete"
                                    disabled={deleteDisabled}
                                    aria-label={`删除资料：${doc.title}`}
                                    onClick={() => onDelete(doc.id)}
                                    >
                                      删除
                                    </button>
                                </li>
                                ))}
                            </ul>
                        )}
                    </details>
                </li>
              );
            })}
        </ul>
        </div>
    </aside>
  )}