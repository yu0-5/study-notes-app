import{useEffect, useRef, useState } from 'react'
import './App.css'
import { initialProjects } from './data/initialProjects';
import { DocumentReader } from './components/DocumentReader';
import { DocumentSidebar } from './components/DocumentSidebar';
import { NoteEditor } from './components/NoteEditor';

import type {
  GenerationRange,
  LearningPreferences,
  GenerationInputSnapshot,
  InputValidationStatus,
 } from './types/generation';

import { getGenerationSource, normalizeSourceText } from './utils/generationRange';
import { 
  validateGenerationInput,
  type GeneratedDraft,
 } from './services/generationApi';
import { GenerationDraftPanel } from './components/GenerationDraftPanel';
import { HomePage } from './components/HomePage';
import { GenerationInputPanel } from './components/GenerationInputPanel';
import { RightWorkspace, type RightPanel } from './components/RightWorkspace';
import { useWorkspace } from './hooks/useWorkspace';
import { AiAssistantPanel } from './components/AiAssistantPanel';
//建立页面状态
function App() {
  const {
    documents,
    selectedId,
    notesById,
    selectedDocument,
    note,
    loadError,
    saveMessage,
    importMessage,
    isReadingFile,
    hasUnsavedChanges,
    selectDocument,
    importDocument,
    updateDocumentNote,
    deleteDocument,
    saveNotes: handleSaveNotes,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [view, setView] = useState<'home' | 'workspace'>('home');
  const [activePanel, setActivePanel] = useState<RightPanel>('ai');
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
  
  const adoptedDraftIdsRef = useRef(new Set<string>());//用于防重复记录的引用
  const [hasCandidateEdits, setHasCandidateEdits] = useState(false);//表示是否有未保存修改的状态

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
    
    if(
      hasCandidateEdits &&
      !window.confirm('重新确认输入会清除候选修改，是否继续？')
    ){
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
    selectDocument(id);
    setGenerationRange(null);
  }

  async function handleReadNotes(file: File) {
    const imported = await importDocument(file);

    if (!imported) {
      return;
    }

    setGenerationRange(null);
    setSearchQuery('');
    setIsLibraryOpen(false);
    setActivePanel('ai');
    setView('workspace');
  }

  function handleNoteChange(content: string) {
    updateDocumentNote(selectedId, content);
  }
const keyword = searchQuery.trim().toLowerCase();

//处理用户点击“采纳（追加）草稿”到笔记的操作函数
function handleAdoptDraft(draft: GeneratedDraft, content: string) {
   if(loadError || isReadingFile){
    return{
      ok: false,
      message: '当前暂时无法追加笔记',
    };
 }

  if(
    !preparedInput ||
    draft.requestId !== preparedInput.requestId ||
    draft.documentId !== preparedInput.documentId
  ){
    return{
      ok: false,
      message: '候选与当前确认的输入不匹配',
    };
  }

  const sourceExists = documents.some(
    (document) => document.id === draft.documentId,
  );

  if(!sourceExists || selectedId !== draft.documentId){
    return{
      ok: false,
      message: '请先切回候选的来源资料，再追加笔记',
    };
  }

  if(adoptedDraftIdsRef.current.has(draft.id)){
    return{
      ok: false,
      message: '这份候选已经追加过了',
    };
  }

  if(content.trim() === ''){
    return{
      ok: false,
      message: '候选内容不能为空',
    };
  }

  const existingNote = notesById[draft.documentId] ?? '';

  const nextNote = existingNote.trim() === ''
    ? existingNote + content
    : `${existingNote}\n\n---\n\n${content}`;

  if (Array.from(nextNote).length > 20000) {
    return{
      ok: false,
      message: '追加后笔记超过 20000 个字符，请精简候选内容',
    };
  }

  const updated = updateDocumentNote(draft.documentId, nextNote);

  if (!updated) {
    return {
      ok: false,
      message: '当前暂时无法追加笔记',
    };
  }

  adoptedDraftIdsRef.current.add(draft.id);
  setActivePanel('notes');

  return{
    ok: true,
    message: '已追加到我的笔记，请点击保存',
  };
}  
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

  const deleted = deleteDocument(id);

  if (!deleted) {
    return;
  }

  if(preparedInput?.documentId === id){
    setPreparedInput(null);
  }

  if (selectedId === id) {
    setGenerationRange(null);
    setSearchQuery('');
  }
}

const visibleDocuments = documents.filter((doc) =>
  doc.title.toLowerCase().includes(keyword)
);

useEffect(() => {
  if(!hasUnsavedChanges && !hasCandidateEdits){
    return;
  }

  function handleBeforeUnload(event: BeforeUnloadEvent){
    event.preventDefault();
    
  }

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
},[hasUnsavedChanges, hasCandidateEdits]);

  return (
    <div className="app-shell">
      <nav className="app-rail" aria-label="工作台工具">
        <span className="app-brand" title="AI资料研读工作台">
          研
        </span>

        <button
          type="button"
          aria-current={view === 'home' ? 'page' : undefined}
          onClick={() => setView('home')}
        >
          首页
        </button>

        <button
          type="button"
          aria-expanded={isLibraryOpen}
          aria-controls="document-library"
          onClick={() => {
            setView('workspace');
            setIsLibraryOpen(
              view === 'home' ? true : !isLibraryOpen
            );
          }}
        >
          资料
        </button>
      </nav>

      <div
        className={
          view === 'home'
            ? 'app-main app-main--home'
            : 'app-main'
        }
      >
        {view === 'home' && (
          <HomePage
            documents={documents}
            disabled={isReadingFile || Boolean(loadError)}
            message={loadError || importMessage}
            onImport={handleReadNotes}
            onOpenDocument={(id) => {
              handleSelectDocument(id);
              setIsLibraryOpen(false);
              setView('workspace');
            }}
          />
        )}
        <header className="app-header" hidden={view === 'home'}>
          <h1>AI资料研读工作台</h1>
          <p>{selectedDocument?.title ?? '请选择或导入学习资料'}</p>
        </header>
    

    <div
      className={
        isLibraryOpen
          ? 'workspace workspace--library-open'//资料栏展开时，给工作区增加一个类名，CSS 据此切换列数
          : 'workspace'
      }
      hidden={view === 'home'}
    >
      <section
        id="document-library"
        className="document-library"
        aria-label="资料管理"
        hidden={!isLibraryOpen}
      >
        <div className="library-header">
          <strong>资料管理</strong>

          <button
            type="button"
            onClick={() => setIsLibraryOpen(false)}
          >
            收起
          </button>
        </div>

        {<div className="workspace-toolbar">
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
        </div>}

        {<DocumentSidebar
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
/>}
      </section>
      <DocumentReader document={selectedDocument} />
      <RightWorkspace
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        aiPanel={
          <AiAssistantPanel
            document={selectedDocument}
            disabled={Boolean(loadError) || isReadingFile}
            generationPanel={
              <>
            <GenerationInputPanel
              document={selectedDocument}
              range={activeRange}
              source={generationSource}
              preferences={preferences}
              input={preparedInput}
              validation={visibleValidation}
              isValidating={isValidating}
              rangeDisabled={Boolean(loadError) || isReadingFile}
              prepareDisabled={
                Boolean(loadError) ||
                isReadingFile ||
                isValidating ||
                Boolean(generationSource.error)
              }
              validateDisabled={Boolean(loadError) || isValidating}
              onRangeChange={setGenerationRange}
              onPreferencesChange={setPreferences}
              onPrepare={handlePrepareGenerationInput}
              onValidate={handleValidatePreparedInput}
            />
            {preparedInput && (
              <GenerationDraftPanel
                key={preparedInput.requestId}
                input={preparedInput}
                disabled={
                  Boolean(loadError) ||
                  isReadingFile ||
                  isValidating
                }
                onAdopt={handleAdoptDraft}
                onDirtyChange={setHasCandidateEdits}
              />
            )}
          </>
          }
          />
        }
        notesPanel={
          <NoteEditor
            documentTitle={selectedDocument?.title ?? '未选择资料'}
            note={note}
            loadError={loadError}
            editDisabled={Boolean(loadError) || !selectedDocument}
            saveDisabled={Boolean(loadError) || isReadingFile}
            saveMessage={
              hasUnsavedChanges
                ? `有修改尚未保存${saveMessage ? `; ${saveMessage}` : ''}`
                : saveMessage
            }
            onNoteChange={handleNoteChange}
            onSave={handleSaveNotes}
          />
        }
      />
        </div>
      </div>
    </div>
  );
}
export default App;
