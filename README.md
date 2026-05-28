# Pi Hub — Pi HUD Extension

Pi HUD 是一个 [pi-coding-agent](https://github.com/nicholasgasior/pi) 的状态栏扩展，在终端底部实时显示会话信息。

灵感来自 [claude-hud](https://github.com/jarrodwatts/claude-hud)。

![](docs/intro.png)

## 预览

```
[claude-sonnet-4-6] pi-mono git:(main) · medium    [████████░░░░░░░░░░░░] 39%    ⏱ 21m
AGENTS.md · skills x5 · ext.tools x2 · ✓ Grep ×10 · ✓ Bash ×3 · ◐ Edit (12s) · ◐ agent (2m 15s)
▸ how to build a REST API with authentication?
```

## 安装

### 方式一：克隆后安装（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/dafei1288/pi-hub.git
# 或放置到本地目录，如 ~/pi-hub

# 2. 项目级安装（在目标项目根目录执行）
node /path/to/pi-hub/scripts/install.js
# 例如：node ~/pi-hub/scripts/install.js

# 3. 全局安装（对所有项目生效）
node ~/pi-hub/scripts/install.js --global
```

### 方式二：Claude / Pi 一键安装

在 Claude 或 Pi 对话中直接说：

```
请帮我安装 pi-hub 的 Pi HUD 扩展到当前项目
```

Agent 会自动执行安装脚本。如需全局安装，可以说：

```
请帮我全局安装 pi-hub 的 Pi HUD 扩展
```

### 方式三：手动复制

```bash
mkdir -p .pi/extensions
cp extensions/pi-hud.ts .pi/extensions/pi-hud.ts
```

### 方式四：命令行临时加载

```bash
pi -e /path/to/pi-hub/extensions/pi-hud.ts
```

### 验证安装

```bash
# 检查项目级安装
ls .pi/extensions/pi-hud.ts

# 检查全局安装
ls ~/.pi/agent/extensions/pi-hud.ts
```

安装后重启 pi 或在会话中输入 `/reload` 即可激活。

## 显示内容

### Line 1 — 会话概览

```
[模型名] 项目名 git:(分支) · thinking级别    [████░░░░] 39%    ⏱ 21m
```

| 元素 | 说明 |
|------|------|
| `[模型名]` | 当前 LLM 模型 ID |
| 项目名 | 当前工作目录名 |
| `git:(分支)` | Git 分支，非 git 仓库不显示 |
| `· medium` | Thinking 级别，关闭时不显示 |
| `[████░░░░] 39%` | Context 窗口使用率进度条 |
| `⏱ 21m` | 会话已运行时长 |

进度条颜色：<font color="green">0-70% 绿色</font> / <font color="orange">70-90% 黄色</font> / <font color="red">90%+ 红色</font>

### Line 2 — 活动详情

```
AGENTS.md · skills x5 · ext.tools x2 · ✓ Grep ×10 · ◐ Edit (12s) · ◐ agent (2m 15s)
```

| 元素 | 说明 |
|------|------|
| `AGENTS.md` | 检测到的上下文配置文件（绿色） |
| `skills x5` | 已加载的 skill 数量 |
| `ext.tools x2` | 扩展注册的工具数量 |
| `cmds x3` | 扩展注册的 slash 命令数量 |
| `↑12.5k ↓3.2k` | Token 明细，仅 context ≥ 85% 时显示 |
| `$0.042` | 会话累计费用 |
| `✓ Grep ×10` | 已完成工具调用统计，按次数降序 |
| `◐ Edit (12s)` | 正在执行的工具，黄色 |
| `◐ agent (2m 15s)` | 正在运行的 Agent 循环，黄色 |

### Line 3 — 最近输入 + 历史提示

```
▸ how to build a REST API with authentication?  Ctrl+H:5
```

| 元素 | 说明 |
|------|------|
| `▸` | 指示符 |
| 用户文本 | 最近一次用户输入内容 |
| `Ctrl+H:5` | 历史记录数量提示（仅当历史 ≥ 2 条时显示） |

### Ctrl+H — 历史记录浮层

按 `Ctrl+H` 弹出会话输入历史：

```
┌ Session History ─────────────────────────────────────┐
│ ▸ how to build a REST API with authentication?      │
│   请帮我检查文档                                      │
│   帮我提交一下                                        │
├ ↑↓ scroll · Enter select · Esc close ───────────────┤
└──────────────────────────────────────────────────────┘
```

| 按键 | 功能 |
|------|------|
| `↑` / `k` | 上移选择 |
| `↓` / `j` | 下移选择 |
| `Enter` | 选中并回填到输入框 |
| `Esc` / `Ctrl+C` | 关闭浮层 |

详细文档见 [docs/pi-hud.md](docs/pi-hud.md)。

## 项目结构

```
pi-hub/
├── extensions/
│   └── pi-hud.ts        # 扩展源码
├── scripts/
│   └── install.js       # 安装脚本
├── docs/
│   └── pi-hud.md        # 详细文档
├── tsconfig.json
├── package.json
└── README.md
```

## 依赖

运行时依赖 pi-coding-agent 的 Extension API：

- `@mariozechner/pi-ai`
- `@mariozechner/pi-coding-agent`
- `@mariozechner/pi-tui`

无需额外安装 npm 包，扩展由 pi 运行时直接加载。

## License

MIT
