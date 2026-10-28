import{ useState } from 'react'
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
function handleNoteChange(content: string) {
  if (loadError || !selectedDocument) {
    return;
  }

  setNotesById((previousNotes) => ({
    ...previousNotes,
    [selectedId]: content,
  }));

  setSaveMessage('有修改尚未保存');
}
  return(
    <div>
      <h1>AI资料研读工作台</h1>
      <p>把学习资料整理成自己的笔记</p>
    
    <div className="workspace">
      <DocumentSidebar
          documents={documents}
          selectedId={selectedId}
          importMessage={importMessage}
          importDisabled={isReadingFile || Boolean(loadError)}
          onSelect={setSelectedId}
          onImport={handleReadNotes}
/>

      <DocumentReader document={selectedDocument} />
      <NoteEditor
        documentTitle={selectedDocument?.title ?? '未选择资料'}
        note={note}
        loadError={loadError}
        editDisabled={Boolean(loadError) || !selectedDocument}
        saveDisabled={Boolean(loadError) || isReadingFile}
        saveMessage={saveMessage}
        onNoteChange={handleNoteChange}
        onSave={handleSaveNotes}
      />
      
    </div>
  </div>
  )
}  

export default App
