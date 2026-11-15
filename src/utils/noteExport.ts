export type NoteExportResult =
  | { ok: true; fileName: string }
  | { ok: false; message: string };

export function createNoteExportFileName(
  title: string,
  exportedAt: Date,
): string {
  const titleWithoutExtension = title.trim().replace(/\.(txt|md)$/i, '');

  const sanitizedTitle = Array.from(titleWithoutExtension)
    .map((character) => {
      const code = character.charCodeAt(0);
      const isForbidden = '<>:"/\\|?*'.includes(character);
      const isControlCharacter = code < 32 || code === 127;

      return isForbidden || isControlCharacter ? '_' : character;
    })
    .join('');

  const cleanedTitle = sanitizedTitle.replace(/^[.\s]+|[.\s]+$/g, '');
  const safeTitle =
    Array.from(cleanedTitle)
      .slice(0, 80)
      .join('')
      .replace(/[.\s]+$/g, '') || '未命名资料';

  const pad = (value: number) => String(value).padStart(2, '0');
  const date = [
    exportedAt.getFullYear(),
    pad(exportedAt.getMonth() + 1),
    pad(exportedAt.getDate()),
  ].join('');
  const time = [
    pad(exportedAt.getHours()),
    pad(exportedAt.getMinutes()),
    pad(exportedAt.getSeconds()),
  ].join('');

  return `${safeTitle}-学习笔记-${date}-${time}.md`;
}

// 返回文件名表示已发起下载，不表示用户已确认保存到磁盘。
export function downloadMarkdownNote(title: string, content: string): string {
  if (content.trim() === '') {
    throw new Error('笔记为空，无法导出');
  }

  const fileName = createNoteExportFileName(title, new Date());
  const blob = new Blob([content], {
    type: 'text/markdown;charset=utf-8',
    endings: 'transparent',
  });
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined;
  let triggered = false;

  try {
    link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    triggered = true;
    return fileName;
  } finally {
    link?.remove();

    if (triggered) {
      // 留出浏览器消费下载链接的时间，再释放本次 Blob 的引用。
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      URL.revokeObjectURL(url);
    }
  }
}
