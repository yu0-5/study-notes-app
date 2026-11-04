import { randomUUID } from 'node:crypto';
import { generationInputSchema } from '../validators/generationInput.js';
import { buildGenerationPrompt } from '../services/generationPrompt.js' ;

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

const prompt = buildGenerationPrompt(input);

console.log('系统要求: \n',prompt.system);
console.log('\n用户资料(固定测试样本): \n',prompt.user);