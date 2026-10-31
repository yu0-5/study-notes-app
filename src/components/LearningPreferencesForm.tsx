import type { LearningPreferences } from '../types/generation';

type LearningPreferencesFormProps = {
  preferences: LearningPreferences;
  onChange: (value: LearningPreferences) => void;
};

export function LearningPreferencesForm({
  preferences,
  onChange,
}: LearningPreferencesFormProps) {
  return (
    <fieldset className="learning-preferences">
      <legend>本次学习偏好</legend>

      <label>
        学习目标
        <select
            value={preferences.goal}
            onChange={(event) => {
            const goal = event.target.value;

            if (
                goal !== 'understand' &&
                goal !== 'review' &&
                goal !== 'interview'
            ) {
                return;
            }

            onChange({ ...preferences, goal });
            }}
        >
            <option value="understand">学习理解</option>
            <option value="review">复习整理</option>
            <option value="interview">面试准备</option>
        </select>
        </label>

        <label>
        当前基础
        <select
            value={preferences.level}
            onChange={(event) => {
            const level = event.target.value;

            if (level !== 'beginner' && level !== 'learned') {
                return;
            }

            onChange({ ...preferences, level });
            }}
        >
            <option value="beginner">初次接触</option>
            <option value="learned">已经学过</option>
        </select>
        </label>

        <label>
        内容详略
        <select
            value={preferences.detail}
            onChange={(event) => {
            const detail = event.target.value;

            if (detail !== 'concise' && detail !== 'detailed') {
                return;
            }

            onChange({ ...preferences, detail });
            }}
        >
            <option value="concise">精简</option>
            <option value="detailed">详细</option>
        </select>
        </label>
            </fieldset>
  );
}