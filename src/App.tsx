import{ useState } from 'react'
import './App.css'
import { validateTextFile } from './utils/textFile';
import type { StudyDocument } from './types/document';
import {
  loadWorkspace,
  saveWorkspace,
} from './services/workspaceStorage';
//建立页面状态
function App() {
  const [loadResult] = useState(loadWorkspace);

  const [documents, setDocuments] =
    useState<StudyDocument[]>(loadResult.documents);

  const [selectedId, setSelectedId] =
    useState(loadResult.documents[0]?.id ?? '');

  const [notesById, setNotesById] =
    useState<Record<string, string>>(loadResult.notes);

  const loadError = loadResult.error;
  const [saveMessage, setSaveMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const selectedDocument = documents.find((doc) => doc.id === selectedId);
  const note = notesById[selectedId] ?? '';
  
  async function handleReadNotes(file: File){
    if(loadError){
      setImportMessage('读取异常尚未解决，暂时无法导入资料');
      return;
    }
    const errorMessage = validateTextFile(file);
    if(errorMessage){
      setImportMessage(errorMessage);
      return;
    }
    setIsReadingFile(true);
    setImportMessage('正在读取并检查文件...');
    try{
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder('utf-8',{
        fatal: true,
      });
      const content = decoder.decode(buffer);

      if(content.includes('\u0000')){
        setImportMessage('文件包含异常内容,请选择正常的文本文件');
        return;
      }
      if(content.trim() === ''){
        setImportMessage('文件内容为空,请选择包含正文的文件');
        return;
      }
      const newDocument: StudyDocument = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.(txt|md)$/i, '').trim() || '未命名资料',
        content,
      };
      setDocuments((previousDocuments) => [newDocument, ...previousDocuments]);

      setSelectedId(newDocument.id);
      setSaveMessage('有新资料尚未保存');

      setImportMessage(`已导入:${newDocument.title}`);
    } catch (error) {
      console.error('读取文件失败', error);
      setImportMessage('读取文件失败，请检查文件格式或内容');
    } finally {
      setIsReadingFile(false);
    }
  };

  function handleSaveNotes() {
  if (loadError) {
    setSaveMessage('读取异常尚未解决，暂时无法保存笔记');
    return;
  }
  if(isReadingFile){
    setSaveMessage('正在读取文件，请稍后保存笔记');
    return;
  }
  try {
    saveWorkspace(documents, notesById);

    setSaveMessage('全部笔记已保存到当前浏览器');
  } catch(error) {
    console.error('保存笔记失败', error);
    setSaveMessage('保存失败，修改仍保留在当前页面，请稍后重试');
  }
}

  return(
    <div>
      <h1>AI资料研读工作台</h1>
      <p>把学习资料整理成自己的笔记</p>
    
    <div className="workspace">
      <aside className="sidebar">
        <h2>我的资料</h2>
        <label htmlFor="documents-file">导入学习资料</label>
        <input
          id="documents-file"
          type="file"
          accept=".txt,.md"
          disabled={isReadingFile ||Boolean(loadError)}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';//用于重置文件输入框，让用户之后重新选择同一个文件时，也能再次触发检查。
            if (!file) {
              return; 
            }
            handleReadNotes(file);
          }}
        />
        <p role="status">{importMessage}</p >
        <ul>
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                className={doc.id === selectedId ? 'document-active' : ''}
                onClick={() => setSelectedId(doc.id)}
              >
              {doc.title}</button>
              
            </li>
          ))}
        </ul>
      </aside>

      <main className="reader">
        <h2>{selectedDocument ? selectedDocument.title : '请选择资料'}</h2>
        <p className = "reader-content">{selectedDocument ? selectedDocument.content : '点击左侧资料查看正文'}</p  >
      </main>

      <section className="notes">
        <h2>我的笔记</h2>
        <p>
          当前资料:{selectedDocument?.title ?? '未选择资料'}
        </p>
        {loadError && <p role="alert">{loadError}</p>}
        <textarea
          className="note-editor"
          aria-label="我的笔记"
          placeholder="记录你对这份资料的理解、重点和疑问 "
          value={note}
          disabled={Boolean(loadError) || selectedDocument === undefined}
          onChange={(event) => {
            const content = event.target.value
            setNotesById((previousNotes) => ({
              ...previousNotes,
              [selectedId]: content,
            }));
            setSaveMessage('有修改尚未保存')
          }}  
        /> 
        <p>已输入 {note.length} 个字符</p> 
        <button 
          type="button" 
          onClick={handleSaveNotes} 
          disabled={Boolean(loadError) || isReadingFile  }
        >
          保存全部笔记
        </button>
        <p role="status">{saveMessage}</p>
      </section> 
    </div>
  </div>
  )
}  

export default App
