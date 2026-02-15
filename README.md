# MemoChat

<p align="center">
  <img src="public/memochat.png" width="128" height="128" alt="MemoChat Logo">
</p>

<p align="center">
  English | <a href="README_zh.md">中文</a>
</p>

A desktop AI chat client with a memory system. Define custom rules to automatically extract and maintain structured memos from conversations — so your AI truly "remembers" what you've talked about.

## Features

- **OpenAI API Compatible** — Works with any OpenAI-compatible API endpoint, streaming output, supports Reasoning/Thinking
- **Memo Memory System** — Define rules (e.g. "record user preferences"), automatically extract info after conversations and write to memos, injected as context in future chats
- **Memory Compact** — Uses a specified model to update all memos based on chat history, then archives and clears the current conversation
- **Persistent Chat History** — Auto-saved, restored on startup, auto-archived on Compact
- **Import/Export** — Rules and Memos can be independently imported/exported as JSON
- **Drag & Drop Sorting** — Memo rules support drag-and-drop reordering
- **Markdown Rendering** — Code blocks, tables, lists, links, and more

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

Set up in the Settings panel:

| Field | Description |
|-------|-------------|
| API Key | Your API key |
| Base URL | API endpoint (OpenAI compatible) |
| Model ID | Chat model |
| Model ID for Compact | Model used for Compact (optional, defaults to chat model) |
| Reasoning | Enable chain-of-thought |

Set up System Prompt and Memo Rules in the Memo panel.

## License

MIT
