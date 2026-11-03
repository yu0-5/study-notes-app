import { z } from 'zod';

const preferencesSchema = z.object({
    goal: z.enum(['understand', 'review', 'interview']),
    level: z.enum(['beginner', 'learned']),
    detail: z.enum(['concise', 'detailed']),
});

const rangeSchema = z.object({
    documentId: z.string().min(1).max(200),
    mode: z.enum(['whole', 'selection']),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
});

export const generationInputSchema = z.object({
    requestId: z.uuid(),
    documentId: z.string().min(1).max(200),
    documentTitle: z.string().min(1).max(500),

    sourceText: z.string().refine(
        (text) => text.trim().length > 0,
        { message: "生成正文不能为空" }
    ),

    characterCount: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    preferences: preferencesSchema,
    range: rangeSchema,
})
  .refine(
    (input) => input.documentId === input.range.documentId,
    {
        message:'生成范围与资料不匹配',
        path:['range', 'documentId'],
    },
  )
  .refine(
    (input) => 
        input.range.end > input.range.start &&
        input.range.end - input.range.start === input.sourceText.length &&
        (input.range.mode !== 'whole' || input.range.start === 0),

        {
            message:'范围位置与正文长度不一致',
            path:['range'],
        },
    )
    .refine(
        (input) => 
            input.characterCount === Array.from(input.sourceText).length,
    {
        message:'字符数与正文长度不一致',
        path:['characterCount'],

        },
  )
  .refine(
    (input) => {        
        const limit = input.range.mode === 'selection' ? 6000 : 12000;
        return Array.from(input.sourceText).length <= limit;
    },
        
    {
        message:'正文超出当前生成范围的字符上限',
        path:['sourceText'],
    },
  );

  export type GenerationInput = z.infer<typeof generationInputSchema>;