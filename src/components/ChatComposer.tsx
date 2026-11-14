type ChatComposerProps = {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
};

export function ChatComposer({
  value,
  disabled,
  onChange,
  onSend,
}: ChatComposerProps) {
  const count = Array.from(value).length;

  const canSend =
    !disabled &&
    value.trim() !== '' &&
    count <= 1000;

  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();

        if (canSend) {
          onSend();
        }
      }}
    >
      <label htmlFor="study-chat-question">针对当前资料提问</label>

      <textarea
        id="study-chat-question"
        value={value}
        disabled={disabled}
        placeholder="例如：这个概念能结合例子解释一下吗？"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />

      <div className="chat-composer-actions">
        <span>
          {count} / 1000 · Shift＋Enter 换行
        </span>

        <button type="submit" disabled={!canSend}>
          发送
        </button>
      </div>
    </form>
  );
}