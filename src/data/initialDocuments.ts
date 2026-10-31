import{ DEFAULT_PROJECT_ID } from './initialProjects';
import type { StudyDocument } from '../types/document';
export const initialDocuments: StudyDocument[] = [
  { 
    id: 'doc-1',
    projectId: DEFAULT_PROJECT_ID,
    title: '操作系统课程笔记', 
    content: '进程是程序的一次执行过程，线程是进程内的执行单元。',
    format: 'text' ,
  },
  { 
    id: 'doc-2', 
    projectId: DEFAULT_PROJECT_ID,
    title: '计算机网络课程笔记', 
    content: '计算机网络是计算机之间进行通信的系统。' ,
    format: 'text',
  },
  { 
    id: 'doc-3',
    projectId: DEFAULT_PROJECT_ID,
    title: '人工智能课程笔记', 
    content: '人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。' ,
    format: 'text'
  }
];