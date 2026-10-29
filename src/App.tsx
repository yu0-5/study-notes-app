import{useEffect, useState } from 'react'
import './App.css'
import { validateTextFile } from './utils/textFile';
import type { StudyDocument } from './types/document';
import {
  loadWorkspace,
  saveWorkspace,
} from './services/workspaceStorage';

import { DocumentReader } from './components/DocumentReader';
import { DocumentSidebar } from './components/DocumentSidebar';
import { NoteEditor } from './components/NoteEditor';
import { 
  DEFAULT_PROJECT_ID,
  initialProjects,
 } from './data/initialProjects';

 //用于比较的快照函数
 function createWorkspaceSnapshot(
  documents: StudyDocument[], 
  notes: Record<string, string>
): string {
  const normalizedNotes = Object.fromEntries(
    Object.entries(notes)
    .filter(([,content]) =>content !=='')
    .sort(([idA], [idB]) => idA.localeCompare(idB))
  );
  return JSON.stringify({
    documents,
    notes: normalizedNotes,
  });
}

//建立页面状态
function App() {
  const [loadResult] = useState(loadWorkspace);
  const [savedSnapshot, setSavedSnapshot] = useState(() => 
    createWorkspaceSnapshot(loadResult.documents, loadResult.notes)
  );
  

  const [documents, setDocuments] =
    useState<StudyDocument[]>(loadResult.documents);

  const [selectedId, setSelectedId] =
    useState(loadResult.documents[0]?.id ?? '');

  const [notesById, setNotesById] =
    useState<Record<string, string>>(loadResult.notes);
  
  const loadError = loadResult.error;

  const currentSnapshot = createWorkspaceSnapshot(
    documents,
    notesById
  );
  const hasUnsavedChanges = 
    !loadError && currentSnapshot !== savedSnapshot;

  
  const [saveMessage, setSaveMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const selectedDocument = documents.find((doc) => doc.id === selectedId);
  const note = notesById[selectedId] ?? '';
  const [searchQuery, setSearchQuery] = useState('');
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
        projectId: DEFAULT_PROJECT_ID,
        title: file.name.replace(/\.(txt|md)$/i, '').trim() || '未命名资料',
        content,
      };
      setDocuments((previousDocuments) => [newDocument, ...previousDocuments]);

      setSelectedId(newDocument.id);
      setSearchQuery('');
      setSaveMessage('');

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
    setSavedSnapshot(currentSnapshot);
    setSaveMessage('全部笔记已保存到当前浏览器');
  } catch(error) {
    console.error('保存笔记失败', error);
    setSaveMessage('保存失败，修改仍保留在当前页面，请稍后重试');
  }
}
function handleNoteChange(content: string) {
  if (loadError || !selectedDocument) {
    return;
  }

  setNotesById((previousNotes) => ({
    ...previousNotes,
    [selectedId]: content,
  }));
  setSaveMessage('');
  
}
const keyword = searchQuery.trim().toLowerCase();

//删除处理函数
function handleDeleteDocument(id: string) {
  if (loadError || isReadingFile) {
    return;
  }

  const target = documents.find((doc) => doc.id === id);

  if (!target) {
    return;
  }

  const confirmed = window.confirm(
    `删除“${target.title}”及其关联笔记？\n` +
    '未保存的笔记也会移除。删除结果需要点击保存后才会持久化。'
  );

  if (!confirmed) {
    return;
  }

  const remainingDocuments = documents.filter(
    (doc) => doc.id !== id
  );

  setDocuments(remainingDocuments);

  setNotesById((previousNotes) => {
    const nextNotes = { ...previousNotes };

    delete nextNotes[id];

    return nextNotes;
  });

  if (selectedId === id) {
    setSelectedId(remainingDocuments[0]?.id ?? '');
    setSearchQuery('');
  }

  setImportMessage('');
  setSaveMessage('');
}

const visibleDocuments = documents.filter((doc) =>
  doc.title.toLowerCase().includes(keyword)
);

useEffect(() => {
  if(!hasUnsavedChanges){
    return;
  }

  function handleBeforeUnload(event: BeforeUnloadEvent){
    event.preventDefault();
    
  }

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
},[hasUnsavedChanges])

return(
  <div>
    <h1>AI资料研读工作台</h1>
    <p>把学习资料整理成自己的笔记</p>
    <div className="workspace-toolbar">
      <label htmlFor="document-search">搜索资料标题</label>

      <input
          id="document-search"
          type="search"
          placeholder="输入标题关键词"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
      />

      <button
          type="button"
          disabled={searchQuery === ''}
          onClick={() => setSearchQuery('')}
      >
          清空搜索
      </button>
    </div>
    
    <div className="workspace">
      <DocumentSidebar
          documents={visibleDocuments}
          selectedId={selectedId}
          importMessage={importMessage}
          importDisabled={isReadingFile || Boolean(loadError)}
          onSelect={setSelectedId}
          onImport={handleReadNotes}
          searchQuery={searchQuery}
          projects={initialProjects}
          deleteDisabled={Boolean(loadError) || isReadingFile}
          onDelete={handleDeleteDocument}
/>

      <DocumentReader document={selectedDocument} />
      <NoteEditor
        documentTitle={selectedDocument?.title ?? '未选择资料'}
        note={note}
        loadError={loadError}
        editDisabled={Boolean(loadError) || !selectedDocument}
        saveDisabled={Boolean(loadError) || isReadingFile}
        saveMessage={
          hasUnsavedChanges
           ? `有修改尚未保存${saveMessage ?`; ${saveMessage}`:''}` 
           : saveMessage
        }
        onNoteChange={handleNoteChange}
        onSave={handleSaveNotes}
      />
      
    </div>
  </div>
  )
}  

export default App
