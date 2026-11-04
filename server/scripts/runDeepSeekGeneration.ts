import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { generationInputSchema } from '../validators/generationInput.js';
import { generateDeepSeekDraft } from '../services/deepSeekGeneration.js';

loadEnvFile('.env');

const sourceText = [
    '进程是程序的一次执行过程。',
    '线程是操作系统进行调度的基本单位。',
    '同一进程中的线程可以共享进程的部分资源。',
].join('\n');

const input = generationInputSchema.parse({
    requestId: randomUUID(),
    documentId: 'prompt-test-document',
    documentTitle:'进程与线程测试资料',
    sourceText,
    characterCount: Array.from(sourceText).length,
    range: {
        documentId: 'prompt-test-document',
        mode: 'whole',
        start: 0,
        end: sourceText.length,
    },
    preferences: {
        goal:'understand',
        level:'beginner',
        detail:'concise',
    },
    createdAt: new Date().toISOString(),
});

const controller = new AbortController();

const result = await generateDeepSeekDraft(input, controller.signal);

console.log('实际响应模型: ', result.model);
console.log('\n真实候选笔记: \n', result.content);