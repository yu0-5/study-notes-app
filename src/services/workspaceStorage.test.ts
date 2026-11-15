import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadWorkspace, saveWorkspace } from './workspaceStorage';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

it('读取旧版笔记并为缺少 format、projectId 的旧资料补齐默认值', () => {
  localStorage.setItem('study-notes', JSON.stringify({ 'doc-1': '旧笔记' }));
  expect(loadWorkspace().notes['doc-1']).toBe('旧笔记');
  localStorage.setItem('study-workspace-v1', JSON.stringify({
    documents: [{ id: 'legacy', title: '旧资料', content: '旧正文' }], notes: {},
  }));
  expect(loadWorkspace().documents[0]).toMatchObject({
    id: 'legacy', format: 'text', projectId: 'project-default',
  });
});

it.each([
  { documents: [], notes: { a: 123 } },
  { documents: [{ id: 'a', title: '资料', content: 123 }], notes: {} },
  { documents: [
    { id: 'a', title: '一', content: '一' },
    { id: 'a', title: '二', content: '二' },
  ], notes: {} },
])('运行时拒绝格式错误、数值型笔记或重复 ID 的工作台数据', (invalid) => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.setItem('study-workspace-v1', JSON.stringify(invalid));
  expect(loadWorkspace().error).not.toBe('');
});

it('可保存并重新读取空资料集，刷新不会重新插入示例资料', () => {
  saveWorkspace([], {});
  expect(loadWorkspace()).toEqual({ documents: [], notes: {}, error: '' });
});
