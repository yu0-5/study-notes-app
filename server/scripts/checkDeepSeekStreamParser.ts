import assert from 'node:assert/strict';
import {
  createDeepSeekStreamParser,
} from '../services/deepSeekStreamParser.js';

const encoder = new TextEncoder();

function frame(
  content: string,
  finishReason: 'stop' | null = null,
) {
  const body = {
    model: 'test-model',
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: finishReason,
      },
    ],
  };

  return `data: ${JSON.stringify(body)}\n\n`;
}

const source =
  frame('你') +
  frame('好', 'stop') +
  'data: [DONE]\n\n';

const deltas: string[] = [];

const parser = createDeepSeekStreamParser((text) => {
  deltas.push(text);
});

// 每次只输入一个字节
for (const byte of encoder.encode(source)) {
  parser.push(new Uint8Array([byte]));
}

assert.deepEqual(deltas, ['你', '好']);

assert.deepEqual(parser.finish(), {
  model: 'test-model',
  content: '你好',
});

// 有正文，但缺少完整结束信号
const incomplete = createDeepSeekStreamParser(() => {});

incomplete.push(encoder.encode(frame('未完成')));

assert.throws(
  () => incomplete.finish(),
  /未完整结束/,
);

console.log('模型流正文提取与完整结束检查通过');