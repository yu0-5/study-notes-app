# AI 资料研读工作台

面向阅读课程笔记、技术文章和面试资料的学习者：导入资料、对照原文阅读、按学习偏好生成候选笔记，核对修改后追加到自己的笔记。

这是一个可在本地运行的前端实习项目。**笔记生成支持真实 DeepSeek API；资料问答目前为模拟回答，不分析正文、不调用模型。**

## 已实现的功能

- 首页导入与已有资料入口；资料栏展开时挤压工作区，原文与学习面板独立滚动。
- UTF-8 TXT / Markdown 导入，单文件不超过 **1 MiB（1,048,576 字节）**；拒绝空文件、异常编码和含 NUL 的内容。导入时在浏览器中读取文件，不向服务器上传原文件；之后的生成操作会提交已确认的原文范围。
- 资料标题搜索、按资料隔离的个人笔记、Markdown 预览，以及手动保存到 localStorage。
- 选择整篇或片段，设置学习目标、基础和详略，确认生成输入快照；前后端检查格式、来源标识、范围与字符数。
- 模拟模板生成、DeepSeek 真实流式生成、停止生成、异常提示及未完成片段保留。
- 编辑候选、核对后追加、阻止重复追加；切换资料后须返回候选来源资料才能追加。
- AI 助手与个人笔记切换保留状态；资料问答支持逐段模拟输出、停止、最后一条失败或停止回答的重试。
- 删除资料时清理其笔记、对话与输入草稿，并取消属于该资料的模拟回答；不打断其他资料的模拟回答。

## 本地启动

开发与验收使用 Node.js **24**（本地验证为 24.18.0）和 npm。先确认 `node -v`、`npm -v` 能正常运行。

获取仓库并安装锁定的依赖：

```powershell
git clone https://github.com/yu0-5/study-notes-app.git
cd study-notes-app
npm.cmd ci
```

已有项目时，直接进入项目根目录；当前本机路径是 `E:\workspace\2026\study-notes-app`。下面两个终端都应位于这个目录。

终端一：启动 Express 后端。

```powershell
npm.cmd run dev:server
```

终端二：启动 Vite 前端。

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

打开终端显示的前端地址，通常为 **http://127.0.0.1:5173**。端口被占用时以 Vite 实际输出为准。使用 `Ctrl+C` 停止对应服务。

前端将 `/api` 请求代理到 `http://127.0.0.1:3001`。访问 `http://127.0.0.1:3001/api/health`，应返回 `status: "ok"`。模拟笔记生成需要后端，模拟问答在浏览器中运行。

### 可选：启用真实笔记生成

不配置密钥也能使用本地阅读、笔记、模拟生成和模拟问答。在根目录创建 `.env`，参考已提交的 `.env.example`；已有 `.env` 时保留原配置，不要覆盖。

```dotenv
MODEL_API_KEY=填写你自己的密钥
MODEL_BASE_URL=https://api.deepseek.com
MODEL_NAME=deepseek-flash
```

当前服务端配置校验接受 `deepseek-flash`、`deepseek-v4-pro`，是否可用取决于账户权限。修改配置后重启后端。在“生成方式”中主动选择“DeepSeek 真实生成”，再点击“生成 AI 草稿”，才会调用真实模型并消耗额度。

密钥只供后端使用，`.env` 已被 Git 忽略；不要给密钥增加 `VITE_` 前缀或写入前端代码。真实生成会把**本次确认的原文范围、标题和学习偏好**发送给模型服务。

## 验收与测试

```powershell
npm.cmd run check
```

这个入口依次执行 ESLint、Vitest、两份 SSE 解析检查、TypeScript 检查和生产构建。测试不需要启动服务、配置密钥或连接模型。

| 命令 | 用途 |
| --- | --- |
| `npm.cmd test` | 自动化用例及两份 SSE 解析脚本 |
| `npm.cmd run test:watch` | 开发时监听 Vitest 用例 |
| `npm.cmd run test:parsers` | 单独检查 SSE 拆包和模型结束信号 |
| `npm.cmd run lint` | 代码规则检查 |
| `npm.cmd run build` | TypeScript 检查与前端构建，产物在 `dist` |

GitHub Actions 配置在 [check.yml](.github/workflows/check.yml)，在 push 和 pull request 时用 Node.js 24 执行 `npm ci`、`npm run check`。远程检查结果以仓库 Actions 页面为准。

自动化覆盖会话按资料隔离、取消与重试、删除联动、迟到回调防护、模拟服务计时器清理，以及存储读取保护和写入失败恢复。组件测试使用 jsdom，不代表真实浏览器视觉、输入法或真实模型端到端验收。完整演示与人工检查见 [验收清单](docs/acceptance.md)。

`server/scripts/runDeepSeekGeneration.ts` 是真实 API 调试脚本，可能消耗额度，**不属于默认测试或 CI**。

## 数据流与目录

```text
本地文件 → 浏览器校验/解码 → useWorkspace → 原文阅读 + 个人笔记
                                  ↓
学习偏好 + 整篇/片段 → 确认输入快照 → Express 校验 → 模拟模板 / DeepSeek SSE
                                                       ↓
                          手动保存 ← 个人笔记 ← 核对并追加 ← 候选笔记

当前资料 + 问题 → useStudyChat → 本地模拟逐段输出 → 按资料隔离的对话
```

```text
src/
  App.tsx                  页面编排、生成快照、追加与删除协调
  components/              首页、资料栏、原文、笔记、生成面板和问答输入
  hooks/useWorkspace.ts    资料、笔记、导入、删除、保存与未保存状态
  hooks/useStudyChat.ts    对话草稿、消息、任务归属、取消与重试
  services/                浏览器存储、后端请求、本地模拟回答
  types/                   资料、生成输入、对话类型
  utils/                   文件校验、换行归一化与选区提取
server/
  index.ts                 Express 路由、生成并发限制和流响应
  validators/              Zod 生成输入运行时校验
  services/                提示词、模型调用、模型流解析、模拟模板
  scripts/                 解析器检查与模型调试脚本
shared/sse.ts              前后端共用的 SSE 字节流解析器
vitest.config.ts           自动化测试配置
```

## 数据保留与当前边界

- 导入、笔记编辑和删除后，需要点击“保存全部资料与笔记”才写入当前浏览器。关闭或刷新前的未保存修改可能丢失，离开提示不应当作备份。
- 对话、问答草稿、生成候选和学习偏好目前仅保存在当前页面内存中，刷新会丢失；切换资料和标签不会清空它们。删除资料会立即清除对应对话；尚未保存就刷新时资料可能恢复，但对话不会恢复。
- localStorage 按网站来源隔离。`localhost` 与 `127.0.0.1`、不同端口使用不同存储；建议一直使用同一个前端地址。无跨设备同步。
- 导入上限与模型输入上限不同：整篇生成最多 12,000 个 Unicode 码点，片段最多 6,000；较长资料应选片段。
- 当前仅支持 TXT / Markdown，不支持 PDF、Word、PPT、表格解析、OCR、向量检索或 RAG。Markdown 预览不执行原始 HTML，不展示 Markdown 图片。
- 目前适合本地单用户演示，未实现登录、数据库、云同步或公共部署。后端只监听本机地址，真实生成采用单进程内的并发限制；`npm run build` 成功不代表已完成生产部署。
- 本项目未提供真实用户规模或性能基准数据，面试介绍时应区分已实现功能、自动化验证和后续规划。
