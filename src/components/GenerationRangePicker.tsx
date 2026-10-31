import type { StudyDocument } from '../types/document';
import type { GenerationRange } from '../types/generation';
import { normalizeSourceText } from '../utils/generationRange';

type GenerationRangePickerProps = {
  document: StudyDocument | undefined;
  range: GenerationRange | null;
  disabled: boolean;
  onChange: (range: GenerationRange) => void;
};

export function GenerationRangePicker({
  document,
  range,
  disabled,
  onChange,
}: GenerationRangePickerProps) {
  if (!document) {
    return <p>请选择资料后设置生成范围</p>;
  }

  const content = normalizeSourceText(document.content);
  const mode = range?.documentId === document.id ? range.mode : 'whole';

  return (
    <fieldset className="generation-range" disabled={disabled}>
      <legend>本次生成范围</legend>

      <div className="range-mode-switch">
        <button
          type="button"
          aria-pressed={mode === 'whole'}
          onClick={() => onChange({
            documentId: document.id,
            mode: 'whole',
            start: 0,
            end: content.length,
          })}
        >
          整篇资料
        </button>
        <button
          type="button"
          aria-pressed={mode === 'selection'}
          onClick={() => onChange({
            documentId: document.id,
            mode: 'selection',
            start: 0,
            end: 0,
          })}
        >
          选择片段
        </button>
      </div>

      {mode === 'selection' && (
        <label>
          请在以下原文中选择文字（只读）
          <textarea
            className="source-selection"
            readOnly
            value={content}
            onSelect={(event) => {
              const input = event.currentTarget;
              onChange({
                documentId: document.id,
                mode: 'selection',
                start: input.selectionStart,
                end: input.selectionEnd,
              });
            }}
          />
        </label>
      )}
    </fieldset>
  );
}
