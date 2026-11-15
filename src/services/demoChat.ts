type DemoChatOptions = {
  documentTitle: string;
  question: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
};

function wait(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    function handleAbort() {
      clearTimeout(timer);
      signal.removeEventListener('abort', handleAbort);
      reject(signal.reason);
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export async function streamDemoChat({
  documentTitle,
  question,
  signal,
  onDelta,
}: DemoChatOptions): Promise<void> {
  const answer = [
    '## 模拟回答',
    '',
    `当前资料：《${documentTitle}》`,
    '',
    `收到的问题：${question}`,
    '',
    '这里正在演示逐段输出、停止和状态保留。',
    '',
    '此回答没有分析资料正文，也没有调用大模型。',
    '接入真实接口后，这里才会展示依据资料生成的解释。',
  ].join('\n');

  const characters = Array.from(answer);

  for (let index = 0; index < characters.length; index += 6) {
    await wait(100, signal);
    signal.throwIfAborted();

    onDelta(characters.slice(index, index + 6).join(''));
  }
}