import { useEffect, useRef, useState } from 'react';
import type { GenerationInputSnapshot } from '../types/generation';
import {
  generateDraft,
  type GeneratedDraft,
  type GenerationMode,
} from '../services/generationApi';
import { MarkdownPreview } from './MarkdownPreview';

type GenerationDraftPanelProps = {
  input: GenerationInputSnapshot;
  disabled: boolean;

  onAdopt: (
    draft: GeneratedDraft,
    content: string,
  ) => {
    ok: boolean;
    message: string;
  };

  onDirtyChange: (dirty: boolean) => void;
};

type DraftState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; draft: GeneratedDraft }
  | { status: 'error'; message: string };

export function GenerationDraftPanel({
  input,
  disabled,
  onAdopt,
  onDirtyChange,
}: GenerationDraftPanelProps) {
  const [state, setState] = useState<DraftState>({
    status: 'idle',
  });
  const [editedContent, setEditedContent] = useState('');
  const [isAdopted, setIsAdopted] = useState(false);
  const [adoptionMessage, setAdoptionMessage] = useState('');
  const [mode, setMode] = useState<GenerationMode>('demo');

  const controllerRef = useRef<AbortController | null>(null);
  const isGenerating = state.status === 'pending';
  
  const hasDraftEdits =
    state.status === 'success' &&
    !isAdopted &&
    editedContent !== state.draft.content;
  useEffect(() => {
    onDirtyChange(hasDraftEdits);  

    return () => {
      onDirtyChange(false);
    };
  }, [hasDraftEdits , onDirtyChange]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  function handleAdopt(){
    if (state.status !== 'success' || disabled || isAdopted) {
      return;
    } 
    const result = onAdopt(state.draft, editedContent);
    
    setAdoptionMessage(result.message );

    if (result.ok) {
      setIsAdopted(true);
    } 
  }
  async function handleGenerate() {
    if (disabled || controllerRef.current) {
      return;
    }
    
    if(
      hasDraftEdits &&
      !window.confirm('重新生成会放弃当前候选的修改，是否继续？')
    ){
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    
    setAdoptionMessage('');
    setIsAdopted(false);

    setState({ status: 'pending' });

    try {
      const draft = await generateDraft(
        input,
        mode,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }
      
      setEditedContent(draft.content);
      setState({
        status: 'success',
        draft,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const message =
        error instanceof DOMException &&
        error.name === 'TimeoutError'
          ? '生成请求超时，请重试'
          : error instanceof TypeError
            ? '无法连接服务，请检查后端是否启动'
            : error instanceof Error
              ? error.message
              : '生成失败，请重试';

      setState({
        status: 'error',
        message,
      });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }

  return (
    <section aria-label="候选笔记">
      <h2>候选笔记</h2>

      <label>
        生成方式
        <select
          value={mode}
          disabled={disabled || isGenerating}
          onChange={(event) => {
            const nextMode = event.target.value;

            if (nextMode === 'demo' || nextMode === 'ai') {
              setMode(nextMode);
            }
          }}
        >
          <option value="demo">模拟生成</option>
          <option value="ai">DeepSeek 真实生成</option>
        </select>
      </label>

      <p>
        {mode === 'ai'
          ? '真实生成会将本次确认的资料范围发送给 DeepSeek，并消耗 API 额度。'
          : '模拟生成使用固定模板，不调用模型。'}
      </p>
      <p>输入来源：{input.documentTitle}</p>

      <button
        type="button"
        disabled={disabled || isGenerating}
        onClick={handleGenerate}
      >
        {isGenerating
          ? '正在生成……'
          : mode === 'ai'
            ? '生成 AI 草稿'
            : '生成模拟草稿'}
      </button>

      {state.status === 'pending' && (
        <p role="status">正在等待候选结果……</p>
      )}

      {state.status === 'error' && (
        <p role="alert">{state.message}</p>
      )}

      {state.status === 'success' && (
        <>
          <p>
            本次结果：
            {state.draft.mode === 'ai'
              ? `DeepSeek 生成，模型：${state.draft.model}`
              : '模拟模板'}
          </p>
          <p>
            {isAdopted
              ? '这份候选已追加到个人笔记'
              : '请核对、修改候选，再决定是否追加'}
          </p>

          <label>
            编辑候选正文
            <textarea
              value={editedContent}
              rows={12}
              readOnly={isAdopted}
              onChange={(event) => {
                setEditedContent(event.target.value);
                setAdoptionMessage('');
              }}
            />
          </label>

          <details>
            <summary>预览编辑后的候选</summary>
            <MarkdownPreview content={editedContent} />
          </details>

          <button
            type="button"
            disabled={
              disabled ||
              isAdopted ||
              editedContent.trim() === ''
            }
            onClick={handleAdopt}
          >
            {isAdopted ? '已追加' : '确认追加到我的笔记'}
          </button>

          {adoptionMessage && (
            <p role="status">{adoptionMessage}</p>
          )}
        </>
      )}
    </section>
  );
}
