/**
 * Pi HUD Extension — claude-hud inspired status bar
 *
 * Line 1: [model] project git:(main* ↑2)    [████████░░] 39%    ⏱ 21m
 * Line 2: AGENTS.md · skills x5 · ext x2 · ↑12.5k ↓3.2k · $0.042 · ✓ Grep x10
 * Line 3: ▸ how to build a REST API with authentication?
 *
 * Ctrl+H: Open session input history overlay
 *
 * Configuration: .pi/pi-hud.json or ~/.pi/agent/pi-hud.json
 * Extensible: users can register custom HUD items via pi-hud-plugins/
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { Component, TUI } from "@mariozechner/pi-tui";
import { getKeybindings } from "@mariozechner/pi-tui";

// ============================================================================
// Types
// ============================================================================

/** A single HUD display element that can be toggled on/off */
type HudElement =
	| "model"          // Line 1: [model-name]
	| "project"        // Line 1: project directory name
	| "git"            // Line 1: git:(branch)
	| "thinking"       // Line 1: · medium
	| "contextBar"     // Line 1: [████░░] 39%
	| "elapsed"        // Line 1: ⏱ 21m
	| "contextFiles"   // Line 2: AGENTS.md
	| "skills"         // Line 2: skills x5
	| "extTools"       // Line 2: ext.tools x2
	| "extCmds"        // Line 2: cmds x3
	| "tokens"         // Line 2: ↑12.5k ↓3.2k
	| "cost"           // Line 2: $0.042
	| "toolStats"      // Line 2: ✓ Grep ×10
	| "runningTools"   // Line 2: ◐ Edit (12s)
	| "runningAgents"  // Line 2: ◐ agent (2m 15s)
	| "lastInput"      // Line 3: ▸ last user input
	| "historyHint";   // Line 3: Ctrl+H:5

/** User configuration for Pi HUD */
interface HudConfig {
	/** Which elements to show. Defaults to all. */
	enabled?: HudElement[];
	/** Which elements to hide. Takes precedence over enabled. */
	disabled?: HudElement[];
	/** Token display mode: "always" | "highContext" (85%+). Default: "always". */
	tokenMode?: "always" | "highContext";
	/** Token display threshold when tokenMode is "highContext". Default: 85. */
	tokenThreshold?: number;
}

/** Context data passed to custom HUD plugins */
interface HudContext {
	model: { id: string; reasoning: boolean } | undefined;
	branch: string | undefined;
	ctxPercent: number;
	projectName: string;
	totalInput: number;
	totalOutput: number;
	totalCost: number;
	skillCount: number;
	extToolCount: number;
	extCmdCount: number;
	thinking: string;
	elapsed: string;
	toolCounts: Map<string, number>;
	runningTools: Map<string, RunningTool>;
	runningAgents: Array<{ id: string; status: string; startTime: number }>;
	inputHistory: string[];
	lastUserInput: string;
	cwd: string;
	sessionStart: number;
}

/** A plugin that contributes custom content to HUD lines */
interface HudPlugin {
	/** Unique name for the plugin */
	name: string;
	/**
	 * Render custom content for a HUD line.
	 * Return a string to display, or undefined to skip.
	 * Plugins are called for every render cycle — keep it fast.
	 */
	render(ctx: HudContext, theme: HudTheme, width: number): string | undefined;
	/** Which line to target: "line1" | "line2" | "line3". Default: "line2". */
	target?: "line1" | "line2" | "line3";
	/** Sort order within the line. Lower = earlier. Default: 100. */
	order?: number;
}

/** Subset of theme API passed to plugins */
interface HudTheme {
	fg(color: "text" | "dim" | "accent" | "success" | "warning" | "error", text: string): string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	return `${h}h${m % 60}m`;
}

function formatTokens(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	return `${(n / 1_000_000).toFixed(1)}M`;
}

function progressBar(percent: number, barWidth: number): string {
	const filled = Math.round((percent / 100) * barWidth);
	const empty = barWidth - filled;
	return `[${"█".repeat(Math.max(0, filled))}${"░".repeat(Math.max(0, empty))}]`;
}

function ctxColor(theme: HudTheme, pct: number, text: string): string {
	if (pct > 90) return theme.fg("error", text);
	if (pct > 70) return theme.fg("warning", text);
	return theme.fg("success", text);
}

/** Detect AGENTS.md / CLAUDE.md from global + project dirs */
function detectContextFiles(cwd: string): string[] {
	const found: string[] = [];
	const candidates = ["AGENTS.md", "CLAUDE.md"];
	const seen = new Set<string>();

	const home = process.env.HOME || process.env.USERPROFILE;
	if (home) {
		for (const name of candidates) {
			if (existsSync(join(home, ".pi", "agent", name))) {
				found.push(`~/.pi/agent/${name}`);
				seen.add(name);
			}
		}
	}

	let dir = cwd;
	for (let i = 0; i < 20; i++) {
		for (const name of candidates) {
			if (seen.has(name)) continue;
			if (existsSync(join(dir, name))) {
				found.push(dir === cwd ? name : `${dir.split(/[/\\]/).pop()}/${name}`);
				seen.add(name);
			}
		}
		const parent = join(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return found;
}

/** Pad a string with spaces to reach a target visual width (CJK-aware) */
function padToWidth(text: string, targetWidth: number): string {
	const vw = visibleWidth(text);
	const gap = targetWidth - vw;
	return gap > 0 ? text + " ".repeat(gap) : text;
}

/** Load and merge config from .pi/pi-hud.json (project) and ~/.pi/agent/pi-hud.json (global) */
function loadConfig(cwd: string): HudConfig {
	const result: HudConfig = {
		tokenMode: "always",
		tokenThreshold: 85,
	};

	const paths = [
		join((process.env.HOME || process.env.USERPROFILE) || "", ".pi", "agent", "pi-hud.json"),
		join(cwd, ".pi", "pi-hud.json"),
	];

	for (const p of paths) {
		if (existsSync(p)) {
			try {
				const merged = { ...result, ...JSON.parse(readFileSync(p, "utf-8")) };
				Object.assign(result, merged);
			} catch {
				// ignore bad config
			}
		}
	}

	return result;
}

/** Load user plugins from .pi/pi-hud-plugins/*.ts or ~/.pi/agent/pi-hud-plugins/*.js */
function loadPlugins(cwd: string): HudPlugin[] {
	const plugins: HudPlugin[] = [];
	const dirs = [
		join((process.env.HOME || process.env.USERPROFILE) || "", ".pi", "agent", "pi-hud-plugins"),
		join(cwd, ".pi", "pi-hud-plugins"),
	];

	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		try {
			for (const file of readdirSync(dir)) {
				if (file.endsWith(".js") || file.endsWith(".ts")) {
					try {
						// eslint-disable-next-line @typescript-eslint/no-require-imports
						const mod = require(join(dir, file));
						const plugin: HudPlugin = mod.default || mod;
						if (plugin.name && typeof plugin.render === "function") {
							plugins.push(plugin);
						}
					} catch {
						// ignore bad plugin
					}
				}
			}
		} catch {
			// ignore unreadable dir
		}
	}

	return plugins;
}

// ============================================================================
// History Overlay Component
// ============================================================================

class HistoryOverlay implements Component {
	private items: string[];
	private selected: number;
	private scrollOffset: number;
	private maxVisible: number;
	private theme: any;
	private tui: TUI;
	private done: (result: string | undefined) => void;

	constructor(
		items: string[],
		theme: any,
		tui: TUI,
		done: (result: string | undefined) => void,
	) {
		this.items = items;
		this.theme = theme;
		this.tui = tui;
		this.done = done;
		this.selected = 0;
		this.scrollOffset = 0;
		this.maxVisible = Math.min(items.length, 10);
	}

	render(width: number): string[] {
		const lines: string[] = [];
		const innerW = width - 2; // │ borders

		// ┌─ Session History ────────────┐
		const titleText = " Session History ";
		const titlePadLen = Math.max(0, innerW - titleText.length);
		lines.push(
			this.theme.fg("dim", "┌") +
			this.theme.fg("accent", titleText) +
			this.theme.fg("dim", "─".repeat(titlePadLen) + "┐"),
		);

		// Items
		const prefixW = 3; // " ▸ " visual width
		const itemContentW = innerW - prefixW;
		const end = Math.min(this.scrollOffset + this.maxVisible, this.items.length);

		for (let i = this.scrollOffset; i < end; i++) {
			const raw = this.items[i].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
			const isSel = i === this.selected;

			const display = truncateToWidth(raw, itemContentW, "..");
			const padded = padToWidth(display, itemContentW);

			const prefix = isSel ? this.theme.fg("accent", " ▸ ") : "   ";
			const content = isSel ? this.theme.fg("text", padded) : this.theme.fg("dim", padded);

			lines.push(
				this.theme.fg("dim", "│") + prefix + content + this.theme.fg("dim", " │"),
			);
		}

		// Footer
		const footerText = " ↑↓ scroll · Enter select · Esc close ";
		const footerPadLen = Math.max(0, innerW - footerText.length);
		lines.push(
			this.theme.fg("dim", "├") +
			this.theme.fg("dim", footerText) +
			this.theme.fg("dim", "─".repeat(footerPadLen) + "┘"),
		);

		return lines;
	}

	handleInput(data: string): void {
		const kb = getKeybindings();

		if (kb.matches(data, "tui.select.up") || data === "k") {
			if (this.selected > 0) {
				this.selected--;
				if (this.selected < this.scrollOffset) this.scrollOffset--;
				this.tui.requestRender();
			}
		} else if (kb.matches(data, "tui.select.down") || data === "j") {
			if (this.selected < this.items.length - 1) {
				this.selected++;
				if (this.selected >= this.scrollOffset + this.maxVisible) this.scrollOffset++;
				this.tui.requestRender();
			}
		} else if (kb.matches(data, "tui.select.confirm") || data === "\n") {
			this.done(this.items[this.selected]);
		} else if (kb.matches(data, "tui.select.cancel")) {
			this.done(undefined);
		}
	}

	invalidate() {}
	dispose() {}
}

// ============================================================================
// Main Extension
// ============================================================================

interface RunningTool {
	name: string;
	startTime: number;
}

export default function (pi: ExtensionAPI) {
	let sessionStart = Date.now();
	let cachedCwd = "";
	let cachedContextFiles: string[] = [];
	let config: HudConfig = {};

	// Tool tracking
	const toolCounts = new Map<string, number>();
	const runningTools = new Map<string, RunningTool>();

	// Agent tracking
	const agentEntries: Array<{
		id: string;
		status: "running" | "completed";
		startTime: number;
		endTime?: number;
	}> = [];

	// User input history
	let lastUserInput = "";
	const inputHistory: string[] = [];

	// Loaded plugins
	let plugins: HudPlugin[] = [];

	function refreshContextFiles(cwd: string) {
		if (cwd !== cachedCwd) {
			cachedCwd = cwd;
			cachedContextFiles = detectContextFiles(cwd);
			config = loadConfig(cwd);
			plugins = loadPlugins(cwd);
		}
	}

	/** Check if an element should be displayed */
	function isEnabled(el: HudElement): boolean {
		// disabled takes precedence
		if (config.disabled?.includes(el)) return false;
		// if enabled list is specified, only show those
		if (config.enabled && config.enabled.length > 0) {
			return config.enabled.includes(el);
		}
		// default: all enabled
		return true;
	}

	// ---- Register Ctrl+H shortcut for history overlay ----
	pi.registerShortcut("ctrl+h", {
		description: "Browse session input history",
		handler: async (ctx) => {
			if (!ctx.hasUI) return;
			if (inputHistory.length === 0) {
				ctx.ui.notify("No input history yet", "info");
				return;
			}

			const history = [...inputHistory].reverse();

			const selected = await ctx.ui.custom<string | undefined>(
				(tui, theme, _keybindings, done) => {
					return new HistoryOverlay(history, theme, tui, done);
				},
				{
					overlay: true,
					overlayOptions: {
						width: "80%",
						maxHeight: "50%",
						anchor: "bottom-center",
						offsetY: -3,
					},
				},
			);

			if (selected) {
				ctx.ui.setEditorText(selected);
			}
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		sessionStart = Date.now();
		toolCounts.clear();
		runningTools.clear();
		agentEntries.length = 0;
		lastUserInput = "";
		inputHistory.length = 0;
		cachedCwd = "";
		refreshContextFiles(ctx.cwd);

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubBranch = footerData.onBranchChange(() => tui.requestRender());
			const timer = setInterval(() => tui.requestRender(), 30_000);

			// Wrap theme as HudTheme for plugins
			const hudTheme: HudTheme = {
				fg: (color, text) => theme.fg(color, text),
			};

			return {
				dispose() {
					unsubBranch();
					clearInterval(timer);
				},
				invalidate() {},
				render(width: number): string[] {
					refreshContextFiles(ctx.cwd);

					// ---- Data collection ----
					const model = ctx.model;
					const modelId = model?.id || "no-model";
					const branch = footerData.getGitBranch();
					const ctxUsage = ctx.getContextUsage();
					const ctxPercent = ctxUsage?.percent ?? 0;

					const cwd = ctx.sessionManager.getCwd();
					const projectName = cwd.split(/[/\\]/).pop() || cwd;

					let totalInput = 0;
					let totalOutput = 0;
					let totalCost = 0;
					for (const e of ctx.sessionManager.getEntries()) {
						if (e.type === "message" && e.message.role === "assistant") {
							const m = e.message as AssistantMessage;
							totalInput += m.usage.input;
							totalOutput += m.usage.output;
							totalCost += m.usage.cost.total;
						}
					}

					const allTools = pi.getAllTools();
					const commands = pi.getCommands();
					const builtinToolNames = new Set(["bash", "read", "edit", "write", "grep", "find", "ls"]);
					const extTools = allTools.filter((t) => !builtinToolNames.has(t.name));
					const skillCmds = commands.filter((c) => c.source === "skill");
					const extCmds = commands.filter((c) => c.source === "extension");
					const thinking = pi.getThinkingLevel();

					const elapsed = formatDuration(Date.now() - sessionStart);

					// Build HudContext for plugins
					const hudCtx: HudContext = {
						model: model ? { id: modelId, reasoning: model.reasoning } : undefined,
						branch: branch ?? undefined,
						ctxPercent,
						projectName,
						totalInput,
						totalOutput,
						totalCost,
						skillCount: skillCmds.length,
						extToolCount: extTools.length,
						extCmdCount: extCmds.length,
						thinking,
						elapsed,
						toolCounts,
						runningTools,
						runningAgents: agentEntries,
						inputHistory,
						lastUserInput,
						cwd,
						sessionStart,
					};

					// ================================================================
					// Line 1: [model] project git:(main) · medium    [████░░] 39%    ⏱ 21m
					// ================================================================
					const line1Parts: string[] = [];

					if (isEnabled("model")) {
						line1Parts.push(theme.fg("accent", `[${modelId}]`));
					}
					if (isEnabled("project")) {
						line1Parts.push(theme.fg("text", projectName));
					}
					if (isEnabled("git") && branch) {
						line1Parts.push(theme.fg("dim", `git:(${branch})`));
					}
					if (isEnabled("thinking") && model?.reasoning && thinking !== "off") {
						line1Parts.push(theme.fg("dim", thinking));
					}

					const line1Left = line1Parts.join(" ");

					// Progress bar (center)
					let ctxBar = "";
					if (isEnabled("contextBar")) {
						const left1W = visibleWidth(line1Left);
						const line1RightStr = isEnabled("elapsed") ? theme.fg("dim", `⏱ ${elapsed}`) : "";
						const right1W = visibleWidth(line1RightStr);
						const barAvail = width - left1W - right1W - 6;

						if (barAvail > 20 && ctxPercent != null) {
							const barW = Math.min(barAvail - 6, 20);
							ctxBar = ctxColor(theme, ctxPercent, `${progressBar(ctxPercent, barW)} ${Math.round(ctxPercent)}%`);
						} else if (ctxPercent != null) {
							ctxBar = ctxColor(theme, ctxPercent, `${Math.round(ctxPercent)}%`);
						} else {
							ctxBar = theme.fg("dim", "?%");
						}
					}

					const line1Right = isEnabled("elapsed") ? theme.fg("dim", `⏱ ${elapsed}`) : "";

					// Plugin content for line1
					const pluginLine1 = plugins
						.filter((p) => (p.target ?? "line2") === "line1")
						.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
						.map((p) => p.render(hudCtx, hudTheme, width))
						.filter((s): s is string => s != null);

					const left1W = visibleWidth(line1Left);
					const centerW = visibleWidth(ctxBar);
					const right1W = visibleWidth(line1Right);
					const totalRight = right1W + (pluginLine1.length > 0 ? visibleWidth(pluginLine1.join(" ")) + 2 : 0);
					const gap = width - left1W - centerW - totalRight;

					let line1: string;
					const extra = pluginLine1.length > 0 ? " " + pluginLine1.join(" ") : "";
					if (gap >= 2) {
						const lp = Math.floor(gap / 2);
						const rp = gap - lp;
						line1 = line1Left + " ".repeat(lp) + ctxBar + " ".repeat(rp) + line1Right + extra;
					} else {
						line1 = truncateToWidth(line1Left + "  " + ctxBar + "  " + line1Right + extra, width);
					}

					// ================================================================
					// Line 2: AGENTS.md · skills x5 · ↑12.5k ↓3.2k · $0.042 · ✓ Grep ×10
					// ================================================================
					const parts: string[] = [];

					// Context files
					if (isEnabled("contextFiles")) {
						for (const f of cachedContextFiles) {
							parts.push(theme.fg("success", f));
						}
					}

					// Resource counts
					if (isEnabled("skills") && skillCmds.length > 0) {
						parts.push(theme.fg("dim", `skills x${skillCmds.length}`));
					}
					if (isEnabled("extTools") && extTools.length > 0) {
						parts.push(theme.fg("dim", `ext.tools x${extTools.length}`));
					}
					if (isEnabled("extCmds") && extCmds.length > 0) {
						parts.push(theme.fg("dim", `cmds x${extCmds.length}`));
					}

					// Token breakdown — now always shown by default
					if (isEnabled("tokens") && totalInput > 0) {
						const threshold = config.tokenThreshold ?? 85;
						const showTokens = config.tokenMode === "always" || ctxPercent >= threshold;
						if (showTokens) {
							parts.push(theme.fg("dim", `↑${formatTokens(totalInput)} ↓${formatTokens(totalOutput)}`));
						}
					}

					if (isEnabled("cost") && totalCost > 0) {
						parts.push(theme.fg("dim", `$${totalCost.toFixed(3)}`));
					}

					// Completed tool stats
					if (isEnabled("toolStats")) {
						const sortedTools = Array.from(toolCounts.entries()).sort(([, a], [, b]) => b - a);
						for (const [name, count] of sortedTools) {
							parts.push(`${theme.fg("success", "✓")} ${theme.fg("dim", `${name} ×${count}`)}`);
						}
					}

					// Running tool indicator(s)
					if (isEnabled("runningTools")) {
						for (const tool of Array.from(runningTools.values())) {
							const dur = formatDuration(Date.now() - tool.startTime);
							parts.push(`${theme.fg("warning", "◐")} ${theme.fg("text", `${tool.name} (${dur})`)}`);
						}
					}

					// Running agents
					if (isEnabled("runningAgents")) {
						const runningAgentsList = agentEntries.filter((a) => a.status === "running");
						for (const agent of runningAgentsList.slice(-2)) {
							const dur = formatDuration(Date.now() - agent.startTime);
							parts.push(`${theme.fg("warning", "◐")} ${theme.fg("accent", `agent (${dur})`)}`);
						}
					}

					// Plugin content for line2
					const pluginLine2 = plugins
						.filter((p) => (p.target ?? "line2") === "line2")
						.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
						.map((p) => p.render(hudCtx, hudTheme, width))
						.filter((s): s is string => s != null);
					parts.push(...pluginLine2);

					const line2 = truncateToWidth(
						parts.join(theme.fg("dim", " · ")),
						width,
						theme.fg("dim", "..."),
					);

					// ================================================================
					// Line 3: Last user input + history hint
					// ================================================================
					let line3 = "";
					if (isEnabled("lastInput") && lastUserInput) {
						const truncated = lastUserInput.length > 200 ? lastUserInput.slice(0, 197) + "..." : lastUserInput;
						const inputDisplay = truncated.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

						const inputParts: string[] = [];
						inputParts.push(theme.fg("accent", "▸"));
						inputParts.push(theme.fg("dim", inputDisplay));

						if (isEnabled("historyHint") && inputHistory.length > 1) {
							inputParts.push(theme.fg("dim", `Ctrl+H:${inputHistory.length}`));
						}

						// Plugin content for line3
						const pluginLine3 = plugins
							.filter((p) => p.target === "line3")
							.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
							.map((p) => p.render(hudCtx, hudTheme, width))
							.filter((s): s is string => s != null);
						if (pluginLine3.length > 0) {
							inputParts.push(...pluginLine3);
						}

						line3 = truncateToWidth(
							inputParts.join(" "),
							width,
							theme.fg("dim", "..."),
						);
					}

					return line3 ? [line1, line2, line3] : [line1, line2];
				},
			};
		});
	});

	// ---- Track tool execution ----
	pi.on("tool_execution_start", async (event) => {
		runningTools.set(event.toolCallId, { name: event.toolName, startTime: Date.now() });
	});

	pi.on("tool_execution_end", async (event) => {
		runningTools.delete(event.toolCallId);
		if (event.toolName) {
			toolCounts.set(event.toolName, (toolCounts.get(event.toolName) || 0) + 1);
		}
	});

	// ---- Track agent loops ----
	pi.on("agent_start", async () => {
		agentEntries.push({ id: `agent-${Date.now()}`, status: "running", startTime: Date.now() });
	});

	pi.on("agent_end", async () => {
		const running = agentEntries.filter((a) => a.status === "running");
		if (running.length > 0) {
			const last = running[running.length - 1];
			last.status = "completed";
			last.endTime = Date.now();
		}
	});

	// ---- Track user input history ----
	pi.on("input", async (event) => {
		const text = event.text?.trim();
		if (text) {
			lastUserInput = text;
			inputHistory.push(text);
		}
	});
}

// Re-export types for plugin authors
export type { HudPlugin, HudContext, HudTheme };
