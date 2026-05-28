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
| Token 明细 | `↑12.5k ↓3.2k` | 默认始终显示，可配置为仅高占用时显示 |
| 费用 | `$0.042` | 当前会话累计费用（USD） |
| 已完成工具 | `✓ Grep ×10` `✓ Bash ×3` | 工具调用次数统计，按使用次数降序 |
| 正在执行的工具 | `◐ Edit (12s)` | 黄色旋转图标 + 工具名 + 已执行时长 |
| 正在运行的 Agent | `◐ agent (2m 15s)` | 黄色旋转图标 + 运行时长 |

**上下文文件检测范围：**
- 全局：`~/.pi/agent/AGENTS.md`、`~/.pi/agent/CLAUDE.md`
- 项目：从当前目录向上遍历最多 20 级，查找 `AGENTS.md` 或 `CLAUDE.md`

### Line 3 — 最近用户输入 + 历史提示

```
▸ how to build a REST API with authentication?  Ctrl+H:5
```

| 内容 | 说明 |
|------|------|
| `▸` | 指示符 |
| 用户文本 | 最近一次用户输入内容，截断到 200 字符 |
| `Ctrl+H:5` | 历史记录数量提示（仅当历史 ≥ 2 条时显示） |

- 仅在有用户输入后显示
- 每次新输入自动更新
- 多行输入会合并为单行显示

### Ctrl+H — 历史记录浮层

按 `Ctrl+H` 弹出会话输入历史浮层（最新的在最上面）：

```
┌ Session History ─────────────────────────────────────┐
│ ▸ how to build a REST API with authentication?      │
│   请帮我检查文档                                      │
│   帮我提交一下                                        │
│   推送吧                                              │
├ ↑↓ scroll · Enter select · Esc close ───────────────┤
└──────────────────────────────────────────────────────┘
```

| 按键 | 功能 |
|------|------|
| `↑` / `k` | 上移选择 |
| `↓` / `j` | 下移选择 |
| `Enter` | 选中并回填到输入框 |
| `Esc` / `Ctrl+C` | 关闭浮层 |

- 最多显示 10 条，超出可滚动浏览
- 选中后文本回填到编辑器，方便重新发送或修改
- 浮层定位在 HUD 上方，不遮挡主内容区

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
| 历史浮层 | `pi.registerShortcut()` + `ctx.ui.custom()` |
| 配置 | `.pi/pi-hud.json` + `~/.pi/agent/pi-hud.json` |
| 插件 | `.pi/pi-hud-plugins/*.js` + `~/.pi/agent/pi-hub-plugins/*.js` |
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
| Token 明细（高 context 时） | ✅ | ✅ | 默认始终显示，可配置 |
| 费用 | ✅ | ✅ | |
| Session 时长 | ✅ | ✅ | |
| Thinking 级别 | ✅ | ✅ | |
| 工具执行状态 | ✅ | ✅ | |
| Agent 追踪 | ✅ | ✅ | |
| 最近用户输入 | — | ✅ | pi-hud 独有 |
| 输入历史浮层 (Ctrl+H) | — | ✅ | pi-hud 独有 |
| 上下文文件检测 | ✅ | ✅ | |
| Skills / Ext.Tools 计数 | — | ✅ | pi-hud 独有 |
| 插件系统 | — | ✅ | pi-hub 独有 |
| 网格布局 (1/2/4 列) | — | ✅ | pi-hub 独有 |
| Usage rate limits (5h/7d) | ✅ | — | Claude 订阅特有 |
| MCPs / Hooks 计数 | ✅ | — | Claude Code 插件体系 |
| Todo 进度 | ✅ | — | Claude Code TodoWrite |
| 输出速度 tok/s | ✅ | — | 可通过插件扩展 |
| 可配置布局/颜色 | ✅ | ✅ | 通过 pi-hud.json + layout + placement + 插件系统 |

---

## 配置

在 `.pi/pi-hud.json`（项目级）或 `~/.pi/agent/pi-hud.json`（全局）中配置显示选项。

### 配置项

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `tokenMode` | `"always"` \| `"highContext"` | `"always"` | Token 显示模式：始终显示 / 仅高占用时显示 |
| `tokenThreshold` | `number` | `85` | `highContext` 模式下的显示阈值（百分比） |
| `enabled` | `string[]` | 全部 | 只显示指定的元素 |
| `disabled` | `string[]` | `[]` | 隐藏指定的元素（优先级高于 enabled） |
| `layout` | `number[]` | 无（经典模式） | 每行列数数组，最多 5 行，每行 1/2/4 列 |
| `placement` | `Record<string, {line, col}>` | 无 | 把元素钉到指定格子，仅网格模式生效 |

### 可配置元素列表

| 元素 ID | 说明 |
|---------|------|
| `model` | 模型名称 `[claude-sonnet-4-6]` |
| `project` | 项目目录名 |
| `git` | Git 分支 `git:(main)` |
| `thinking` | Thinking 级别 `· medium` |
| `contextBar` | Context 进度条 `[████░░] 39%` |
| `elapsed` | 会话时长 `⏱ 21m` |
| `contextFiles` | 上下文配置文件 `AGENTS.md` |
| `skills` | Skill 数量 |
| `extTools` | 扩展工具数量 |
| `extCmds` | 扩展命令数量 |
| `tokens` | Token 明细 `↑12.5k ↓3.2k` |
| `cost` | 费用 `$0.042` |
| `rateLimit` | API 额度剩余 `⚡ 85% 120k/400k` |
| `toolStats` | 已完成工具统计 `✓ Grep ×10` |
| `runningTools` | 正在执行的工具 `◐ Edit (12s)` |
| `runningAgents` | 正在运行的 Agent `◐ agent (2m 15s)` |
| `lastInput` | 最近用户输入 |
| `historyHint` | Ctrl+H 历史提示 |

### 配置示例

```jsonc
// 始终显示 Token，隐藏命令数和费用
{
  "tokenMode": "always",
  "disabled": ["extCmds", "cost"]
}
```

```jsonc
// 极简模式：只显示核心信息
{
  "enabled": ["model", "project", "git", "contextBar", "elapsed", "tokens", "toolStats"]
}
```

```jsonc
// Token 仅在 90% 以上时显示
{
  "tokenMode": "highContext",
  "tokenThreshold": 90
}
```

---

## 网格布局

默认不设 `layout` 时，行为与经典单栏完全一致。设置 `layout` 后启用网格分栏模式。

### 配置

```jsonc
{
  // 每行列数，最多 5 行，每行 1/2/4 列
  // 例：[1, 2, 2] = Line1全宽 + Line2两列 + Line3两列
  "layout": [1, 2, 2],

  // 把元素钉到指定格子 { line: 0起, col: 0起 }
  // 未列出的元素自动从左到右、从上到下填充
  "placement": {
    "tokens":   { "line": 1, "col": 0 },
    "cost":     { "line": 1, "col": 0 },
    "toolStats": { "line": 1, "col": 1 },
    "lastInput": { "line": 2, "col": 0 },
    "plugin:random-quote": { "line": 2, "col": 1 }
  }
}
```

### 渲染效果

**2 列分栏**（`layout: [1, 2, 2]`）：

```
Line 1 (全宽):
[claude-sonnet-4-6] pi-hub git:(main) · medium    [████░░] 39%    ⏱ 21m

Line 2 (2列):
AGENTS.md · ↑12.5k ↓3.2k          │  ✓ Grep ×10 · ✓ Bash ×3

Line 3 (2列):
▸ how to build a REST API with auth? │  💬 温故而知新，可以为师矣。—— 孔子
```

**5 行仪表盘**（`layout: [1, 2, 2, 2, 4]`，最多 4×5=20 格）：

```
Line 1: [全宽]  模型 + 项目 + 进度条 + 时长
Line 2: [2列]   状态信息     │  资源统计
Line 3: [2列]   工具统计     │  运行状态
Line 4: [2列]   最近输入     │  💬 谏言
Line 5: [4列]   col0 │ col1 │ col2 │ col3
```

### 分配规则

1. 有 `placement` 的元素 → 固定到指定格子
2. 没有 `placement` 的 → 按 target 分配到对应行
3. 行内多列时，按 order 从小到大，依次填入各列
4. 列内容超宽自动截断
5. 多列之间用 `│` 分隔

### Layout Demo 文件

| 文件 | 说明 |
|------|------|
| [examples/layout-2col-demo.json](../examples/layout-2col-demo.json) | 2 列分栏布局 |
| [examples/layout-dashboard-demo.json](../examples/layout-dashboard-demo.json) | 5 行仪表盘布局 |

---

## 插件系统

Pi HUD 支持用户编写自定义插件，向 HUD 添加任何自定义内容。

### 插件位置

- 项目级：`.pi/pi-hud-plugins/*.js`
- 全局级：`~/.pi/agent/pi-hub-plugins/*.js`

### 插件接口

```typescript
interface HudPlugin {
  /** 唯一名称 */
  name: string;
  /** 目标行："line1" | "line2" | "line3" | "line4" | "line5"，默认 "line2" */
  target?: "line1" | "line2" | "line3" | "line4" | "line5";
  /** 排序权重，越小越靠前，默认 100 */
  order?: number;
  /** 网格模式下列号（0起），不设则自动分配 */
  col?: number;
  /** 渲染函数，每次 HUD 刷新时调用，需保持快速 */
  render(ctx: HudContext, theme: HudTheme, width: number): string | undefined;
}
```

### HudContext 数据

`render()` 接收完整的 HUD 数据上下文：

| 字段 | 类型 | 说明 |
|------|------|------|
| `model` | `{ id, reasoning }` | 当前模型信息 |
| `branch` | `string` | Git 分支 |
| `ctxPercent` | `number` | Context 使用百分比 |
| `projectName` | `string` | 项目目录名 |
| `totalInput` | `number` | 总输入 Token |
| `totalOutput` | `number` | 总输出 Token |
| `totalCost` | `number` | 总费用（USD） |
| `skillCount` | `number` | Skill 数量 |
| `extToolCount` | `number` | 扩展工具数量 |
| `extCmdCount` | `number` | 扩展命令数量 |
| `thinking` | `string` | Thinking 级别 |
| `elapsed` | `string` | 会话时长（格式化） |
| `toolCounts` | `Map<string, number>` | 工具调用次数统计 |
| `runningTools` | `Map<string, RunningTool>` | 正在运行的工具 |
| `runningAgents` | `Array` | 正在运行的 Agent |
| `inputHistory` | `string[]` | 用户输入历史 |
| `lastUserInput` | `string` | 最近一条输入 |
| `cwd` | `string` | 当前工作目录 |
| `sessionStart` | `number` | 会话开始时间戳 |

### HudTheme API

```typescript
interface HudTheme {
  fg(color: "text" | "dim" | "accent" | "success" | "warning" | "error", text: string): string;
}
```

### 示例插件

**轮次计数器**（`.pi/pi-hud-plugins/turn-counter.js`）：

```js
module.exports = {
  name: "turn-counter",
  target: "line2",
  order: 50,
  render(ctx, theme) {
    const turns = ctx.inputHistory.length;
    if (turns === 0) return undefined;
    return theme.fg("dim", `🔁 ${turns} turn${turns > 1 ? "s" : ""}`);
  },
};
```

**时钟**（`~/.pi/agent/pi-hub-plugins/clock.js`）：

```js
module.exports = {
  name: "clock",
  target: "line1",
  order: 200,
  render(_ctx, theme) {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    return theme.fg("dim", `🕐 ${h}:${m}`);
  },
};
```

更多示例见 [examples/](../examples/) 目录。

---

## 扩展路径

扩展文件位置：

```
.pi/extensions/pi-hud.ts          # 项目级（自动加载）
~/.pi/agent/extensions/pi-hud.ts  # 全局（自动加载）
```
