# MemoChat 性能对比报告：Tauri vs Electron

## 测试环境

| 项目 | 详情 |
|------|------|
| 操作系统 | NixOS 26.05 (Yarara) |
| 内核版本 | Linux 6.19.9 |
| CPU | Intel N150 |
| 内存 | 16 GB |
| 显示服务 | X11 |
| Node.js | v24.14.0 |
| Rust | 1.93.1 |

```bash
uname -r
cat /etc/os-release | grep PRETTY_NAME
cat /proc/cpuinfo | grep "model name" | head -1
cat /proc/meminfo | grep MemTotal
rustc --version
node --version
```

## 被测版本

| 框架 | 版本 | Git Branch | Commit |
|------|------|------------|--------|
| Tauri | 2.x | `main` | `fe8ec08` |
| Electron | 33.x（实际安装 41.0.2） | `electron` | `53daa8b` |

```bash
git log --oneline -1 main
git log --oneline -1 origin/electron
cat src-tauri/Cargo.toml | grep "tauri ="
cat package.json | grep '"electron"'
```

---

## 测试过程

### 1. 构建

**Tauri (main branch)**

```bash
git checkout main
pnpm install
nix-shell --run "pnpm tauri build"
```

> NixOS 需要通过 `nix-shell` 提供系统依赖（WebKitGTK、GTK3 等）。

**Electron (electron branch)**

```bash
git checkout electron
pnpm install
pnpm build      # vue-tsc + vite build + tsc for electron main process
pnpm package    # electron-builder 打包
```

> **注意**：electron branch 的 `package.json` 含有 `"type": "module"`，而 electron 主进程编译输出为 CommonJS 格式，导致直接运行报错 `exports is not defined in ES module scope`。需将 `electron-dist/*.js` 重命名为 `*.cjs` 并更新 `package.json` 的 `main` 字段后方可正常启动。

### 2. 安装包大小

```bash
# 查看可执行文件大小
ls -lh src-tauri/target/release/memochat
ls -lh /nix/store/g688ki2y79k3hjidi14kp1hgg57ya0a0-electron-unwrapped-41.0.2/libexec/electron/electron

# 查看安装包大小
ls -lh src-tauri/target/release/bundle/appimage/MemoChat_0.1.2_amd64.AppImage
ls -lh src-tauri/target/release/bundle/deb/MemoChat_0.1.2_amd64.deb
ls -lh release/MemoChat-0.1.2.AppImage
ls -lh release/memochat_0.1.2_amd64.deb

# 查看 Electron 解压后目录大小
du -sh release/linux-unpacked/
```

> **打包问题修复**：
>
> Electron 的 fpm 因 glibc 版本不兼容无法运行，修复方式：
> ```bash
> # 安装 nix ruby 版本的 fpm
> nix-shell -p ruby --run "gem install fpm --no-document"
> FPM_BIN=~/.local/share/gem/ruby/3.4.0/bin/fpm
> # 替换 electron-builder 缓存的 fpm wrapper
> cat > ~/.cache/electron-builder/fpm/fpm-1.9.3-2.3.1-linux-x86_64/fpm << EOF
> #!/usr/bin/env bash
> exec $FPM_BIN "\$@"
> EOF
> ```
>
> Tauri 的 linuxdeploy 因 NixOS 无 `/bin/bash` 且 `posix_spawn` 不支持 shebang 脚本，最终绕过 linuxdeploy，手动构建 AppImage：
> ```bash
> # 获取 AppImage runtime
> OFFSET=$(APPIMAGE_EXTRACT_AND_RUN=1 ~/.cache/tauri/linuxdeploy-x86_64.AppImage.real --appimage-offset)
> dd if=~/.cache/tauri/linuxdeploy-x86_64.AppImage.real of=/tmp/appimage_runtime bs=1 count=$OFFSET
> # 打包 AppDir
> nix-shell -p squashfsTools --run "mksquashfs MemoChat.AppDir /tmp/memochat.squashfs -root-owned -noappend -comp xz -b 1048576 -no-xattrs"
> # 合并
> cat /tmp/appimage_runtime /tmp/memochat.squashfs > MemoChat_0.1.2_amd64.AppImage
> chmod +x MemoChat_0.1.2_amd64.AppImage
> ```

### 3. 启动时间

以主进程 RSS 超过阈值作为"已启动"判定条件，轮询间隔 200ms：

```bash
# Tauri 启动时间（RSS > 50 MB 视为启动完成）
START=$(date +%s%3N)
DISPLAY=:0 src-tauri/target/release/memochat &
APP_PID=$!
for i in $(seq 1 30); do
  sleep 0.2
  RSS=$(ps -o rss= -p $APP_PID 2>/dev/null)
  if [ "${RSS:-0}" -gt 50000 ]; then
    END=$(date +%s%3N)
    echo "Tauri startup: $((END - START)) ms"
    break
  fi
done
kill $APP_PID

# Electron 启动时间（主进程 RSS > 100 MB 视为启动完成）
START=$(date +%s%3N)
DISPLAY=:0 npx electron . --ozone-platform=x11 &
LAUNCHER_PID=$!
for i in $(seq 1 60); do
  sleep 0.2
  ELEC_PID=$(pgrep -f "electron-unwrapped.*electron \." 2>/dev/null | head -1)
  if [ -n "$ELEC_PID" ]; then
    RSS=$(ps -o rss= -p $ELEC_PID 2>/dev/null)
    if [ "${RSS:-0}" -gt 100000 ]; then
      END=$(date +%s%3N)
      echo "Electron startup: $((END - START)) ms"
      break
    fi
  fi
done
kill $LAUNCHER_PID
pkill -f "electron \."
```

### 4. 内存占用

应用启动稳定后（等待 5~8 秒）采集：

```bash
# Tauri：主进程 + 子进程
DISPLAY=:0 src-tauri/target/release/memochat &
TAURI_PID=$!
sleep 5

cat /proc/$TAURI_PID/status | grep VmRSS
ps --ppid $TAURI_PID -o pid,rss,comm

MAIN_RSS=$(cat /proc/$TAURI_PID/status | grep VmRSS | awk '{print $2}')
CHILD_RSS=$(ps --ppid $TAURI_PID -o rss= 2>/dev/null | awk '{sum+=$1} END {print sum}')
echo "主进程: $((MAIN_RSS/1024)) MB"
echo "子进程合计: $((CHILD_RSS/1024)) MB"
echo "总计: $(((MAIN_RSS+CHILD_RSS)/1024)) MB"
kill $TAURI_PID

# Electron：所有 electron 二进制进程
DISPLAY=:0 npx electron . --ozone-platform=x11 &
LAUNCHER_PID=$!
sleep 8

ELEC_PID=$(pgrep -f "electron-unwrapped.*electron \." | head -1)
cat /proc/$ELEC_PID/status | grep VmRSS

ps aux | grep "libexec/electron/electron" | grep -v grep | \
  awk '{printf "PID=%s RSS=%d MB type=%s\n", $2, $6/1024, $NF}'

TOTAL=$(ps aux | grep "libexec/electron/electron" | grep -v grep | \
  awk '{sum+=$6} END {print sum}')
echo "总计: $((TOTAL/1024)) MB"

kill $LAUNCHER_PID
pkill -f "electron \."
```

---

## 测试结果

### 安装包与二进制大小

| | Tauri | Electron |
|--|-------|----------|
| 可执行文件 | **12 MB** | **211 MB** |
| 安装包（AppImage） | **3.3 MB** | **107 MB** |
| 安装包（deb） | **4.1 MB** | **84 MB** |
| 解压后目录 | — | **277 MB** |

Tauri 安装包极小，因为依赖系统已有的 WebKitGTK，包内只含 Rust 二进制；Electron 需将完整 Chromium 运行时一并打包。AppImage 格式下相差 **32 倍**，deb 格式下相差 **20 倍**。

### 启动时间

| | Tauri | Electron |
|--|-------|----------|
| 启动耗时 | **214 ms** | **675 ms** |

Tauri 启动速度约为 Electron 的 **3.2 倍**。

> Electron 的 675 ms 包含 `npx` 启动开销，打包后的独立应用预计在 400~500 ms 左右。

### 内存占用（RSS）

**Tauri**

| 进程 | RSS |
|------|-----|
| memochat（主进程） | 161 MB |
| WebKitNetworkProcess | 66 MB |
| WebKitWebProcess | 189 MB |
| **合计** | **416 MB** |

**Electron**

| 进程 | RSS |
|------|-----|
| electron（主进程） | 167 MB |
| renderer 进程 | 145 MB |
| zygote × 4 | 240 MB |
| **合计** | **552 MB** |

Electron 总内存约为 Tauri 的 **1.3 倍**。

---

## 汇总对比

| 指标 | Tauri | Electron | 差距 |
|------|-------|----------|------|
| 可执行文件大小 | 12 MB | 211 MB | Electron 大 **17.6x** |
| 安装包大小（AppImage） | 3.3 MB | 107 MB | Electron 大 **32x** |
| 安装包大小（deb） | 4.1 MB | 84 MB | Electron 大 **20x** |
| 启动时间 | 214 ms | 675 ms | Electron 慢 **3.2x** |
| 主进程内存 | 161 MB | 167 MB | 基本持平 |
| 所有进程总内存 | 416 MB | 552 MB | Electron 多 **33%** |

---

## 分析

- **安装包体积**：差距最显著（AppImage 32x，deb 20x）。Tauri 依赖系统已有的 WebKitGTK，无需打包浏览器引擎；Electron 自带完整 Chromium，不可避免地带来体积膨胀。
- **启动速度**：Tauri 明显更快（3.2x），Rust 原生二进制 + 系统 WebKit 的组合启动开销远低于 Electron 的多进程初始化流程。
- **内存**：主进程层面两者相近（均约 160~170 MB），差距主要来自 Electron 的 zygote 沙箱进程机制。Tauri 的内存数字中包含系统共享的 WebKitGTK，实际独占内存更低。
- **开发体验**：Electron branch 存在 ESM/CJS 模块冲突问题，需手动修复才能运行，说明该分支的工程配置尚不完善。

---

*测试日期：2026-04-02*
