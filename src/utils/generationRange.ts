import type { StudyDocument } from '../types/document';
import type { GenerationRange } from '../types/generation';

const WHOLE_SOURCE_LIMIT = 12000;
const SELECTION_SOURCE_LIMIT = 6000;

// textarea 会统一换行；计算选区时也使用相同原文，避免偏移错位。
export function normalizeSourceText(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

export function getGenerationSource(
  document: StudyDocument | undefined,
  range: GenerationRange | null
) {
  const activeRange = range?.documentId === document?.id ? range : null;
  const isSelection = activeRange?.mode === 'selection';
  const limit = isSelection ? SELECTION_SOURCE_LIMIT : WHOLE_SOURCE_LIMIT;

  if (!document) {
    return { text: '', count: 0, limit, error: '请先选择资料' };
  }

  const content = normalizeSourceText(document.content);

  if (
    activeRange?.mode === 'selection' &&
    (!Number.isInteger(activeRange.start) ||
      !Number.isInteger(activeRange.end) ||
      activeRange.start < 0 ||
      activeRange.end < activeRange.start ||
      activeRange.end > content.length)
  ) {
    return { text: '', count: 0, limit, error: '选区位置无效，请重新选择' };
  }

  const text = activeRange?.mode === 'selection'
    ? content.slice(activeRange.start, activeRange.end)
    : content;
  const count = Array.from(text).length;
  const error = text.trim() === ''
    ? '请选择包含正文的范围'
    : count > limit
      ? `当前范围超过 ${limit} 个字符，请缩小范围`
      : '';

  return { text, count, limit, error };
}
