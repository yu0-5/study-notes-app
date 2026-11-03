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
import type { GenerationRange, LearningPreferences, GenerationInputSnapshot } from './types/generation';
import { LearningPreferencesForm } from './components/LearningPreferencesForm';
import { GenerationRangePicker } from './components/GenerationRangePicker';
import { getGenerationSource, normalizeSourceText } from './utils/generationRange';
import { validateGenerationInput } from './services/generationApi';
import { GenerationDraftPanel } from './components/GenerationDraftPanel';
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

//定义请求状态类型

type InputValidationStatus = {
  requestId: string;
  status: 'pending' | 'success' | 'error';
  message: string;
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
  const [generationRange, setGenerationRange] =
    useState<GenerationRange | null>(null);
  const [preferences, setPreferences] = 
    useState<LearningPreferences>({
    goal: 'understand',
    level: 'beginner',
    detail: 'concise',

  });
  const [validationState, setValidationState] =
    useState<InputValidationStatus | null>(null);
  
  const isValidating = validationState?.status === 'pending';
  
  const [preparedInput,setPreparedInput] = useState<GenerationInputSnapshot | null>(null);

  const visibleValidation =
    validationState?.requestId === preparedInput?.requestId
      ? validationState
      : null;


  const activeRange = generationRange?.documentId === selectedDocument?.id
    ? generationRange
    : null;
  const generationSource = getGenerationSource(selectedDocument, activeRange);
  

  //确认函数
  // 生成前置校验：拦截无效状态，确定生成范围，并打包当前数据快照。
  function handlePrepareGenerationInput(){
    if (
      loadError ||
      isReadingFile ||
      isValidating ||
      !selectedDocument ||
      generationSource.error
    ) {
      return;
    }

    const range: GenerationRange = 
      activeRange?.mode === 'selection'
      ?{...activeRange}
      :{
        documentId:selectedDocument.id,
        mode:'whole',
        start:0,
        end:normalizeSourceText(selectedDocument.content).length,
      };
    const snapshot: GenerationInputSnapshot = {
      requestId: crypto.randomUUID(),
      documentId: selectedDocument.id,
      documentTitle: selectedDocument.title,
      sourceText: generationSource.text,
      characterCount: generationSource.count,
      range,
      preferences:{...preferences},
      createdAt: new Date().toISOString(),
    };
    setPreparedInput(snapshot);
    };

  async function handleValidatePreparedInput() {
    if(!preparedInput || isValidating || loadError){
      return;
    }

    const input = preparedInput;

    setValidationState({
      requestId: input.requestId,
      status: 'pending',
      message: '正在检查生成输入...',
    });

    try{
      const result = await validateGenerationInput(input);
      setValidationState({
        requestId: input.requestId,
        status:  'success' ,
        message: `检验通过,共 ${result.characterCount} 个字符`,
      });
    } catch (error) {
      const message = 
        error instanceof DOMException && error.name === 'TimeoutError'
        ? '请求超时，请检查网络连接'
        : error instanceof TypeError
          ? '无法连接服务，请检查后端是否启动'
          :error instanceof Error
            ? error.message
              : '输入校验失败，请重试';

      setValidationState({
        requestId: input.requestId,
        status: 'error',
        message: message,
      });
    }
    
  }    
 
  function handleSelectDocument(id: string) {
    setSelectedId(id);
    setGenerationRange(null);
  }

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
        format:file.name.toLowerCase().endsWith('md') ? 'markdown' : 'text',
      };
      setDocuments((previousDocuments) => [newDocument, ...previousDocuments]);

      setSelectedId(newDocument.id);
      setGenerationRange(null);
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

  if(preparedInput?.documentId === id){
    setPreparedInput(null);
  }

  setNotesById((previousNotes) => {
    const nextNotes = { ...previousNotes };

    delete nextNotes[id];

    return nextNotes;
  });

  if (selectedId === id) {
    setSelectedId(remainingDocuments[0]?.id ?? '');
    setGenerationRange(null);
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
          onSelect={handleSelectDocument}
          onImport={handleReadNotes}
          searchQuery={searchQuery}
          projects={initialProjects}
          deleteDisabled={Boolean(loadError) || isReadingFile}
          onDelete={handleDeleteDocument}
/>

      <DocumentReader document={selectedDocument} />
      <div className="workspace-column">
        <GenerationRangePicker
          document={selectedDocument}
          range={activeRange}
          disabled={Boolean(loadError) || isReadingFile}
          onChange={setGenerationRange}
        />
        <p role="status">
          已选 {generationSource.count} / {generationSource.limit} 个字符
        </p>
        {generationSource.error && (
          <p role="alert">{generationSource.error}</p>
        )}
        <details>
          <summary>查看本次选定原文</summary>
          <pre className="source-preview">{generationSource.text}</pre>
        </details>
        <LearningPreferencesForm
          preferences={preferences}
          onChange={setPreferences}
        />

        <button
          type="button"
          disabled={
            Boolean(loadError) ||
            isReadingFile ||
            isValidating ||
            Boolean(generationSource.error)
          }
          onClick={handlePrepareGenerationInput}
        >
          确认本次生成输入
        </button>

        {preparedInput && (
          <details open>
            <summary>最近一次确认输入</summary>

            <p>来源：{preparedInput.documentTitle}</p>

            <p>
              范围：
              {preparedInput.range.mode === 'whole'
              ?'整篇资料'
              :'选定片段'}
            , 共{preparedInput.characterCount}个字符  

            </p>

            <p>
              学习目标：
              {{
                understand: '理解',
                review: '复习',
                interview: '面试',
              }[preparedInput.preferences.goal]}
            </p>

            <p>
              当前基础：
              {preparedInput.preferences.level === 'beginner'
              ?'初次掌握'
              :'已经学过'}
            </p>

            <p>
              内容详略：
              {preparedInput.preferences.detail === 'concise'
              ?'简洁'
              :'详细'}
            </p>

            <pre className="source-preview">
              {preparedInput.sourceText}
            </pre>

            <p>修改来源或偏好后，请重新确认</p>
            <button
              type="button"
              disabled={
                Boolean(loadError) ||
                isValidating
              }
              onClick={handleValidatePreparedInput}
            >
              {isValidating ? '正在验证...' : '验证输入'}
            </button>

            {visibleValidation && (
              <p role ={
                visibleValidation.status === 'error'
                ? 'alert'
                : 'status'
              }>
                {visibleValidation.message}
              </p>
            )}
             
          </details>
        )}
        {preparedInput && (
          <GenerationDraftPanel
            key={preparedInput.requestId}
            input={preparedInput}
            disabled={
              Boolean(loadError) ||
              isReadingFile ||
              isValidating
            }
          />
        )}
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
  </div>
  )
}  

export default App


