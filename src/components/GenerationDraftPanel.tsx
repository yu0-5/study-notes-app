import { useEffect, useRef, useState } from 'react';
import type { GenerationInputSnapshot } from '../types/generation';
import {
  generateDemoDraft,
  type DemoDraft,
} from '../services/generationApi';
import { MarkdownPreview } from './MarkdownPreview';

type GenerationDraftPanelProps = {
  input: GenerationInputSnapshot;
  disabled: boolean;
};

type DraftState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; draft: DemoDraft }
  | { status: 'error'; message: string };

export function GenerationDraftPanel({
  input,
  disabled,
}: GenerationDraftPanelProps) {
  const [state, setState] = useState<DraftState>({
    status: 'idle',
  });

  const controllerRef = useRef<AbortController | null>(null);
  const isGenerating = state.status === 'pending';

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

    async function handleGenerate() {
    if (disabled || controllerRef.current) {
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    setState({ status: 'pending' });

    try {
      const draft = await generateDemoDraft(
        input,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

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

      <p>模拟模式：尚未调用 AI。</p>
      <p>输入来源：{input.documentTitle}</p>

      <button
        type="button"
        disabled={disabled || isGenerating}
        onClick={handleGenerate}
      >
        {isGenerating ? '正在生成……' : '生成模拟草稿'}
      </button>

      {state.status === 'pending' && (
        <p role="status">正在等待候选结果……</p>
      )}

      {state.status === 'error' && (
        <p role="alert">{state.message}</p>
      )}

      {state.status === 'success' && (
        <>
          <p role="status">
            模拟草稿已生成，尚未加入我的笔记。
          </p>

          <MarkdownPreview content={state.draft.content} />
        </>
      )}
    </section>
  );
}