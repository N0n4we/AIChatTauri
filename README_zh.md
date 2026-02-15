# MemoChat

<p align="center">
  <img src="public/memochat.png" width="128" height="128" alt="MemoChat Logo">
</p>

<p align="center">
  <a href="README.md">English</a> | 中文
</p>

一个带有记忆系统的桌面 AI 聊天客户端。通过自定义规则，自动从对话中提取和维护结构化备忘录，让 AI 真正"记住"你们聊过的内容。

## 功能

- **兼容 OpenAI API** — 支持任何 OpenAI 兼容的 API 端点，流式输出，支持 Reasoning/Thinking
- **Memo 记忆系统** — 定义规则（如"记录用户偏好"），对话结束后自动提取信息写入备忘录，下次对话时作为上下文注入
- **Memory Compact** — 使用指定模型根据聊天记录更新所有备忘录，归档并清空当前对话
- **聊天记录持久化** — 自动保存，启动时恢复，Compact 时自动归档
- **导入/导出** — Rules 和 Memos 均可独立导入导出为 JSON
- **拖拽排序** — Memo 规则支持拖拽调整顺序
- **Markdown 渲染** — 代码块、表格、列表、链接等

## 技术栈

- [Tauri v2](https://v2.tauri.app/) (Rust)
- [Vue 3](https://vuejs.org/) + TypeScript
- [Vite](https://vite.dev/)

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（NixOS）
nix-shell --run "pnpm tauri dev"

# 构建
pnpm tauri build
```

## 配置

在 Settings 面板中设置：

| 字段 | 说明 |
|------|------|
| API Key | API 密钥 |
| Base URL | API 端点（openai compatible） |
| Model ID | 聊天模型 |
| Model ID for Compact | Compact 使用的模型（可选，默认同上） |
| Reasoning | 启用思维链 |

在 Memo 面板中设置 System Prompt 和 Memo Rules。

## License

MIT
