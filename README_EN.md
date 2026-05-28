# Pi Hub — Pi HUD Extension

Pi HUD is a status bar extension for [pi-coding-agent](https://github.com/nicholasgasior/pi) that displays real-time session information at the bottom of the terminal.

Inspired by [claude-hud](https://github.com/jarrodwatts/claude-hud).

![](docs/intro.png)

## Preview

```
[claude-sonnet-4-6] pi-mono git:(main) · medium    [████████░░░░░░░░░░░░] 39%    ⏱ 21m
AGENTS.md · skills x5 · ext.tools x2 · ✓ Grep ×10 · ✓ Bash ×3 · ◐ Edit (12s) · ◐ agent (2m 15s)
▸ how to build a REST API with authentication?
```

## Installation

### Option 1: Clone & Install (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/dafei1288/pi-hub.git
# Or place it in a local directory, e.g. ~/pi-hub

# 2. Project-level installation (run in the target project root)
node /path/to/pi-hub/scripts/install.js
# Example: node ~/pi-hub/scripts/install.js

# 3. Global installation (applies to all projects)
node ~/pi-hub/scripts/install.js --global
```

### Option 2: Claude / Pi One-Click Install

In a Claude or Pi conversation, simply say:

```
Please install the pi-hub Pi HUD extension to the current project
```

The agent will execute the installation script automatically. For global installation:

```
Please install the pi-hub Pi HUD extension globally
```

### Option 3: Manual Copy

```bash
mkdir -p .pi/extensions
cp extensions/pi-hud.ts .pi/extensions/pi-hud.ts
```

### Option 4: CLI Temporary Load

```bash
pi -e /path/to/pi-hub/extensions/pi-hud.ts
```

### Verify Installation

```bash
# Check project-level installation
ls .pi/extensions/pi-hud.ts

# Check global installation
ls ~/.pi/agent/extensions/pi-hud.ts
```

After installation, restart pi or type `/reload` in a session to activate.

## Display Content

### Line 1 — Session Overview

```
[Model] Project git:(Branch) · Thinking Level    [████░░░░] 39%    ⏱ 21m
```

| Element | Description |
|---------|-------------|
| `[Model]` | Current LLM model ID |
| Project | Current working directory name |
| `git:(Branch)` | Git branch; hidden if not a git repo |
| `· medium` | Thinking level; hidden when disabled |
| `[████░░░░] 39%` | Context window usage progress bar |
| `⏱ 21m` | Session elapsed time |

Progress bar colors: <font color="green">0–70% green</font> / <font color="orange">70–90% yellow</font> / <font color="red">90%+ red</font>

### Line 2 — Activity Details

```
AGENTS.md · skills x5 · ext.tools x2 · ✓ Grep ×10 · ◐ Edit (12s) · ◐ agent (2m 15s)
```

| Element | Description |
|---------|-------------|
| `AGENTS.md` | Detected context config file (green) |
| `skills x5` | Number of loaded skills |
| `ext.tools x2` | Number of tools registered by extensions |
| `cmds x3` | Number of slash commands registered by extensions |
| `↑12.5k ↓3.2k` | Token breakdown; shown by default, configurable |
| `$0.042` | Cumulative session cost |
| `✓ Grep ×10` | Completed tool call stats, sorted by count descending |
| `◐ Edit (12s)` | Running tool (yellow) |
| `◐ agent (2m 15s)` | Running agent loop (yellow) |

### Line 3 — Latest Input + History Hint

```
▸ how to build a REST API with authentication?  Ctrl+H:5
```

| Element | Description |
|---------|-------------|
| `▸` | Indicator |
| User text | Most recent user input |
| `Ctrl+H:5` | History count hint (shown when history ≥ 2) |

### Ctrl+H — Session History Overlay

Press `Ctrl+H` to open a scrollable history overlay:

```
┌ Session History ─────────────────────────────────────┐
│ ▸ how to build a REST API with authentication?      │
│   Please check the docs                              │
│   Commit the changes                                 │
├ ↑↓ scroll · Enter select · Esc close ───────────────┤
└──────────────────────────────────────────────────────┘
```

| Key | Action |
|-----|--------|
| `↑` / `k` | Move selection up |
| `↓` / `j` | Move selection down |
| `Enter` | Select and paste into editor |
| `Esc` / `Ctrl+C` | Close overlay |

For detailed documentation, see [docs/pi-hud.md](docs/pi-hud.md).

## Configuration

Configure via `.pi/pi-hud.json` (project) or `~/.pi/agent/pi-hud.json` (global):

```jsonc
{
  // Token display: "always" | "highContext" (only when context is high)
  "tokenMode": "always",
  "tokenThreshold": 85,

  // Show/hide elements
  "disabled": ["extCmds", "cost"],

  // Or only show specified elements (mutually exclusive with disabled)
  // "enabled": ["model", "project", "git", "contextBar", "elapsed", "tokens"]
}
```

**Configurable elements:**

| Element | Description | Default |
|---------|-------------|----------|
| `model` | Model name | ✅ |
| `project` | Project directory name | ✅ |
| `git` | Git branch | ✅ |
| `thinking` | Thinking level | ✅ |
| `contextBar` | Context progress bar | ✅ |
| `elapsed` | Session elapsed time | ✅ |
| `contextFiles` | Context config files | ✅ |
| `skills` | Skill count | ✅ |
| `extTools` | Extension tools count | ✅ |
| `extCmds` | Extension commands count | ✅ |
| `tokens` | Token breakdown | ✅ |
| `cost` | Session cost | ✅ |
| `toolStats` | Completed tool stats | ✅ |
| `runningTools` | Running tools | ✅ |
| `runningAgents` | Running agents | ✅ |
| `lastInput` | Last user input | ✅ |
| `historyHint` | Ctrl+H history hint | ✅ |

See [examples/pi-hud.json](examples/pi-hud.json) for a full configuration example.

## Plugin System

Users can write custom plugins to add any content to the HUD.

Place plugins in `.pi/pi-hud-plugins/*.js` (project) or `~/.pi/agent/pi-hub-plugins/*.js` (global).

**Plugin interface:**

```js
module.exports = {
  name: "my-plugin",        // Unique name
  target: "line2",         // "line1" | "line2" | "line3"
  order: 100,              // Sort order, lower = earlier

  render(ctx, theme, width) {
    // ctx: all HUD data
    // theme.fg(color, text): color, color = text|dim|accent|success|warning|error
    // width: terminal width
    // Return string to display, or undefined to skip
    return theme.fg("dim", `🔁 ${ctx.inputHistory.length} turns`);
  },
};
```

**Example plugins:**

| File | Description |
|------|-------------|
| [examples/turn-counter-plugin.js](examples/turn-counter-plugin.js) | Turn counter |
| [examples/clock-plugin.js](examples/clock-plugin.js) | Clock on Line 1 |
| [examples/context-emoji-plugin.js](examples/context-emoji-plugin.js) | Emoji context indicator |

## Project Structure

```
pi-hub/
├── extensions/
│   └── pi-hud.ts            # Extension source code
├── scripts/
│   └── install.js           # Installation script
├── examples/
│   ├── pi-hud.json           # Configuration example
│   ├── turn-counter-plugin.js # Plugin example: turn counter
│   ├── clock-plugin.js       # Plugin example: clock
│   └── context-emoji-plugin.js # Plugin example: emoji context
├── docs/
│   └── pi-hud.md             # Detailed documentation
├── tsconfig.json
├── package.json
├── README.md
└── README_EN.md
```

## Dependencies

Runtime depends on the pi-coding-agent Extension API:

- `@mariozechner/pi-ai`
- `@mariozechner/pi-coding-agent`
- `@mariozechner/pi-tui`

No additional npm packages are required — extensions are loaded directly by the pi runtime.

## License

MIT
