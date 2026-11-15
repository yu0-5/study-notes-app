import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

// 测试真实的 Hook、组件与模拟服务；禁止任何意外的网络/模型请求。
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('此测试禁止网络请求'); }));
  localStorage.clear();
  localStorage.setItem('study-workspace-v1', JSON.stringify({
    documents: [
      { id: 'a', projectId: 'project-default', title: '资料 A', content: 'A 正文', format: 'text' },
      { id: 'b', projectId: 'project-default', title: '资料 B', content: 'B 正文', format: 'text' },
    ],
    notes: { a: 'A 已保存笔记', b: 'B 已保存笔记' },
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function openChat() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '资料 A' }));
  fireEvent.click(screen.getByRole('button', { name: '资料问答' }));
  fireEvent.change(screen.getByRole('textbox', { name: '针对当前资料提问' }), {
    target: { value: '解释一下这个概念' },
  });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  fireEvent.click(screen.getByRole('button', { name: '资料' }));
}

describe('删除资料的页面联动', () => {
  it('取消删除保留资料、下一问和正在进行的回答', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    openChat();
    fireEvent.change(screen.getByRole('textbox', { name: '针对当前资料提问' }), {
      target: { value: '下一问' },
    });
    fireEvent.click(screen.getByRole('button', { name: '删除资料：资料 A' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '停止回答' })).toBeDefined();
    expect((screen.getByRole('textbox', { name: '针对当前资料提问' }) as HTMLTextAreaElement).value)
      .toBe('下一问');
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByText('模拟回答已完成。')).toBeDefined();
    expect(screen.getByRole('button', { name: '删除资料：资料 A' })).toBeDefined();
  });

  it('删除正在回答的资料取消任务，剩余资料可立即继续提问，保存后删除才持久化', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openChat();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    fireEvent.click(screen.getByRole('button', { name: '删除资料：资料 A' }));
    expect(screen.queryByRole('button', { name: '删除资料：资料 A' })).toBeNull();
    expect(screen.queryByRole('button', { name: '停止回答' })).toBeNull();
    expect(screen.getByText('从一个不理解的概念开始提问吧。')).toBeDefined();
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.change(screen.getByRole('textbox', { name: '针对当前资料提问' }), {
      target: { value: 'B 的新问题' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByText('模拟回答已完成。')).toBeDefined();
    expect(screen.queryByText('解释一下这个概念', { exact: true })).toBeNull();

    const before = JSON.parse(localStorage.getItem('study-workspace-v1')!);
    expect(before.documents).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: '我的笔记' }));
    fireEvent.click(screen.getByRole('button', { name: '保存全部资料与笔记' }));
    const after = JSON.parse(localStorage.getItem('study-workspace-v1')!);
    expect(after.documents.map((doc: { id: string }) => doc.id)).toEqual(['b']);
    expect(after.notes).toEqual({ b: 'B 已保存笔记' });
    expect(after).not.toHaveProperty('messages');
  });

  it('删除其他资料不影响当前资料的模拟回答', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openChat();
    fireEvent.click(screen.getByRole('button', { name: '删除资料：资料 B' }));
    expect(screen.getByRole('button', { name: '停止回答' })).toBeDefined();
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByText('模拟回答已完成。')).toBeDefined();
    expect(screen.getByRole('button', { name: '删除资料：资料 A' })).toBeDefined();
  });

  it('删除最后一份资料进入空态并禁用提问', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openChat();
    fireEvent.click(screen.getByRole('button', { name: '删除资料：资料 A' }));
    fireEvent.click(screen.getByRole('button', { name: '删除资料：资料 B' }));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect((screen.getByRole('textbox', { name: '针对当前资料提问' }) as HTMLTextAreaElement).disabled)
      .toBe(true);
    expect(screen.queryByRole('button', { name: '停止回答' })).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
