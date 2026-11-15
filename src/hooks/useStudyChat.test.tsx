import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudyDocument } from '../types/document';
import { streamDemoChat } from '../services/demoChat';
import { useStudyChat } from './useStudyChat';

vi.mock('../services/demoChat', () => ({ streamDemoChat: vi.fn() }));

type ReplyOptions = Parameters<typeof streamDemoChat>[0];
type PendingReply = ReplyOptions & {
  resolve: () => void;
  reject: (error: Error) => void;
};

const docA: StudyDocument = {
  id: 'a', projectId: 'project-default', title: '资料 A',
  content: 'A 的正文', format: 'text',
};
const docB: StudyDocument = { ...docA, id: 'b', title: '资料 B' };
let replies: PendingReply[];

function renderChat(document: StudyDocument | undefined = docA) {
  return renderHook<
    ReturnType<typeof useStudyChat>,
    { document: StudyDocument | undefined; disabled: boolean }
  >(
    ({ document, disabled }) => useStudyChat(document, disabled),
    { initialProps: { document, disabled: false } },
  );
}

function startChat(chat: ReturnType<typeof renderChat>, question = '问题 A') {
  act(() => chat.result.current.changeDraft(question));
  act(() => { void chat.result.current.send(); });
}

beforeEach(() => {
  replies = [];
  vi.mocked(streamDemoChat).mockReset();
  // 故意不响应 abort：模拟取消后仍迟到的第三方回调。
  vi.mocked(streamDemoChat).mockImplementation((options) =>
    new Promise<void>((resolve, reject) => {
      replies.push({ ...options, resolve, reject });
    }),
  );
});

afterEach(cleanup);

describe('按资料隔离的会话和任务生命周期', () => {
  it('切换资料保留各自草稿，回答始终写入启动时的来源', async () => {
    const chat = renderChat();
    startChat(chat, '  问题 A  ');
    act(() => chat.result.current.changeDraft('A 的下一问'));
    chat.rerender({ document: docB, disabled: false });
    act(() => chat.result.current.changeDraft('B 的草稿'));
    await act(async () => {
      replies[0].onDelta('A 的回答');
      replies[0].resolve();
    });
    expect(chat.result.current.messages).toEqual([]);
    expect(chat.result.current.draft).toBe('B 的草稿');
    chat.rerender({ document: docA, disabled: false });
    expect(chat.result.current.draft).toBe('A 的下一问');
    expect(chat.result.current.messages.map((message) => message.content))
      .toEqual(['问题 A', 'A 的回答']);
    expect(chat.result.current.messages[1].status).toBe('completed');
  });

  it.each(['resolve', 'reject'] as const)(
    '清理活动资料立即取消并解锁，旧任务 %s 不会复活会话或解锁新任务',
    async (settlement) => {
      const chat = renderChat();
      startChat(chat);
      act(() => chat.result.current.changeDraft('待删除草稿'));
      act(() => chat.result.current.clearDocument(docA.id));
      expect(replies[0].signal.aborted).toBe(true);
      expect(chat.result.current.isReplying).toBe(false);
      expect(chat.result.current.messages).toEqual([]);
      expect(chat.result.current.draft).toBe('');

      chat.rerender({ document: docB, disabled: false });
      startChat(chat, '问题 B');
      await act(async () => {
        replies[0].onDelta('不应出现的迟到回答');
        if (settlement === 'resolve') replies[0].resolve();
        else replies[0].reject(new Error('迟到的失败'));
      });
      expect(chat.result.current.isReplying).toBe(true);
      expect(chat.result.current.replyingTo).toBe(docB.title);
      expect(replies[1].signal.aborted).toBe(false);

      chat.rerender({ document: docA, disabled: false });
      expect(chat.result.current.messages).toEqual([]);
      expect(chat.result.current.draft).toBe('');
      chat.rerender({ document: docB, disabled: false });
      await act(async () => {
        replies[1].onDelta('B 的正常回答');
        replies[1].resolve();
      });
      expect(chat.result.current.messages[1].content).toBe('B 的正常回答');
      expect(chat.result.current.isReplying).toBe(false);
    },
  );

  it('清理其他资料不会停止当前回答，也不会删除当前草稿', async () => {
    const chat = renderChat();
    startChat(chat);
    await act(async () => { replies[0].resolve(); });
    act(() => chat.result.current.changeDraft('A 草稿'));
    chat.rerender({ document: docB, disabled: false });
    startChat(chat, '问题 B');
    act(() => chat.result.current.changeDraft('B 草稿'));
    act(() => chat.result.current.clearDocument(docA.id));
    expect(replies[1].signal.aborted).toBe(false);
    expect(chat.result.current.isReplying).toBe(true);
    expect(chat.result.current.draft).toBe('B 草稿');
    expect(chat.result.current.messages).toHaveLength(2);
    chat.rerender({ document: docA, disabled: false });
    expect(chat.result.current.messages).toEqual([]);
    expect(chat.result.current.draft).toBe('');
  });

  it('停止后保留片段，重试复用回答 ID、原问题且保留下一问', async () => {
    const chat = renderChat();
    startChat(chat);
    act(() => replies[0].onDelta('未完成片段'));
    act(() => chat.result.current.changeDraft('下一问'));
    const answerId = chat.result.current.messages[1].id;
    await act(async () => {
      chat.result.current.stop();
      replies[0].reject(new DOMException('已停止', 'AbortError'));
    });
    expect(chat.result.current.messages[1].content).toBe('未完成片段');
    expect(chat.result.current.retryableMessageId).toBe(answerId);
    act(() => { void chat.result.current.retryLastReply(); });
    expect(chat.result.current.messages).toHaveLength(2);
    expect(chat.result.current.messages[1].id).toBe(answerId);
    expect(chat.result.current.messages[1].content).toBe('');
    expect(chat.result.current.draft).toBe('下一问');
    expect(replies[1].question).toBe('问题 A');
    await act(async () => {
      replies[1].onDelta('重新回答');
      replies[1].resolve();
    });
    expect(chat.result.current.retryableMessageId).toBeNull();
    expect(chat.result.current.messages[1].status).toBe('completed');
  });

  it('失败后显示错误并允许重试，重试时清除旧错误', async () => {
    const chat = renderChat();
    startChat(chat);
    await act(async () => { replies[0].reject(new Error('模拟故障')); });
    expect(chat.result.current.messages[1].status).toBe('error');
    expect(chat.result.current.messages[1].error).toBe('模拟故障');
    act(() => { void chat.result.current.retryLastReply(); });
    expect(chat.result.current.messages[1].status).toBe('streaming');
    expect(chat.result.current.messages[1].error).toBeUndefined();
  });

  it('同步重复发送与跨资料发送都受到活动任务锁保护', () => {
    const chat = renderChat();
    act(() => chat.result.current.changeDraft('第一问'));
    act(() => {
      void chat.result.current.send();
      void chat.result.current.send();
    });
    expect(replies).toHaveLength(1);
    chat.rerender({ document: docB, disabled: false });
    act(() => chat.result.current.changeDraft('另一份资料的问题'));
    act(() => { void chat.result.current.send(); });
    expect(replies).toHaveLength(1);
    expect(chat.result.current.messages).toEqual([]);
  });

  it.each(['   ', '😀'.repeat(1001)])('空白或超长问题不能启动回答', (question) => {
    const chat = renderChat();
    startChat(chat, question);
    expect(replies).toHaveLength(0);
    expect(chat.result.current.messages).toEqual([]);
  });

  it('允许恰好 1000 个 Unicode 码点，禁用和无资料时不可发送', () => {
    const chat = renderChat();
    startChat(chat, '😀'.repeat(1000));
    expect(replies).toHaveLength(1);
    act(() => chat.result.current.clearDocument(docA.id));
    chat.rerender({ document: docB, disabled: true });
    startChat(chat, '禁用时的问题');
    chat.rerender({ document: undefined, disabled: false });
    startChat(chat, '没有资料的问题');
    expect(replies).toHaveLength(1);
  });

  it('卸载会取消任务，卸载后到达的回调也可安全结束', async () => {
    const chat = renderChat();
    startChat(chat);
    chat.unmount();
    expect(replies[0].signal.aborted).toBe(true);
    await act(async () => {
      replies[0].onDelta('卸载后的片段');
      replies[0].resolve();
    });
  });
});
