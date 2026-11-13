import { useRef } from 'react';
import type { StudyDocument } from '../types/document';


type HomePageProps = {
  documents: StudyDocument[];
  disabled: boolean;
  message: string;
  onImport: (file: File) => void;
  onOpenDocument: (id: string) => void;
};

export function HomePage({
  documents,
  disabled,
  message,
  onImport,
  onOpenDocument,
}: HomePageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="home-page">
      <div className="home-content">
        <header className="home-intro">
          <span className="home-mark" aria-hidden="true">研</span>
          <h1>今天想学点什么？</h1>
          <p>从一份资料开始，整理出属于自己的学习笔记。</p>
        </header>

        <section className="home-upload" aria-label="导入学习资料">
          <h2>把资料变成自己的知识</h2>
          <p>导入资料，选择学习目标，对照原文整理 AI 草稿。</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            hidden
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';

              if (file) {
                onImport(file);
              }
            }}
          />

          <button
            className="home-import"
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
          >
            ＋ 导入学习资料
          </button>

          <p className="home-hint">
            支持 TXT、Markdown，单个文件不超过 1 MiB
          </p>
          <p role="status">{message}</p>
        </section>

        <section className="home-library" aria-label="已有资料">
          <h2>继续学习</h2>

          {documents.length === 0 ? (
            <p>还没有资料，从上方导入第一份吧。</p>
          ) : (
            <div className="home-documents">
              {documents.map((document) => (
                <button
                  className="home-document"
                  key={document.id}
                  type="button"
                  onClick={() => onOpenDocument(document.id)}
                >
                  {document.title}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}