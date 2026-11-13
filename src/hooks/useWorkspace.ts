import { useState } from 'react';
import type { StudyDocument } from '../types/document';
import { DEFAULT_PROJECT_ID } from '../data/initialProjects';
import {
  loadWorkspace,
  saveWorkspace,
} from '../services/workspaceStorage';
import { validateTextFile } from '../utils/textFile';

function createWorkspaceSnapshot(
  documents: StudyDocument[],
  notes: Record<string, string>,
): string {
  const normalizedNotes = Object.fromEntries(
    Object.entries(notes)
      .filter(([, content]) => content !== '')
      .sort(([idA], [idB]) => idA.localeCompare(idB)),
  );

  return JSON.stringify({
    documents,
    notes: normalizedNotes,
  });
}

export function useWorkspace() {
  // 1. 初始化：读取本地数据，建立唯一的数据来源。
  const [loadResult] = useState(loadWorkspace);

  const [documents, setDocuments] =
    useState<StudyDocument[]>(loadResult.documents);

  const [selectedId, setSelectedId] =
    useState(loadResult.documents[0]?.id ?? '');

  const [notesById, setNotesById] =
    useState<Record<string, string>>(loadResult.notes);

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    createWorkspaceSnapshot(loadResult.documents, loadResult.notes),
  );

  const [saveMessage, setSaveMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);

  // 2. 根据状态计算当前页面需要的数据。
  const loadError = loadResult.error;
  const selectedDocument = documents.find((doc) => doc.id === selectedId);
  const note = notesById[selectedId] ?? '';

  const currentSnapshot = createWorkspaceSnapshot(documents, notesById);
  const hasUnsavedChanges =
    !loadError && currentSnapshot !== savedSnapshot;

  // 3. 对外提供有明确含义的操作。
  function selectDocument(id: string) {
    setSelectedId(id);
  }

  async function importDocument(file: File): Promise<boolean> {
    if (loadError) {
      setImportMessage('读取异常尚未解决，暂时无法导入资料');
      return false;
    }

    if (isReadingFile) {
      return false;
    }

    const errorMessage = validateTextFile(file);

    if (errorMessage) {
      setImportMessage(errorMessage);
      return false;
    }

    setIsReadingFile(true);
    setImportMessage('正在读取并检查文件...');

    try {
      const buffer = await file.arrayBuffer();
      const content = new TextDecoder('utf-8', {
        fatal: true,
      }).decode(buffer);

      if (content.includes('\u0000')) {
        setImportMessage('文件包含异常内容，请选择正常的文本文件');
        return false;
      }

      if (content.trim() === '') {
        setImportMessage('文件内容为空，请选择包含正文的文件');
        return false;
      }

      const newDocument: StudyDocument = {
        id: crypto.randomUUID(),
        projectId: DEFAULT_PROJECT_ID,
        title:
          file.name.replace(/\.(txt|md)$/i, '').trim() || '未命名资料',
        content,
        format: file.name.toLowerCase().endsWith('.md')
          ? 'markdown'
          : 'text',
      };

      setDocuments((previous) => [newDocument, ...previous]);
      setSelectedId(newDocument.id);
      setSaveMessage('');
      setImportMessage(`已导入:${newDocument.title}`);

      return true;
    } catch (error) {
      console.error('读取文件失败', error);
      setImportMessage('读取文件失败，请检查文件格式或内容');
      return false;
    } finally {
      setIsReadingFile(false);
    }
  }

  function updateDocumentNote(id: string, content: string): boolean {
    if (loadError || !documents.some((doc) => doc.id === id)) {
      return false;
    }

    setNotesById((previous) => ({
      ...previous,
      [id]: content,
    }));
    setSaveMessage('');

    return true;
  }

  function deleteDocument(id: string): boolean {
    if (
      loadError ||
      isReadingFile ||
      !documents.some((doc) => doc.id === id)
    ) {
      return false;
    }

    const remainingDocuments = documents.filter((doc) => doc.id !== id);

    setDocuments(remainingDocuments);

    setNotesById((previous) => {
      const nextNotes = { ...previous };
      delete nextNotes[id];
      return nextNotes;
    });

    if (selectedId === id) {
      setSelectedId(remainingDocuments[0]?.id ?? '');
    }

    setImportMessage('');
    setSaveMessage('');

    return true;
  }

  function saveNotes() {
    if (loadError) {
      setSaveMessage('读取异常尚未解决，暂时无法保存笔记');
      return;
    }

    if (isReadingFile) {
      setSaveMessage('正在读取文件，请稍后保存笔记');
      return;
    }

    try {
      saveWorkspace(documents, notesById);
      setSavedSnapshot(currentSnapshot);
      setSaveMessage('全部笔记已保存到当前浏览器');
    } catch (error) {
      console.error('保存笔记失败', error);
      setSaveMessage('保存失败，修改仍保留在当前页面，请稍后重试');
    }
  }

  // 4. 暴露数据和业务操作，内部 setter 留在 Hook 中。
  return {
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
    saveNotes,
  };
}