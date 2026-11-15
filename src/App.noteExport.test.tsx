import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { downloadMarkdownNote } from './utils/noteExport';

vi.mock('./utils/noteExport', async (importOriginal) => ({
  ...await importOriginal<typeof import('./utils/noteExport')>(),
  downloadMarkdownNote: vi.fn(() => '当前笔记.md'),
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('study-workspace-v1', JSON.stringify({
    documents: [
      { id: 'a', projectId: 'project-default', title: '资料 A', content: 'A 原文', format: 'text' },
      { id: 'b', projectId: 'project-default', title: '资料 B', content: 'B 原文', format: 'text' },
    ],
    notes: { a: 'A 已保存笔记', b: 'B 已保存笔记' },
  }));
  vi.mocked(downloadMarkdownNote).mockReset().mockReturnValue('当前笔记.md');
});

afterEach(() => { cleanup(); localStorage.clear(); });

function openNotes() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '资料 A' }));
  fireEvent.click(screen.getByRole('tab', { name: '我的笔记' }));
}

it('导出当前未保存正文，不写本地存储，也不解除离开页面的保护', () => {
  openNotes();
  const saved = localStorage.getItem('study-workspace-v1');
  const current = '  # 尚未保存😀\n\n```ts\n  const x = 1;\n```\n';
  fireEvent.change(screen.getByRole('textbox', { name: '我的笔记' }), { target: { value: current } });
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(downloadMarkdownNote).toHaveBeenCalledWith('资料 A', current);
  expect(localStorage.getItem('study-workspace-v1')).toBe(saved);
  expect(screen.getByText('有修改尚未保存')).toBeDefined();
  const leaving = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
});

it('导出已保存笔记不会将工作台标记为有修改', () => {
  openNotes();
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(downloadMarkdownNote).toHaveBeenCalledWith('资料 A', 'A 已保存笔记');
  expect(screen.queryByText('有修改尚未保存')).toBeNull();
  const leaving = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(false);
});

it('切换资料后从当前来源导出，预览也使用笔记原文', () => {
  openNotes();
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  fireEvent.click(screen.getByRole('button', { name: '资料' }));
  fireEvent.click(screen.getByRole('button', { name: '资料 B' }));
  expect(screen.queryByText('已发起下载：当前笔记.md')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '预览' }));
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(downloadMarkdownNote).toHaveBeenLastCalledWith('资料 B', 'B 已保存笔记');
});

it('下载准备失败后内容与未保存状态保留，之后可重试', () => {
  openNotes();
  fireEvent.change(screen.getByRole('textbox', { name: '我的笔记' }), { target: { value: '待取走内容' } });
  vi.mocked(downloadMarkdownNote).mockImplementationOnce(() => { throw new Error('模拟下载异常'); });
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(screen.getByRole('alert').textContent).toContain('当前笔记仍保留在页面中');
  expect((screen.getByRole('textbox', { name: '我的笔记' }) as HTMLTextAreaElement).value)
    .toBe('待取走内容');
  expect(screen.getByText('有修改尚未保存')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('已发起下载：当前笔记.md')).toBeDefined();
});

it('空白笔记不可导出', () => {
  openNotes();
  fireEvent.change(screen.getByRole('textbox', { name: '我的笔记' }), { target: { value: '\n \t' } });
  const button = screen.getByRole('button', { name: '导出 Markdown' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(screen.getByText('先写下一些笔记再导出')).toBeDefined();
  fireEvent.click(button);
  expect(downloadMarkdownNote).not.toHaveBeenCalled();
});

it('本地保存失败后仍能导出内存中的笔记', () => {
  openNotes();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('空间不足'); });
  fireEvent.change(screen.getByRole('textbox', { name: '我的笔记' }), { target: { value: '保存失败也能导出' } });
  fireEvent.click(screen.getByRole('button', { name: '保存全部资料与笔记' }));
  expect(screen.getByText(/保存失败，修改仍保留/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(downloadMarkdownNote).toHaveBeenCalledWith('资料 A', '保存失败也能导出');
});

it('导入未完成时阻止导出，避免来源在读取期间切换', async () => {
  openNotes();
  fireEvent.click(screen.getByRole('button', { name: '资料' }));
  const file = new File(['导入正文'], '导入测试.md', { type: 'text/markdown' });
  let finishReading: (buffer: ArrayBuffer) => void = () => {};
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => new Promise<ArrayBuffer>((resolve) => { finishReading = resolve; }),
  });
  fireEvent.change(screen.getByLabelText('导入学习资料'), { target: { files: [file] } });
  expect((screen.getByRole('button', { name: '导出 Markdown' }) as HTMLButtonElement).disabled)
    .toBe(true);
  expect(screen.getByText('正在导入资料，请稍后导出笔记')).toBeDefined();
  expect(downloadMarkdownNote).not.toHaveBeenCalled();
  await act(async () => { finishReading(new TextEncoder().encode('导入正文').buffer); });
  fireEvent.click(screen.getByRole('tab', { name: '我的笔记' }));
  expect(screen.getByText('当前资料:导入测试')).toBeDefined();
  expect(screen.getByText('先写下一些笔记再导出')).toBeDefined();
});

it('读取损坏的存储时禁用导出并保留原数据', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.setItem('study-workspace-v1', '{invalid-json');
  const view = render(<App />);
  fireEvent.click(view.container.querySelector('.home-document')!);
  fireEvent.click(screen.getByRole('tab', { name: '我的笔记' }));
  const button = screen.getByRole('button', { name: '导出 Markdown' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(screen.getByText('读取异常尚未解决，暂时无法导出笔记')).toBeDefined();
  fireEvent.click(button);
  expect(downloadMarkdownNote).not.toHaveBeenCalled();
  expect(localStorage.getItem('study-workspace-v1')).toBe('{invalid-json');
});

it('没有资料时禁用导出', () => {
  localStorage.setItem('study-workspace-v1', JSON.stringify({ documents: [], notes: {} }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '资料' }));
  fireEvent.click(screen.getByRole('tab', { name: '我的笔记' }));
  expect((screen.getByRole('button', { name: '导出 Markdown' }) as HTMLButtonElement).disabled)
    .toBe(true);
  expect(screen.getByText('请选择资料后导出笔记')).toBeDefined();
});
