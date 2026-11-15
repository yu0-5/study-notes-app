import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoteExportFileName, downloadMarkdownNote } from './noteExport';

const exportedAt = new Date(2026, 10, 15, 9, 5, 7);

describe('导出文件名', () => {
  it('保留中文并移除原扩展名，使用补零后的本地时间', () => {
    expect(createNoteExportFileName('  计算机网络.MD  ', exportedAt))
      .toBe('计算机网络-学习笔记-20261115-090507.md');
  });

  it('替换非法字符和控制字符', () => {
    expect(createNoteExportFileName('缓存/协商:\u0000记录?.md', exportedAt))
      .toBe('缓存_协商__记录_-学习笔记-20261115-090507.md');
    expect(createNoteExportFileName('<>:"/\\|?*\u007f.txt', exportedAt))
      .toBe('__________-学习笔记-20261115-090507.md');
  });

  it.each(['', '   ', '...'])('无可用标题时回退默认名称：%j', (title) => {
    expect(createNoteExportFileName(title, exportedAt))
      .toBe('未命名资料-学习笔记-20261115-090507.md');
  });

  it('截取 80 个码点且不拆开 emoji，截取后再次移除尾部句点和空白', () => {
    expect(createNoteExportFileName('😀'.repeat(81), exportedAt))
      .toBe(`${'😀'.repeat(80)}-学习笔记-20261115-090507.md`);
    expect(createNoteExportFileName('字'.repeat(79) + '. 后续', exportedAt))
      .toBe(`${'字'.repeat(79)}-学习笔记-20261115-090507.md`);
  });
});

describe('Markdown 下载与资源释放', () => {
  const createObjectURL = vi.fn<(blob: Blob | MediaSource) => string>();
  const revokeObjectURL = vi.fn<(url: string) => void>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(exportedAt);
    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
    let sequence = 0;
    createObjectURL.mockImplementation(() => `blob:note-${++sequence}`);
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('下载 UTF-8 原文，保留代码、缩进、换行和首尾空白，不添加 BOM', async () => {
    const content = '  # 中文😀\n\n```ts\n  const x = 1;\n```\n\n';
    let clickedLink: { href: string; download: string; connected: boolean } | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedLink = { href: this.href, download: this.download, connected: this.isConnected };
    });
    const fileName = downloadMarkdownNote('测试.md', content);
    expect(clickedLink).toEqual({ href: 'blob:note-1', download: fileName, connected: true });
    expect(document.querySelector('a[download]')).toBeNull();

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    const bytes = new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    await vi.runAllTimersAsync();
    const result = new Uint8Array(await bytes);
    expect(Array.from(result)).toEqual(Array.from(new TextEncoder().encode(content)));
  });

  it('重复导出使用各自的 URL，下载触发后再释放', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadMarkdownNote('资料', '第一次');
    downloadMarkdownNote('资料', '第二次');
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL.mock.calls).toEqual([['blob:note-1'], ['blob:note-2']]);
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('链接触发失败仍移除链接并立即释放 URL', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('模拟下载准备失败');
    });
    expect(() => downloadMarkdownNote('资料', '正文')).toThrow('模拟下载准备失败');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:note-1');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('创建 URL 失败时不留下链接或定时器', () => {
    createObjectURL.mockImplementation(() => { throw new Error('URL 创建失败'); });
    expect(() => downloadMarkdownNote('资料', '正文')).toThrow('URL 创建失败');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['', '\n  \t'])('空白笔记不会创建下载资源', (content) => {
    expect(() => downloadMarkdownNote('资料', content)).toThrow('笔记为空');
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
