# MemoChat

<p align="center">
  <img src="public/memochat.png" width="128" height="128" alt="MemoChat Logo">
</p>

<p align="center">
  <a href="README.md">English</a> | 中文
</p>

一个带有记忆系统的桌面 AI 聊天客户端。通过自定义规则，自动从对话中提取和维护结构化备忘录，让 AI 真正"记住"你们聊过的内容。

## 功能

- **OpenAI Compatible** — 支持任何 OpenAI 兼容的 API 端点，流式输出，支持 Reasoning/Thinking
- **Memo Compact** — 定义规则，一键整理记忆，下次对话时作为上下文注入
- **MemoPack Market** — 浏览、创建、导入导出、通过远程频道分享MemoPack
- **聊天记录** — 自动保存，自动归档，双击聊天框编辑消息

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

在 Settings 标签页中设置：

| 字段 | 说明 |
|------|------|
| Base URL | API 端点 |
| API Key | API 密钥 |
| Model ID | 聊天模型 |
| Model ID for Compact | Compact 使用的模型 |
| Reasoning | 启用思维链 |

在 Memo 面板中设置 System Prompt 和 Memo Rules。

## 项目细节

### 提示词组装规则

```
system:
"""
[memo1]content1
[memo2]content2
...
{system_prompt}
"""

user:
"""
{user_input}
"""

assistant:
"""
{llm_reply}
"""
```

### Channel登陆

在Settings页，注册/登陆到channel服务器，即可浏览该服务器的所有MemoPack

## License

MIT
