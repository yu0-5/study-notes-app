export type LearningPreferences = {
    goal: 'understand' | 'review' | 'interview';
    level: 'beginner' | 'learned';
    detail: 'concise' | 'detailed';
}

export type GenerationRange = {
    documentId: string;
    mode: 'whole' | 'selection';
    start: number;
    end: number;

}
//定义快照结构
export type GenerationInputSnapshot = {
    requestId: string;
    documentId: string;
    documentTitle: string;
    sourceText: string;
    characterCount: number;
    range: GenerationRange;
    preferences: LearningPreferences;
    createdAt:string;
}