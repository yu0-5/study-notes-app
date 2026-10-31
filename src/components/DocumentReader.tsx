import type { StudyDocument } from '../types/document';
import { MarkdownPreview } from './MarkdownPreview';

type DocumentReaderProps = {
  document: StudyDocument | undefined;
};

export function DocumentReader({ document }: DocumentReaderProps) {
  return (
    <main className="workspace-column">
        <h2 className = "column-title">资料阅读</h2>

        <div className="panel reader">
            <h3>{document ? document.title : '请选择资料'}</h3>
            {!document ? (
                <p>点击左侧资料查看正文</p>
            ) : document.format === 'markdown' ? (
                <MarkdownPreview content={document.content} />
            ) : (
                <p className='reader-content'>
                    {document.content}
                    </p>  
            )}
        </div>  
    </main>)
}