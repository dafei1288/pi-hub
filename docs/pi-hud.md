# Pi HUD — 状态栏扩展

Pi HUD 是一个 pi-coding-agent 扩展，在终端底部状态栏实时显示会话信息，灵感来自 [claude-hud](https://github.com/jarrodwatts/claude-hud)。

## 安装

### 方式一：使用安装脚本（推荐）

克隆仓库后使用安装脚本：

```bash
# 项目级安装（在目标项目根目录执行）
node /path/to/pi-hub/scripts/install.js

# 全局安装
node /path/to/pi-hub/scripts/install.js --global
```

### 方式二：Claude / Pi 一键安装

在 Claude 或 Pi 对话中直接说：

```
请帮我安装 pi-hub 的 Pi HUD 扩展到当前项目
```

如需全局安装：

```
请帮我全局安装 pi-hub 的 Pi HUD 扩展
```

### 方式三：手动复制

```bash
# 项目级
mkdir -p .pi/extensions
cp pi-hud.ts .pi/extensions/pi-hud.ts

# 全局 (Linux/macOS)
mkdir -p ~/.pi/agent/extensions
cp pi-hud.ts ~/.pi/agent/extensions/pi-hud.ts

# 全局 (Windows PowerShell)
mkdir -Force "$env:USERPROFILE\.pi\agent\extensions"
copy pi-hud.ts "$env:USERPROFILE\.pi\agent\extensions\pi-hud.ts"
```

### 方式四：命令行临时加载

仅对当前会话生效：

```bash
pi -e ./pi-hud.ts
```

### 验证

```bash
ls .pi/extensions/pi-hud.ts        # 项目级
ls ~/.pi/agent/extensions/pi-hud.ts # 全局
```

安装后重启 `pi` 或运行 `/reload` 激活。

---

## 显示内容

Pi HUD 显示 2~3 行状态信息：

```
[claude-sonnet-4-6] pi-mono git:(main) · medium    [████████░░░░░░░░░░░░] 39%    ⏱ 21m
AGENTS.md · skills x5 · ext.tools x2 · ✓ Grep ×10 · ✓ Bash ×3 · ◐ Edit (12s) · ◐ agent (2m 15s)
▸ how to build a REST API with authentication?
```

### Line 1 — 会话概览

三栏布局：左 — 中 — 右

| 区域 | 内容 | 示例 | 说明 |
|------|------|------|------|
| 左 | 模型名称 | `[claude-sonnet-4-6]` | 当前使用的 LLM 模型 ID |
| 左 | 项目名 | `pi-mono` | 当前工作目录名称 |
| 左 | Git 分支 | `git:(main)` | 当前 git 分支，非 git 仓库时不显示 |
| 左 | Thinking 级别 | `· medium` | 仅当模型支持推理且 thinking 非关闭时显示 |
| 中 | Context 进度条 | `[████████░░░░░░░░░░░░] 39%` | 当前上下文窗口使用率的可视化进度条 |
| 右 | 已用时间 | `⏱ 21m` | 当前会话已运行时长 |

**Context 进度条颜色：**

| 颜色 | 范围 | 含义 |
|------|------|------|
| 绿色 | 0% – 70% | 安全，上下文空间充足 |
| 黄色 | 70% – 90% | 警告，即将接近上限 |
| 红色 | 90%+ | 危险，接近自动压缩触发点 |

### Line 2 — 活动详情

从左到右依次排列，信息之间用 `·` 分隔：

| 内容 | 示例 | 说明 |
|------|------|------|
| 上下文文件 | `AGENTS.md` `CLAUDE.md` | 自动检测项目及全局目录中的配置文件，绿色显示文件名 |
| Skills 数量 | `skills x5` | 当前加载的 skill 数量 |
| 扩展工具数量 | `ext.tools x2` | 通过扩展注册的非内置工具数量 |
| 扩展命令数量 | `cmds x3` | 通过扩展注册的 slash 命令数量 |
| Token 明细 | `↑12.5k ↓3.2k` | 仅在 context ≥ 85% 时显示，输入/输出 token 统计 |
| 费用 | `$0.042` | 当前会话累计费用（USD） |
| 已完成工具 | `✓ Grep ×10` `✓ Bash ×3` | 工具调用次数统计，按使用次数降序 |
| 正在执行的工具 | `◐ Edit (12s)` | 黄色旋转图标 + 工具名 + 已执行时长 |
| 正在运行的 Agent | `◐ agent (2m 15s)` | 黄色旋转图标 + 运行时长 |

**上下文文件检测范围：**
- 全局：`~/.pi/agent/AGENTS.md`、`~/.pi/agent/CLAUDE.md`
- 项目：从当前目录向上遍历最多 20 级，查找 `AGENTS.md` 或 `CLAUDE.md`

### Line 3 — 最近用户输入

```
▸ how to build a REST API with authentication?
```

| 内容 | 说明 |
|------|------|
| `▸` | 指示符 |
| 用户文本 | 最近一次用户输入内容，截断到 200 字符 |

- 仅在有用户输入后显示
- 每次新输入自动更新
- 多行输入会合并为单行显示

---

## 数据来源

Pi HUD 通过 pi-coding-agent 的 Extension API 获取所有数据，无需外部进程或文件解析：

| 数据 | API |
|------|-----|
| 模型信息 | `ctx.model` |
| Git 分支 | `footerData.getGitBranch()` |
| Context 使用率 | `ctx.getContextUsage()` |
| Token 统计 | `ctx.sessionManager.getEntries()` |
| 工具列表 | `pi.getAllTools()` |
| 命令列表 | `pi.getCommands()` |
| Thinking 级别 | `pi.getThinkingLevel()` |
| 工具执行状态 | `tool_execution_start/end` 事件 |
| Agent 执行状态 | `agent_start/end` 事件 |
| 用户输入 | `input` 事件 |
| 上下文文件 | 文件系统扫描 `existsSync()` |

---

## 与 claude-hud 的对比

| 功能 | claude-hud | pi-hud | 备注 |
|------|-----------|--------|------|
| 模型名称 | ✅ | ✅ | |
| 项目路径 | ✅ | ✅ | |
| Git 分支 | ✅ | ✅ | |
| Git dirty `*` / ahead-behind `↑↓` | ✅ | — | 可通过 `pi.exec()` 扩展 |
| Context 进度条 | ✅ | ✅ | |
| Context 颜色分级 | ✅ | ✅ | |
| Token 明细（高 context 时） | ✅ | ✅ | 85%+ 显示 |
| 费用 | ✅ | ✅ | |
| Session 时长 | ✅ | ✅ | |
| Thinking 级别 | ✅ | ✅ | |
| 工具执行状态 | ✅ | ✅ | |
| Agent 追踪 | ✅ | ✅ | |
| 最近用户输入 | — | ✅ | pi-hud 独有 |
| 上下文文件检测 | ✅ | ✅ | |
| Skills / Ext.Tools 计数 | — | ✅ | pi-hud 独有 |
| Usage rate limits (5h/7d) | ✅ | — | Claude 订阅特有 |
| MCPs / Hooks 计数 | ✅ | — | Claude Code 插件体系 |
| Todo 进度 | ✅ | — | Claude Code TodoWrite |
| 输出速度 tok/s | ✅ | — | 可扩展 |
| 可配置布局/颜色 | ✅ | — | 可扩展 |

---

## 扩展路径

扩展文件位置：

```
.pi/extensions/pi-hud.ts          # 项目级（自动加载）
~/.pi/agent/extensions/pi-hud.ts  # 全局（自动加载）
```
