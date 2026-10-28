import type { StudyDocument } from '../types/document';
import { initialDocuments } from '../data/initialDocuments';

const WORKSPACE_STORAGE_KEY = 'study-workspace-v1';
const LEGACY_NOTES_STORAGE_KEY = 'study-notes';

type WorkspaceLoadResult = {
  documents: StudyDocument[];
  notes: Record<string, string>;
  error: string;
};

type NotesLoadResult = {
  notes: Record<string, string>;
  error: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

// 没有新版工作台数据时，兼容此前单独保存的笔记。
function loadNotes(): NotesLoadResult {
  try {
    const savedContent = localStorage.getItem(LEGACY_NOTES_STORAGE_KEY);

    if (savedContent === null) {
      return { notes: {}, error: '' };
    }

    const parsed: unknown = JSON.parse(savedContent);

    if (
      !isRecord(parsed) ||
      !Object.values(parsed).every((value) => typeof value === 'string')
    ) {
      throw new Error('保存的笔记数据格式有误');
    }

    return { notes: parsed as Record<string, string>, error: '' };
  } catch (error) {
    console.error('读取笔记失败', error);

    return {
      notes: {},
      error: '读取笔记失败，编辑和保存已暂停，请排查后刷新重试',
    };
  }
}

export function loadWorkspace(): WorkspaceLoadResult {
  try {
    const savedContent = localStorage.getItem(WORKSPACE_STORAGE_KEY);

    if (savedContent === null) {
      const oldResult = loadNotes();

      return {
        documents: initialDocuments,
        notes: oldResult.notes,
        error: oldResult.error,
      };
    }

    const parsed: unknown = JSON.parse(savedContent);

    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.documents) ||
      !parsed.documents.every(
        (doc: unknown) =>
          isRecord(doc) &&
          typeof doc.id === 'string' &&
          doc.id.trim() !== '' &&
          typeof doc.title === 'string' &&
          typeof doc.content === 'string'
      ) ||
      !isRecord(parsed.notes) ||
      !Object.values(parsed.notes).every((value) => typeof value === 'string')
    ) {
      throw new Error('保存的工作台数据格式有误');
    }

    const savedDocuments = parsed.documents as StudyDocument[];
    const ids = savedDocuments.map((doc) => doc.id);

    if (new Set(ids).size !== ids.length) {
      throw new Error('保存的工作台数据中存在重复的文档 ID');
    }

    return {
      documents: savedDocuments,
      notes: parsed.notes as Record<string, string>,
      error: '',
    };
  } catch (error) {
    console.error('读取工作台失败', error);

    return {
      documents: initialDocuments,
      notes: {},
      error: '读取工作台失败，编辑和保存已暂停，请排查后刷新重试',
    };
  }
}

// 由 App 捕获写入异常，并更新页面提示。
export function saveWorkspace(
  documents: StudyDocument[],
  notes: Record<string, string>
): void {
  const json = JSON.stringify({ documents, notes });
  localStorage.setItem(WORKSPACE_STORAGE_KEY, json);
}
