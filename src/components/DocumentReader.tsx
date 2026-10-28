import type { StudyDocument } from '../types/document';

type DocumentReaderProps = {
  document: StudyDocument | undefined;
};

export function DocumentReader({ document }: DocumentReaderProps) {
  return (
    <main className="reader">
      <h2>{document ? document.title : '请选择资料'}</h2>
        <p className = "reader-content">{document ? document.content : '点击左侧资料查看正文'}</p  >
    </main>)
}