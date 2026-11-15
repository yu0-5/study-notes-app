import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NoteEditor } from './NoteEditor';
import type { NoteExportResult } from '../utils/noteExport';

afterEach(cleanup);

function props() {
  return {
    documentId: 'a', documentTitle: '资料 A', note: '# 我的笔记',
    loadError: '', editDisabled: false, saveDisabled: false,
    saveMessage: '有修改尚未保存', exportDisabledReason: '',
    onNoteChange: vi.fn(), onSave: vi.fn(),
    onExport: vi.fn<() => NoteExportResult>(() => ({ ok: true, fileName: '资料A.md' })),
  };
}

it('编辑与预览模式都可导出，发起下载不会调用保存操作', () => {
  const input = props();
  render(<NoteEditor {...input} />);
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  fireEvent.click(screen.getByRole('button', { name: '预览' }));
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(input.onExport).toHaveBeenCalledTimes(2);
  expect(input.onSave).not.toHaveBeenCalled();
  expect(screen.getByText('已发起下载：资料A.md')).toBeDefined();
  expect(screen.getByText('有修改尚未保存')).toBeDefined();
});

it.each([
  '先写下一些笔记再导出',
  '请选择资料后导出笔记',
  '读取异常尚未解决，暂时无法导出笔记',
  '正在导入资料，请稍后导出笔记',
])('不可导出时禁用按钮并说明原因：%s', (reason) => {
  const input = props();
  render(<NoteEditor {...input} exportDisabledReason={reason} />);
  const button = screen.getByRole('button', { name: '导出 Markdown' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(screen.getByText(reason)).toBeDefined();
  fireEvent.click(button);
  expect(input.onExport).not.toHaveBeenCalled();
});

it('没有资料 ID 时不会执行导出', () => {
  const input = props();
  render(<NoteEditor {...input} documentId={null} />);
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(input.onExport).not.toHaveBeenCalled();
});

it('导出反馈不串资料，正文改变后隐藏过期反馈', () => {
  const input = props();
  const view = render(<NoteEditor {...input} />);
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  view.rerender(<NoteEditor {...input} documentId="b" documentTitle="资料 B" />);
  expect(screen.queryByText('已发起下载：资料A.md')).toBeNull();
  view.rerender(<NoteEditor {...input} note="修改后的正文" />);
  expect(screen.queryByText('已发起下载：资料A.md')).toBeNull();
});

it('导出失败显示错误，但保留编辑器内容', () => {
  const input = props();
  input.onExport.mockReturnValue({ ok: false, message: '导出失败，请重试' });
  render(<NoteEditor {...input} />);
  fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
  expect(screen.getByRole('alert').textContent).toBe('导出失败，请重试');
  expect((screen.getByRole('textbox', { name: '我的笔记' }) as HTMLTextAreaElement).value)
    .toBe(input.note);
});
