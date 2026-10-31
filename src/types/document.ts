//一个项目可以包含多份资料，每份资料通过projectId表示自己属于哪个项目
export type StudyProject = {
  id:string;
  name:string;
};

export type StudyDocument = {
  id: string;
  projectId: string;
  title: string;
  format: 'text' | 'markdown';
  content: string;
};