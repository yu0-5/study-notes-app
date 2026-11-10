import assert from "node:assert/strict";
import {
    createSseParser,
    type SseMessage,
}from '../../shared/sse.js';

const encoder =  new TextEncoder();

const source =
    ': heartbeat\r\n' +
    'event: delta\r\n' +
    'data: {"text": "你好😀"}\r\n\r\n' + 
    'data: 第一行\n' +
    'data: 第二行\n\n' +
    'data: [DONE]\n\n';
 
const bytes = encoder.encode(source);
  
const expected:SseMessage[] = [
     {
    event: 'delta',
    data: '{"text": "你好😀"}',
  },
  {
    event: 'message',
    data: '第一行\n第二行',
  },
  {
    event: 'message',
    data: '[DONE]',
  },
];

//尝试在每一个字节位置拆成两块
for (let split = 0; split <=  bytes.length; split++){
    const received: SseMessage[] = [];

    const parser = createSseParser((message) => {
        received.push(message);
    });

    parser.push(bytes.slice(0, split));
    parser.push(bytes.slice(split));
    parser.finish();

    assert.deepEqual(received, expected);
}

//未完整结束的消息不能被交付
const incomplete: SseMessage[] = [];

const parser = createSseParser((message) => {
    incomplete.push(message);
});

parser.push(encoder.encode('data: 未完成'));
parser.finish();

assert.deepEqual(incomplete, []);

console.log('SSE拆快、中文、多行数据和未完成消息检查通过');