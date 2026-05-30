/**
 * recent-skills — MRU `/skill:name` chips above the Pi TUI editor.
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

const CUSTOM_TYPE = "recent-skills";
const MAX_RECENT = 5;
const SKILL_INVOKE_RE = /^\/skill:([^\s]+)/;
const SKILL_BLOCK_RE = /^<skill name="([^"]+)"/;

let recentNames: string[] = [];

function parseSkillName(text: string): string | null {
	const trimmed = text.trim();
	const slash = trimmed.match(SKILL_INVOKE_RE);
	if (slash) return slash[1];
	const block = trimmed.match(SKILL_BLOCK_RE);
	if (block) return block[1];
	return null;
}

function loadRecentFromSession(ctx: ExtensionContext): string[] {
	const entries = ctx.sessionManager.getEntries();
	const entry = entries
		.filter((e) => e.type === "custom" && e.customType === CUSTOM_TYPE)
		.pop() as { data?: { names?: string[] } } | undefined;
	const names = entry?.data?.names;
	return Array.isArray(names) ? names.slice(0, MAX_RECENT) : [];
}

function persistRecent(pi: ExtensionAPI): void {
	pi.appendEntry(CUSTOM_TYPE, { names: recentNames });
}

function pushRecent(pi: ExtensionAPI, name: string): void {
	recentNames = [name, ...recentNames.filter((n) => n !== name)].slice(0, MAX_RECENT);
	persistRecent(pi);
}

function stripAnsi(text: string): string {
	return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function visibleLength(text: string): number {
	return stripAnsi(text).length;
}

function formatChip(index: number, name: string, theme: Theme): string {
	const label = name.length > 18 ? `${name.slice(0, 16)}…` : name;
	return theme.fg("text", `[${index}] ${label}`);
}

function formatBar(names: string[], theme: Theme, width: number): string {
	const prefix = theme.fg("muted", "skills ");
	const hint = theme.fg("dim", "  Alt+1-5");
	const sep = theme.fg("dim", " | ");
	const chips = names.map((name, i) => formatChip(i + 1, name, theme));

	const maxBody = Math.max(8, width - visibleLength(prefix) - visibleLength(hint));
	const visible: string[] = [];
	for (const chip of chips) {
		const next = visible.length === 0 ? chip : `${visible.join(sep)}${sep}${chip}`;
		if (visible.length > 0 && visibleLength(next) > maxBody) break;
		visible.push(chip);
	}

	let body = visible.join(sep);
	const omitted = chips.length - visible.length;
	if (omitted > 0) {
		body = body.length > 0 ? `${body}${theme.fg("dim", ` +${omitted}`)}` : theme.fg("dim", `+${omitted}`);
	}

	let line = prefix + body;
	if (visibleLength(line + hint) > width && visibleLength(body) > maxBody) {
		const plain = stripAnsi(body);
		body = plain.slice(0, Math.max(0, maxBody - 1)) + "…";
		line = prefix + theme.fg("text", body);
	}

	return line + hint;
}

function refreshWidget(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	if (recentNames.length === 0) {
		ctx.ui.setWidget(CUSTOM_TYPE, undefined);
		return;
	}
	ctx.ui.setWidget(CUSTOM_TYPE, (_tui, theme) => ({
		render(width: number): string[] {
			return [formatBar(recentNames, theme, width)];
		},
		invalidate() {},
	}));
}

function prefillSkill(ctx: ExtensionContext, index: number): void {
	const name = recentNames[index];
	if (!name) return;
	ctx.ui.setEditorText(`/skill:${name} `);
}

export default function recentSkillsExtension(pi: ExtensionAPI): void {
	for (let slot = 1; slot <= MAX_RECENT; slot++) {
		const index = slot - 1;
		pi.registerShortcut(Key.alt(String(slot)), {
			description: `Prefill recent skill #${slot}`,
			handler: (ctx) => prefillSkill(ctx, index),
		});
	}

	pi.registerCommand("recent-skills", {
		description: "Pick a recent skill to prefill in the editor",
		handler: async (_args, ctx) => {
			if (recentNames.length === 0) {
				ctx.ui.notify("No recent skills yet. Run /skill:name first.", "info");
				return;
			}
			const choice = await ctx.ui.select("Recent skill:", recentNames);
			if (!choice) return;
			prefillSkill(ctx, recentNames.indexOf(choice));
		},
	});

	pi.registerCommand("recent-skills:clear", {
		description: "Clear the recent-skills list",
		handler: (_args, ctx) => {
			recentNames = [];
			persistRecent(pi);
			refreshWidget(ctx);
			ctx.ui.notify("Recent skills cleared", "info");
		},
	});

	pi.on("session_start", (_event, ctx) => {
		recentNames = loadRecentFromSession(ctx);
		refreshWidget(ctx);
	});

	pi.on("before_agent_start", (event, ctx) => {
		const name = parseSkillName(event.prompt);
		if (!name) return;
		pushRecent(pi, name);
		refreshWidget(ctx);
	});
}
