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

/** Pin an element to a specific cell in the grid */
interface Placement {
	/** 0-indexed line number (0-4) */
	line: number;
	/** 0-indexed column number */
	col: number;
}

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
	/**
	 * Layout: array of column counts per line. Max 5 lines, each 1/2/4 columns.
	 * Undefined = classic single-column mode (current behavior).
	 * Example: [1, 2, 2] means Line1=full, Line2=2-col, Line3=2-col.
	 */
	layout?: [number, ...number[]];
	/**
	 * Pin elements to specific cells. Only effective when layout is set.
	 * Key = element id or plugin name, value = { line, col }.
	 * Elements not listed here auto-distribute left-to-right, top-to-bottom.
	 */
	placement?: Record<string, Placement>;
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

/** A plugin that contributes custom content to HUD cells */
interface HudPlugin {
	/** Unique name for the plugin */
	name: string;
	/**
	 * Render custom content for a HUD cell.
	 * Return a string to display, or undefined to skip.
	 * Plugins are called for every render cycle — keep it fast.
	 */
	render(ctx: HudContext, theme: HudTheme, width: number): string | undefined;
	/** Which line to target: "line1" | ... | "line5". Default: "line2". */
	target?: "line1" | "line2" | "line3" | "line4" | "line5";
	/** Sort order within the line. Lower = earlier. Default: 100. */
	order?: number;
	/**
	 * Column index (0-based) when layout mode is active.
	 * If omitted, auto-distributes.
	 */
	col?: number;
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

/** Strip ANSI escape sequences and return visible length */
function ansiVisibleLen(s: string): number {
	// eslint-disable-next-line no-control-regex
	return s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b[^\x1b]*\x07/g, "").length;
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
		const innerW = width - 2;

		const titleText = " Session History ";
		const titlePadLen = Math.max(0, innerW - titleText.length);
		lines.push(
			this.theme.fg("dim", "┌") +
			this.theme.fg("accent", titleText) +
			this.theme.fg("dim", "─".repeat(titlePadLen) + "┐"),
		);

		const prefixW = 3;
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
// Cell-based layout renderer
// ============================================================================

/**
 * A renderable item — either a built-in element or a plugin.
 * Produces one chunk of styled text for a single cell.
 */
interface CellItem {
	/** Unique key for placement lookup */
	key: string;
	/** Which line index this targets by default (0-based) */
	defaultLine: number;
	/** Sort order within a line */
	order: number;
	/** Explicit column from plugin or placement, or undefined for auto */
	fixedCol: number | undefined;
	/** Render this item's content */
	render(): string | undefined;
}

/**
 * Render a grid of cells into output lines.
 *
 * @param layout   Column counts per row, e.g. [1, 2, 2]
 * @param cellItems Items to distribute into cells
 * @param totalWidth Terminal width
 * @param sep     Column separator string (ANSI-safe)
 * @returns Array of rendered line strings
 */
function renderGrid(
	layout: number[],
	cellItems: CellItem[],
	totalWidth: number,
	sep: string,
): string[] {
	const numCols = layout.reduce((a, b) => Math.max(a, b), 0);
	const sepW = visibleWidth(sep);
	// Each column gets equal width; separators take space between columns
	const colW = Math.floor((totalWidth - (numCols - 1) * sepW) / numCols);

	// Build a grid: grid[line][col] = rendered content or ""
	const grid: string[][] = [];
	for (let i = 0; i < layout.length; i++) {
		grid.push(new Array(layout[i]).fill(""));
	}

	// Track which cells are occupied (for placement)
	const occupied = new Set<string>();
	const cellKey = (line: number, col: number) => `${line}:${col}`;

	// First pass: items with fixed placement
	for (const item of cellItems) {
		const place = item.fixedCol;
		if (place === undefined) continue;

		// Determine target line
		let targetLine = item.defaultLine;
		if (targetLine >= layout.length) targetLine = layout.length - 1;

		const targetCol = Math.min(place, layout[targetLine] - 1);
		const key = cellKey(targetLine, targetCol);

		if (!occupied.has(key)) {
			const content = item.render();
			if (content != null) {
				grid[targetLine][targetCol] = content;
				occupied.add(key);
			}
		}
	}

	// Second pass: auto-distribute remaining items
	for (const item of cellItems) {
		if (item.fixedCol !== undefined) continue; // already placed

		const content = item.render();
		if (content == null) continue;

		let targetLine = item.defaultLine;
		if (targetLine >= layout.length) targetLine = layout.length - 1;

		// Find first empty cell in this line, then overflow to next lines
		let placed = false;
		for (let l = targetLine; l < layout.length && !placed; l++) {
			for (let c = 0; c < layout[l] && !placed; c++) {
				if (!occupied.has(cellKey(l, c))) {
					// For multi-col items in a single-col line, truncate to full width
					const availW = layout[l] === 1 ? totalWidth : colW;
					const truncated = truncateToWidth(content, availW, "…");
					grid[l][c] = layout[l] === 1 ? padToWidth(truncated, totalWidth) : padToWidth(truncated, colW);
					occupied.add(cellKey(l, c));
					placed = true;
				}
			}
		}

		// If all lines full, append to last cell of last line
		if (!placed) {
			const lastLine = layout.length - 1;
			const lastCol = layout[lastLine] - 1;
			const existing = grid[lastLine][lastCol];
			const availW = layout[lastLine] === 1 ? totalWidth : colW;
			const combined = existing ? existing + " · " + content : content;
			grid[lastLine][lastCol] = truncateToWidth(padToWidth(combined, availW), availW, "…");
		}
	}

	// Render each row
	const lines: string[] = [];
	for (let l = 0; l < layout.length; l++) {
		const cols = layout[l];
		if (cols === 1) {
			// Full-width line — truncate to totalWidth
			const raw = grid[l][0] || "";
			lines.push(truncateToWidth(padToWidth(raw, totalWidth), totalWidth));
		} else {
			// Multi-column line — join with separator
			const rendered: string[] = [];
			for (let c = 0; c < cols; c++) {
				const raw = grid[l][c] || "";
				rendered.push(truncateToWidth(padToWidth(raw, colW), colW));
			}
			lines.push(rendered.join(sep));
		}
	}

	return lines;
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

	const toolCounts = new Map<string, number>();
	const runningTools = new Map<string, RunningTool>();

	const agentEntries: Array<{
		id: string;
		status: "running" | "completed";
		startTime: number;
		endTime?: number;
	}> = [];

	let lastUserInput = "";
	const inputHistory: string[] = [];

	let plugins: HudPlugin[] = [];

	function refreshContextFiles(cwd: string) {
		if (cwd !== cachedCwd) {
			cachedCwd = cwd;
			cachedContextFiles = detectContextFiles(cwd);
			config = loadConfig(cwd);
			plugins = loadPlugins(cwd);
		}
	}

	function isEnabled(el: HudElement): boolean {
		if (config.disabled?.includes(el)) return false;
		if (config.enabled && config.enabled.length > 0) {
			return config.enabled.includes(el);
		}
		return true;
	}

	/** Map target string to 0-based line index */
	function targetToLine(target: string | undefined): number {
		switch (target ?? "line2") {
			case "line1": return 0;
			case "line2": return 1;
			case "line3": return 2;
			case "line4": return 3;
			case "line5": return 4;
			default: return 1;
		}
	}

	// ---- Register Ctrl+H shortcut ----
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
					// Build all renderable items
					// ================================================================
					const sep = theme.fg("dim", "│");

					// --- Line 1 elements ---
					const line1Parts: string[] = [];
					if (isEnabled("model")) line1Parts.push(theme.fg("accent", `[${modelId}]`));
					if (isEnabled("project")) line1Parts.push(theme.fg("text", projectName));
					if (isEnabled("git") && branch) line1Parts.push(theme.fg("dim", `git:(${branch})`));
					if (isEnabled("thinking") && model?.reasoning && thinking !== "off") {
						line1Parts.push(theme.fg("dim", thinking));
					}
					const line1Left = line1Parts.join(" ");

					let ctxBar = "";
					if (isEnabled("contextBar")) {
						const line1RightStr = isEnabled("elapsed") ? theme.fg("dim", `⏱ ${elapsed}`) : "";
						const leftW = visibleWidth(line1Left);
						const rightW = visibleWidth(line1RightStr);
						const barAvail = width - leftW - rightW - 6;
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

					// Line 1 has special center-aligned layout
					const line1Items: CellItem[] = [{
						key: "_line1_main",
						defaultLine: 0,
						order: 0,
						fixedCol: config.placement?._line1_main?.col,
						render: () => {
							const leftW = visibleWidth(line1Left);
							const centerW = visibleWidth(ctxBar);
							const rightW = visibleWidth(line1Right);
							const gap = width - leftW - centerW - rightW;
							if (gap >= 2) {
								const lp = Math.floor(gap / 2);
								const rp = gap - lp;
								return line1Left + " ".repeat(lp) + ctxBar + " ".repeat(rp) + line1Right;
							}
							return truncateToWidth(line1Left + "  " + ctxBar + "  " + line1Right, width);
						},
					}];

					// --- Line 2 elements ---
					const line2Items: CellItem[] = [];

					if (isEnabled("contextFiles")) {
						for (const f of cachedContextFiles) {
							line2Items.push({
								key: `ctxFile:${f}`,
								defaultLine: 1, order: 0,
								fixedCol: config.placement?.[`ctxFile:${f}`]?.col,
								render: () => theme.fg("success", f),
							});
						}
					}
					if (isEnabled("skills") && skillCmds.length > 0) {
						line2Items.push({
							key: "skills", defaultLine: 1, order: 1,
							fixedCol: config.placement?.skills?.col,
							render: () => theme.fg("dim", `skills x${skillCmds.length}`),
						});
					}
					if (isEnabled("extTools") && extTools.length > 0) {
						line2Items.push({
							key: "extTools", defaultLine: 1, order: 2,
							fixedCol: config.placement?.extTools?.col,
							render: () => theme.fg("dim", `ext.tools x${extTools.length}`),
						});
					}
					if (isEnabled("extCmds") && extCmds.length > 0) {
						line2Items.push({
							key: "extCmds", defaultLine: 1, order: 3,
							fixedCol: config.placement?.extCmds?.col,
							render: () => theme.fg("dim", `cmds x${extCmds.length}`),
						});
					}
					if (isEnabled("tokens") && totalInput > 0) {
						const threshold = config.tokenThreshold ?? 85;
						const showTokens = config.tokenMode === "always" || ctxPercent >= threshold;
						if (showTokens) {
							line2Items.push({
								key: "tokens", defaultLine: 1, order: 4,
								fixedCol: config.placement?.tokens?.col,
								render: () => theme.fg("dim", `↑${formatTokens(totalInput)} ↓${formatTokens(totalOutput)}`),
							});
						}
					}
					if (isEnabled("cost") && totalCost > 0) {
						line2Items.push({
							key: "cost", defaultLine: 1, order: 5,
							fixedCol: config.placement?.cost?.col,
							render: () => theme.fg("dim", `$${totalCost.toFixed(3)}`),
						});
					}
					if (isEnabled("toolStats")) {
						const sortedTools = Array.from(toolCounts.entries()).sort(([, a], [, b]) => b - a);
						for (const [name, count] of sortedTools) {
							line2Items.push({
								key: `tool:${name}`, defaultLine: 1, order: 10,
								fixedCol: config.placement?.[`tool:${name}`]?.col,
								render: () => `${theme.fg("success", "✓")} ${theme.fg("dim", `${name} ×${count}`)}`,
							});
						}
					}
					if (isEnabled("runningTools")) {
						for (const tool of Array.from(runningTools.values())) {
							line2Items.push({
								key: `running:${tool.name}`, defaultLine: 1, order: 20,
								fixedCol: config.placement?.[`running:${tool.name}`]?.col,
								render: () => `${theme.fg("warning", "◐")} ${theme.fg("text", `${tool.name} (${formatDuration(Date.now() - tool.startTime)})`)}`,
							});
						}
					}
					if (isEnabled("runningAgents")) {
						const running = agentEntries.filter((a) => a.status === "running");
						for (const agent of running.slice(-2)) {
							line2Items.push({
								key: "runningAgent", defaultLine: 1, order: 21,
								fixedCol: config.placement?.runningAgent?.col,
								render: () => `${theme.fg("warning", "◐")} ${theme.fg("accent", `agent (${formatDuration(Date.now() - agent.startTime)})`)}`,
							});
						}
					}

					// --- Line 3 elements ---
					const line3Items: CellItem[] = [];
					if (isEnabled("lastInput") && lastUserInput) {
						line3Items.push({
							key: "lastInput", defaultLine: 2, order: 0,
							fixedCol: config.placement?.lastInput?.col,
							render: () => {
								const truncated = lastUserInput.length > 200 ? lastUserInput.slice(0, 197) + "..." : lastUserInput;
								const display = truncated.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
								const parts = [theme.fg("accent", "▸"), theme.fg("dim", display)];
								if (isEnabled("historyHint") && inputHistory.length > 1) {
									parts.push(theme.fg("dim", `Ctrl+H:${inputHistory.length}`));
								}
								return parts.join(" ");
							},
						});
					}

					// --- Plugin items ---
					const pluginItems: CellItem[] = plugins
						.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
						.map((p) => ({
							key: `plugin:${p.name}`,
							defaultLine: targetToLine(p.target),
							order: p.order ?? 100,
							fixedCol: p.col ?? config.placement?.[`plugin:${p.name}`]?.col,
							render: () => p.render(hudCtx, hudTheme, width),
						}));

					// All items sorted
					const allItems = [...line1Items, ...line2Items, ...line3Items, ...pluginItems];

					// ================================================================
					// Layout mode branch
					// ================================================================
					const layout = config.layout;

					if (layout && layout.length > 0) {
						// === Grid layout mode ===
						return renderGrid(layout, allItems, width, sep);
					}

					// === Classic single-column mode (default, unchanged) ===

					// Line 1
					const l1Content = line1Items[0]?.render();
					const pluginLine1 = pluginItems
						.filter((p) => p.defaultLine === 0)
						.sort((a, b) => a.order - b.order)
						.map((p) => p.render())
						.filter((s): s is string => s != null);
					let line1 = l1Content || "";
					if (pluginLine1.length > 0) line1 += " " + pluginLine1.join(" ");
					line1 = truncateToWidth(line1, width);

					// Line 2
					const l2Parts = line2Items
						.sort((a, b) => a.order - b.order)
						.map((item) => item.render())
						.filter((s): s is string => s != null);
					const pluginLine2 = pluginItems
						.filter((p) => p.defaultLine === 1)
						.sort((a, b) => a.order - b.order)
						.map((p) => p.render())
						.filter((s): s is string => s != null);
					l2Parts.push(...pluginLine2);
					const line2 = truncateToWidth(
						l2Parts.join(theme.fg("dim", " · ")),
						width,
						theme.fg("dim", "..."),
					);

					// Line 3
					let line3 = "";
					if (lastUserInput && isEnabled("lastInput")) {
						const inputParts = line3Items
							.sort((a, b) => a.order - b.order)
							.map((item) => item.render())
							.filter((s): s is string => s != null);
						const pluginLine3 = pluginItems
							.filter((p) => p.defaultLine === 2)
							.sort((a, b) => a.order - b.order)
							.map((p) => p.render())
							.filter((s): s is string => s != null);
						inputParts.push(...pluginLine3);
						if (inputParts.length > 0) {
							line3 = truncateToWidth(
								inputParts.join(" "),
								width,
								theme.fg("dim", "..."),
							);
						}
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
