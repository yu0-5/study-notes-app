import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWorkspace } from './useWorkspace';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); localStorage.clear(); });

it('保存失败保留内容与未保存状态，重试成功才更新已保存快照', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const chat = renderHook(useWorkspace);
  const id = chat.result.current.selectedId;
  act(() => { chat.result.current.updateDocumentNote(id, '待保存内容'); });
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('存储空间不足', 'QuotaExceededError');
  });
  act(() => { chat.result.current.saveNotes(); });
  expect(chat.result.current.hasUnsavedChanges).toBe(true);
  expect(chat.result.current.note).toBe('待保存内容');
  expect(chat.result.current.saveMessage).toContain('保存失败');
  setItem.mockRestore();
  act(() => { chat.result.current.saveNotes(); });
  expect(chat.result.current.hasUnsavedChanges).toBe(false);
  chat.unmount();
  const reloaded = renderHook(useWorkspace);
  expect(reloaded.result.current.notesById[id]).toBe('待保存内容');
});

it('损坏的存储进入保护态，编辑和保存不会覆盖原数据', () => {
  const original = '{invalid-json';
  localStorage.setItem('study-workspace-v1', original);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const workspace = renderHook(useWorkspace);
  expect(workspace.result.current.loadError).not.toBe('');
  act(() => {
    expect(workspace.result.current.updateDocumentNote(workspace.result.current.selectedId, '覆盖'))
      .toBe(false);
    workspace.result.current.saveNotes();
  });
  expect(localStorage.getItem('study-workspace-v1')).toBe(original);
});
