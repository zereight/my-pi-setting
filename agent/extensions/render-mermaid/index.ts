/**
 * render_mermaid — Mermaid source → PNG/SVG for Pi TUI inline preview (like render_chart).
 * Requires `mmdc` on PATH (@mermaid-js/mermaid-cli).
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Container, Image, Text, getCapabilities } from "@earendil-works/pi-tui";

const execFileAsync = promisify(execFile);

type OutputFormat = "png" | "svg";

interface MermaidConfig {
	saveToDisk: boolean;
	format: OutputFormat;
	theme: string;
	background: string;
	width: number;
	maxWidthCells: number;
}

const DEFAULT_CONFIG: MermaidConfig = {
	saveToDisk: true,
	format: "png",
	theme: "neutral",
	background: "transparent",
	width: 1200,
	maxWidthCells: 90,
};

function ensureMermaidDir(cwd: string): void {
	const dir = join(cwd, ".mermaid");
	if (existsSync(dir)) return;
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "settings.json"),
		JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
	);
}

function loadConfig(cwd: string): MermaidConfig {
	const configPath = join(cwd, ".mermaid", "settings.json");
	if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
	try {
		const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<MermaidConfig>;
		return {
			saveToDisk: raw.saveToDisk ?? DEFAULT_CONFIG.saveToDisk,
			format: raw.format === "svg" ? "svg" : "png",
			theme: raw.theme ?? DEFAULT_CONFIG.theme,
			background: raw.background ?? DEFAULT_CONFIG.background,
			width: raw.width ?? DEFAULT_CONFIG.width,
			maxWidthCells: raw.maxWidthCells ?? DEFAULT_CONFIG.maxWidthCells,
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

function getOutputDir(cwd: string): string {
	const dir = join(cwd, ".mermaid", "output");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return dir;
}

function safeFilename(name: string): string {
	const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
	return cleaned.length > 0 ? cleaned.slice(0, 64) : "diagram";
}

async function assertMmdcAvailableAsync(): Promise<void> {
	try {
		await execFileAsync("mmdc", ["--version"], { timeout: 10_000 });
	} catch {
		throw new Error(
			"mmdc not found. Install: npm install -g @mermaid-js/mermaid-cli (or brew install mermaid-cli)",
		);
	}
}

async function renderMermaidAsync(
	source: string,
	outPath: string,
	config: MermaidConfig,
	themeOverride?: string,
): Promise<void> {
	const inputPath = join(tmpdir(), `pi-mermaid-${Date.now()}.mmd`);
	writeFileSync(inputPath, source, "utf-8");
	const theme = themeOverride ?? config.theme;
	const args = [
		"-i",
		inputPath,
		"-o",
		outPath,
		"-t",
		theme,
		"-b",
		config.background,
		"-w",
		String(config.width),
	];
	try {
		await execFileAsync("mmdc", args, { timeout: 120_000 });
	} finally {
		try {
			unlinkSync(inputPath);
		} catch {
			/* ignore */
		}
	}
	if (!existsSync(outPath)) {
		throw new Error("mmdc finished but output file was not created");
	}
}

export default function renderMermaidExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "render_mermaid",
		label: "Render Mermaid",
		description: "Render Mermaid diagram source to PNG or SVG for inline terminal preview.",
		promptSnippet:
			"Render Mermaid diagram source to an image. Prefer this over raw ```mermaid``` blocks when the user wants a visible diagram.",
		promptGuidelines: [
			"Pass valid Mermaid syntax only (no markdown fences) in the `source` parameter.",
			"Use flowchart, sequenceDiagram, classDiagram, etc. as appropriate.",
			"Call render_mermaid when the user asks to draw, diagram, or visualize architecture — do not rely on chat markdown preview.",
			"Default output is PNG inline in Pi TUI (like render_chart).",
		],
		parameters: Type.Object({
			source: Type.String({ description: "Mermaid diagram source (no ``` fences)" }),
			filename: Type.Optional(
				Type.String({ description: "Output base name without extension (default: diagram)" }),
			),
			format: Type.Optional(
				StringEnum(["png", "svg"] as const, {
					description: "Output format (default from .mermaid/settings.json)",
				}),
			),
			theme: Type.Optional(
				Type.String({
					description: "Mermaid theme: default, forest, dark, neutral, null",
				}),
			),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			await assertMmdcAvailableAsync();

			const trimmed = params.source.trim();
			if (!trimmed) {
				throw new Error("source must not be empty");
			}

			ensureMermaidDir(ctx.cwd);
			const config = loadConfig(ctx.cwd);
			const format: OutputFormat = params.format ?? config.format;
			const ext = format === "svg" ? "svg" : "png";
			const mime = format === "svg" ? "image/svg+xml" : "image/png";

			const dir = getOutputDir(ctx.cwd);
			const base = safeFilename(params.filename ?? "diagram");
			const outPath = join(dir, `${base}-${Date.now()}.${ext}`);

			await renderMermaidAsync(trimmed, outPath, config, params.theme);

			const bytes = readFileSync(outPath);
			const base64 = bytes.toString("base64");

			let savedPath: string | undefined;
			if (config.saveToDisk) {
				savedPath = outPath;
			} else {
				unlinkSync(outPath);
			}

			const label = savedPath
				? `Rendered mermaid (${format}) → ${savedPath}`
				: `Rendered mermaid (${format})`;

			return {
				content: [{ type: "text", text: label }],
				details: {
					format,
					path: savedPath,
					base64,
					maxWidthCells: config.maxWidthCells,
					mime,
				},
			};
		},

		renderResult(result, _options, theme) {
			const { details } = result;
			const caps = getCapabilities();
			const container = new Container("vertical", 0);

			const label = details?.path
				? `${details.format} → ${details.path}`
				: String(details?.format ?? "mermaid");
			container.addChild(new Text(theme.fg("muted", label), 0, 0));

			if (caps.images && details?.base64 && details.mime) {
				container.addChild(
					new Image(
						details.base64,
						details.mime,
						{},
						{ maxWidthCells: details.maxWidthCells ?? 90 },
					),
				);
			}

			return container;
		},
	});
}
