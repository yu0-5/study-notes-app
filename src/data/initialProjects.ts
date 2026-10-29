import type { StudyProject } from '../types/document';

export const DEFAULT_PROJECT_ID = 'project-default';

export const initialProjects: StudyProject[] = [
  {
    id: DEFAULT_PROJECT_ID,
    name: '默认项目',
  },
];