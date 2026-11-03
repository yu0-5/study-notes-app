import type { GenerationInput } from '../validators/generationInput.js';

export function buildDemoDraft(input: GenerationInput): string {
  const { preferences } = input;

  const goalLabels = {
    understand: '理解知识',
    review: '复习回顾',
    interview: '面试准备',
  };

  const learningTasks = {
    understand: '用自己的话解释核心概念，并补充一个例子。',
    review: '提炼关键结论，整理容易遗忘和混淆的地方。',
    interview: '整理回答提纲，并列出需要进一步解释的原理。',
  };

  const quotedSource = input.sourceText
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

  return [
    '# 模拟候选笔记',
    '',
    '这是用于联调的模板输出，尚未调用 AI，不是自动总结结果。',
    '',
    '## 本次学习配置',
    '',
    `- 学习目标：${goalLabels[preferences.goal]}`,
    `- 当前基础：${preferences.level === 'beginner' ? '初次学习' : '已经学过'}`,
    `- 内容详略：${preferences.detail === 'concise' ? '简洁' : '详细'}`,
    '',
    '## 本次输入原文',
    '',
    quotedSource,
    '',
    '## 待完成的整理任务',
    '',
    learningTasks[preferences.goal],
  ].join('\n');
}