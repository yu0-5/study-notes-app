import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AiAssistantPanel } from './AiAssistantPanel';
import { useStudyChat } from '../hooks/useStudyChat';
import type { StudyDocument } from '../types/document';

const doc: StudyDocument = { id: 'a', title: '学习资料', content: '字'.repeat(12001),
  projectId: 'project-default', format: 'text' };

function Panel({ document = doc, disabled = false }: { document?: StudyDocument; disabled?: boolean }) {
  const chat = useStudyChat(document, disabled);
  return <AiAssistantPanel document={document} disabled={disabled} chat={chat} generationPanel={null} />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(['字'.repeat(12001), '   '])('真实模式原文无效时仍可编辑草稿，但按钮和 Enter 均不能发送', (content) => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  render(<Panel document={{ ...doc, content }} />);
  fireEvent.click(screen.getByRole('button', { name: '资料问答' }));
  fireEvent.change(screen.getByRole('combobox', { name: '问答方式' }), { target: { value: 'ai' } });
  const editor = screen.getByRole('textbox', { name: '针对当前资料提问' }) as HTMLTextAreaElement;
  expect(editor.disabled).toBe(false);
  fireEvent.change(editor, { target: { value: '我想先写下问题' } });
  expect(editor.value).toBe('我想先写下问题');
  expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('alert')).toBeDefined();
  fireEvent.keyDown(editor, { key: 'Enter' });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.queryByText('你', { exact: true })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: '问答方式' }), { target: { value: 'demo' } });
  expect(editor.value).toBe('我想先写下问题');
  expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(false);
});

it('有效原文切到真实模式后可以输入并发送，期间不自动发起请求', () => {
  render(<Panel document={{ ...doc, content: '正常原文' }} />);
  fireEvent.click(screen.getByRole('button', { name: '资料问答' }));
  fireEvent.change(screen.getByRole('combobox', { name: '问答方式' }), { target: { value: 'ai' } });
  const editor = screen.getByRole('textbox', { name: '针对当前资料提问' }) as HTMLTextAreaElement;
  fireEvent.change(editor, { target: { value: '解释一下' } });
  expect(editor.disabled).toBe(false);
  expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(false);
});

it('工作台读取或导入期间的禁用状态仍生效', () => {
  render(<Panel disabled />);
  fireEvent.click(screen.getByRole('button', { name: '资料问答' }));
  expect((screen.getByRole('textbox', { name: '针对当前资料提问' }) as HTMLTextAreaElement).disabled).toBe(true);
});
