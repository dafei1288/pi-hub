/**
 * Pi HUD Extension — claude-hud inspired status bar
 *
 * Line 1: [model] project git:(main* ↑2)    [████████░░] 39%    ⏱ 21m
 * Line 2: AGENTS.md · skills x5 · ext x2 · $0.042 · ✓ Grep x10 | ✓ Bash x3
 * Line 3: ▸ how to build a REST API with authentication?
 *
 * Ctrl+H: Open session input history overlay
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { Component, TUI } from "@mariozechner/pi-tui";
import { getKeybindings } from "@mariozechner/pi-tui";

// ---- Helpers ----

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

function ctxColor(theme: any, pct: number, text: string): string {
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

/** Extract plain text from user message content */
function extractUserText(content: string | unknown[]): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((c: any) => c.type === "text")
			.map((c: any) => c.text)
			.join(" ");
	}
	return "";
}

/** Pad a string with spaces to reach a target visual width (CJK-aware) */
function padToWidth(text: string, targetWidth: number): string {
	const vw = visibleWidth(text);
	const gap = targetWidth - vw;
	return gap > 0 ? text + " ".repeat(gap) : text;
}

// ---- History Overlay Component ----

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

		// Footer: ├─ ↑↓ scroll · Enter select · Esc close ─┘
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

// ---- Tracked state ----

interface RunningTool {
	name: string;
	startTime: number;
}

export default function (pi: ExtensionAPI) {
	let sessionStart = Date.now();
	let cachedCwd = "";
	let cachedContextFiles: string[] = [];

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

	function refreshContextFiles(cwd: string) {
		if (cwd !== cachedCwd) {
			cachedCwd = cwd;
			cachedContextFiles = detectContextFiles(cwd);
		}
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

			// Reverse: most recent first
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
						offsetY: -3, // above the 3-line HUD
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

					// ================================================================
					// Line 1: [model] project git:(main* ↑2)    [████░░░] 39%    ⏱ 21m
					// ================================================================

					// Thinking level badge
					let thinkingBadge = "";
					if (model?.reasoning && thinking !== "off") {
						thinkingBadge = theme.fg("dim", ` · ${thinking}`);
					}

					const modelTag = theme.fg("accent", `[${modelId}]`);
					const projectStr = theme.fg("text", projectName);
					const gitStr = branch ? ` ${theme.fg("dim", `git:(${branch})`)}` : "";
					const line1Left = `${modelTag} ${projectStr}${gitStr}${thinkingBadge}`;

					// Progress bar
					const line1Right = theme.fg("dim", `⏱ ${elapsed}`);
					const left1W = visibleWidth(line1Left);
					const right1W = visibleWidth(line1Right);
					const barAvail = width - left1W - right1W - 6;

					let ctxBar: string;
					if (barAvail > 20 && ctxPercent != null) {
						const barW = Math.min(barAvail - 6, 20);
						ctxBar = ctxColor(theme, ctxPercent, `${progressBar(ctxPercent, barW)} ${Math.round(ctxPercent)}%`);
					} else if (ctxPercent != null) {
						ctxBar = ctxColor(theme, ctxPercent, `${Math.round(ctxPercent)}%`);
					} else {
						ctxBar = theme.fg("dim", "?%");
					}

					const centerW = visibleWidth(ctxBar);
					const gap = width - left1W - centerW - right1W;
					let line1: string;
					if (gap >= 2) {
						const lp = Math.floor(gap / 2);
						const rp = gap - lp;
						line1 = line1Left + " ".repeat(lp) + ctxBar + " ".repeat(rp) + line1Right;
					} else {
						line1 = truncateToWidth(line1Left + "  " + ctxBar + "  " + line1Right, width);
					}

					// ================================================================
					// Line 2: AGENTS.md · skills x5 · ✓ Grep x10 | ◐ Edit: auth.ts
					// ================================================================
					const parts: string[] = [];

					// Context files
					for (const f of cachedContextFiles) {
						parts.push(theme.fg("success", f));
					}

					// Resource counts
					if (skillCmds.length > 0) parts.push(theme.fg("dim", `skills x${skillCmds.length}`));
					if (extTools.length > 0) parts.push(theme.fg("dim", `ext.tools x${extTools.length}`));
					if (extCmds.length > 0) parts.push(theme.fg("dim", `cmds x${extCmds.length}`));

					// Token breakdown at high context (85%+)
					if (ctxPercent >= 85 && totalInput > 0) {
						parts.push(theme.fg("dim", `↑${formatTokens(totalInput)} ↓${formatTokens(totalOutput)}`));
					}

					if (totalCost > 0) parts.push(theme.fg("dim", `$${totalCost.toFixed(3)}`));

					// Completed tool stats
					const sortedTools = Array.from(toolCounts.entries()).sort(([, a], [, b]) => b - a);
					for (const [name, count] of sortedTools) {
						parts.push(`${theme.fg("success", "✓")} ${theme.fg("dim", `${name} ×${count}`)}`);
					}

					// Running tool indicator(s)
					for (const tool of Array.from(runningTools.values())) {
						const dur = formatDuration(Date.now() - tool.startTime);
						parts.push(`${theme.fg("warning", "◐")} ${theme.fg("text", `${tool.name} (${dur})`)}`);
					}

					// Running agents
					const runningAgents = agentEntries.filter((a) => a.status === "running");
					for (const agent of runningAgents.slice(-2)) {
						const dur = formatDuration(Date.now() - agent.startTime);
						parts.push(`${theme.fg("warning", "◐")} ${theme.fg("accent", `agent (${dur})`)}`);
					}

					const line2 = truncateToWidth(
						parts.join(theme.fg("dim", " · ")),
						width,
						theme.fg("dim", "..."),
					);

					// ================================================================
					// Line 3: Last user input + history hint
					// ================================================================
					let line3 = "";
					if (lastUserInput) {
						const truncated = lastUserInput.length > 200 ? lastUserInput.slice(0, 197) + "..." : lastUserInput;
						const inputDisplay = truncated.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
						const hint = inputHistory.length > 1
							? theme.fg("dim", `  Ctrl+H:${inputHistory.length}`)
							: "";
						line3 = truncateToWidth(
							`${theme.fg("accent", "▸")} ${theme.fg("dim", inputDisplay)}${hint}`,
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
