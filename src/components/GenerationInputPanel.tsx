import type { StudyDocument } from '../types/document';
import type {
  GenerationRange,
  LearningPreferences,
  GenerationInputSnapshot,
  InputValidationStatus,
} from '../types/generation';
import type { getGenerationSource } from '../utils/generationRange';
import { GenerationRangePicker } from './GenerationRangePicker';
import { LearningPreferencesForm } from './LearningPreferencesForm';

type GenerationInputPanelProps = {
  document: StudyDocument | undefined;
  range: GenerationRange | null;
  source: ReturnType<typeof getGenerationSource>;
  preferences: LearningPreferences;
  input: GenerationInputSnapshot | null;
  validation: InputValidationStatus | null;

  isValidating: boolean;
  rangeDisabled: boolean;
  prepareDisabled: boolean;
  validateDisabled: boolean;

  onRangeChange: (range: GenerationRange) => void;
  onPreferencesChange: (preferences: LearningPreferences) => void;
  onPrepare: () => void;
  onValidate: () => void;
};

export function GenerationInputPanel({
  document,
  range,
  source,
  preferences,
  input,
  validation,
  isValidating,
  rangeDisabled,
  prepareDisabled,
  validateDisabled,
  onRangeChange,
  onPreferencesChange,
  onPrepare,
  onValidate,
}: GenerationInputPanelProps) {
  return (
    <section
      className="generation-input-panel"
      aria-label="生成输入配置"
    >
      <GenerationRangePicker
        document={document}
        range={range}
        disabled={rangeDisabled}
        onChange={onRangeChange}
      />

      <p role="status">
        已选 {source.count} / {source.limit} 个字符
      </p>

      {source.error && <p role="alert">{source.error}</p>}

      <details>
        <summary>查看本次选定原文</summary>
        <pre className="source-preview">{source.text}</pre>
      </details>

      <LearningPreferencesForm
        preferences={preferences}
        onChange={onPreferencesChange}
      />

      <button
        type="button"
        disabled={prepareDisabled}
        onClick={onPrepare}
      >
        确认本次生成输入
      </button>

      {input && (
        <details open>
          <summary>最近一次确认输入</summary>

          <p>来源：{input.documentTitle}</p>

          <p>
            范围：
            {input.range.mode === 'whole' ? '整篇资料' : '选定片段'}
            ，共 {input.characterCount} 个字符
          </p>

          <p>
            学习目标：
            {{
              understand: '理解',
              review: '复习',
              interview: '面试',
            }[input.preferences.goal]}
          </p>

          <p>
            当前基础：
            {input.preferences.level === 'beginner'
              ? '初次掌握'
              : '已经学过'}
          </p>

          <p>
            内容详略：
            {input.preferences.detail === 'concise' ? '简洁' : '详细'}
          </p>

          <pre className="source-preview">{input.sourceText}</pre>

          <p>修改来源或偏好后，请重新确认</p>

          <button
            type="button"
            disabled={validateDisabled}
            onClick={onValidate}
          >
            {isValidating ? '正在验证...' : '验证输入'}
          </button>

          {validation && (
            <p role={validation.status === 'error' ? 'alert' : 'status'}>
              {validation.message}
            </p>
          )}
        </details>
      )}
    </section>
  );
}