/**
 * Local-only: append Mermaid ASCII under assistant messages (Cursor SDK bridge + optional TUI).
 *
 * pi-mermaid's custom MessageRenderer only works in Pi TUI — Cursor agent chat shows
 * the extra custom message (with %% mermaid-hash) but not ASCII. This extension
 * inlines ASCII into the assistant text on message_end.
 *
 * Tip: remove "npm:pi-mermaid" from settings packages to avoid a duplicate mermaid block.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { join } from "node:path";

const MERMAID_BLOCK_RE = /```mermaid\s*([\s\S]*?)```/gi;
const MERMAID_HASH_RE = /^\s*%%\s*mermaid-hash:/i;
const APPENDIX_MARKER = "### Mermaid (ASCII)";
const MAX_BLOCKS = 5;
const BEAUTIFUL_MERMAID_URL = pathToFileURL(
	join(homedir(), ".pi/agent/npm/node_modules/beautiful-mermaid/dist/index.js"),
).href;

type RenderMermaidAscii = (
	source: string,
	options?: { paddingX?: number; boxBorderPadding?: number; colorMode?: string },
) => string;

let renderMermaidAsciiPromise: Promise<RenderMermaidAscii> | null = null;

function inlineEnabled(): boolean {
	const v = process.env.PI_MERMAID_INLINE;
	if (v === "0" || v === "false") return false;
	return true;
}

function isCursorSdk(ctx: ExtensionContext): boolean {
	const model = ctx.model;
	if (!model) return false;
	if (model.provider === "cursor") return true;
	if (model.api === "cursor-sdk") return true;
	return false;
}

/** Pi TUI + pi-mermaid package: avoid duplicating ASCII in the same turn. */
function shouldSkipForPiTuiRenderer(ctx: ExtensionContext): boolean {
	if (!ctx.hasUI) return false;
	if (!process.stdin.isTTY) return false;
	if (isCursorSdk(ctx)) return false;
	return process.env.PI_MERMAID_INLINE_TUI !== "1";
}

async function loadRenderMermaidAscii(): Promise<RenderMermaidAscii> {
	if (!renderMermaidAsciiPromise) {
		renderMermaidAsciiPromise = import(BEAUTIFUL_MERMAID_URL).then((mod) => {
			const fn = mod.renderMermaidAscii;
			if (typeof fn !== "function") {
				throw new Error("beautiful-mermaid: renderMermaidAscii not found");
			}
			return fn as RenderMermaidAscii;
		});
	}
	return renderMermaidAsciiPromise;
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part: { type?: string; text?: string }) =>
			part?.type === "text" && part.text ? part.text : "",
		)
		.filter(Boolean)
		.join("\n");
}

function stripMermaidMetaLines(block: string): string {
	return block
		.split(/\r?\n/)
		.filter((line) => !MERMAID_HASH_RE.test(line))
		.join("\n")
		.trim();
}

function extractMermaidBlocks(text: string): string[] {
	const blocks: string[] = [];
	MERMAID_BLOCK_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = MERMAID_BLOCK_RE.exec(text)) !== null) {
		const code = stripMermaidMetaLines(match[1] ?? "");
		if (code) blocks.push(code);
		if (blocks.length >= MAX_BLOCKS) break;
	}
	return blocks;
}

function getDiagramType(block: string): string | null {
	for (const line of block.split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith("%%")) continue;
		const token = t.split(/\s+/)[0]?.toLowerCase() ?? "";
		if (token) return token;
	}
	return null;
}

const SUPPORTED = new Set([
	"flowchart",
	"graph",
	"sequencediagram",
	"sequence",
	"statediagram-v2",
	"statediagram",
	"state",
	"classdiagram",
	"class",
	"erdiagram",
	"er",
]);

async function renderBlockAscii(block: string): Promise<string | null> {
	const type = getDiagramType(block);
	if (!type || !SUPPORTED.has(type)) return null;
	try {
		const render = await loadRenderMermaidAscii();
		return render(block, { paddingX: 3, boxBorderPadding: 1, colorMode: "none" }).trim();
	} catch {
		return null;
	}
}

async function buildAppendix(blocks: string[]): Promise<string> {
	const parts: string[] = [];
	for (let i = 0; i < blocks.length; i++) {
		const ascii = await renderBlockAscii(blocks[i]!);
		if (!ascii) continue;
		const label = blocks.length > 1 ? ` (block ${i + 1})` : "";
		parts.push(`${APPENDIX_MARKER}${label}\n\n\`\`\`text\n${ascii}\n\`\`\``);
	}
	if (parts.length === 0) return "";
	return `\n\n${parts.join("\n\n")}`;
}

function appendToContent(content: unknown, appendix: string): unknown {
	if (typeof content === "string") return content + appendix;
	if (!Array.isArray(content)) return content;
	const copy = [...content];
	for (let i = copy.length - 1; i >= 0; i--) {
		const part = copy[i] as { type?: string; text?: string };
		if (part?.type === "text" && typeof part.text === "string") {
			copy[i] = { ...part, text: part.text + appendix };
			return copy;
		}
	}
	return content;
}

export default function (pi: ExtensionAPI) {
	pi.on("message_end", async (event, ctx) => {
		if (!inlineEnabled()) return;
		if (shouldSkipForPiTuiRenderer(ctx)) return;
		if (event.message.role !== "assistant") return;

		const text = extractText(event.message.content);
		if (!text.includes("```mermaid")) return;
		if (text.includes(APPENDIX_MARKER)) return;

		const blocks = extractMermaidBlocks(text);
		if (blocks.length === 0) return;

		const appendix = await buildAppendix(blocks);
		if (!appendix.trim()) return;

		return {
			message: {
				...event.message,
				content: appendToContent(event.message.content, appendix),
			},
		};
	});
}
