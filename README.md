# MemoChat

<p align="center">
  <img src="public/memochat.png" width="128" height="128" alt="MemoChat Logo">
</p>

<p align="center">
  English | <a href="README_zh.md">中文</a>
</p>

A desktop AI chat client with a memory system. Define custom rules to automatically extract and maintain structured memos from conversations — so your AI truly "remembers" what you've talked about.

## Features

- **OpenAI Compatible** — Supports any OpenAI-compatible API endpoint, streaming output, Reasoning/Thinking support
- **Memo Compact** — Define rules to compact memories with one click, injected as context in the next conversation
- **MemoPack Market** — Browse, create, import/export, and share MemoPacks via remote channels
- **Chat History** — Auto-save, auto-archive, double-click chat bubbles to edit messages

## Tech Stack

- [Tauri v2](https://v2.tauri.app/) (Rust)
- [Vue 3](https://vuejs.org/) + TypeScript
- [Vite](https://vite.dev/)

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (NixOS)
nix-shell --run "pnpm tauri dev"

# Build
pnpm tauri build
```

## Configuration

Configure in the Settings tab:

| Field | Description |
|-------|-------------|
| Base URL | API endpoint |
| API Key | API key |
| Model ID | Chat model |
| Model ID for Compact | Model used for Compact |
| Reasoning | Enable chain-of-thought |

Set System Prompt and Memo Rules in the Memo panel.

## Details

### Prompt Assembly

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

### Channel Login

In the Settings page, register/login to a channel server to browse all MemoPacks on that server.

## License

MIT
