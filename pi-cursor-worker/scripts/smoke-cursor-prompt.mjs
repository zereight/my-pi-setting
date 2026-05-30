#!/usr/bin/env node
/**
 * Smoke: require a Cursor API key, then Agent.prompt once.
 * Steps 8–10: missing-key guard, SDK call, success output.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROMPT = process.env.SMOKE_PROMPT ?? "Say ok only";
const MODEL_ID = process.env.SMOKE_MODEL ?? "composer-2.5";

function missingApiKeyMessage() {
	return [
		"smoke-cursor-prompt: CURSOR_API_KEY is not set.",
		"",
		"Set your Cursor SDK API key, then re-run:",
		"  export CURSOR_API_KEY=\"<your-key>\"",
		"  npm run smoke:cursor",
		"",
		"Or one-shot:",
		"  CURSOR_API_KEY=\"<your-key>\" npm run smoke:cursor",
		"",
		"If you saved a key via `pi /login` (Cursor):",
		"  SMOKE_USE_PI_AUTH=1 npm run smoke:cursor",
	].join("\n");
}

function readPiAuthCursorKey() {
	const authPath = path.join(os.homedir(), ".pi/agent/auth.json");
	if (!fs.existsSync(authPath)) return undefined;
	try {
		const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
		const key = auth?.cursor?.key?.trim() ?? auth?.cursor?.apiKey?.trim();
		return key && key.length > 0 ? key : undefined;
	} catch {
		return undefined;
	}
}

function resolveApiKey() {
	const fromEnv = process.env.CURSOR_API_KEY?.trim();
	if (fromEnv) return fromEnv;
	if (process.env.SMOKE_USE_PI_AUTH === "1") {
		return readPiAuthCursorKey();
	}
	return undefined;
}

function previewText(text, maxLen = 240) {
	if (text.length <= maxLen) return text;
	return `${text.slice(0, maxLen)}…`;
}

async function main() {
	const apiKey = resolveApiKey();
	if (!apiKey) {
		console.error(missingApiKeyMessage());
		process.exit(1);
	}

	const { Agent } = await import("@cursor/sdk");

	console.log(`smoke-cursor-prompt: Agent.prompt (model=${MODEL_ID}) …`);
	const result = await Agent.prompt(PROMPT, {
		apiKey,
		model: { id: MODEL_ID },
	});

	console.log("smoke-cursor-prompt: status:", result.status);
	if (result.durationMs != null) {
		console.log("smoke-cursor-prompt: durationMs:", result.durationMs);
	}
	if (result.result) {
		console.log("smoke-cursor-prompt: result:", previewText(result.result));
	}

	if (result.status !== "finished") {
		console.error(
			"smoke-cursor-prompt: FAIL — expected status finished, got",
			result.status,
		);
		process.exit(1);
	}

	console.log("smoke-cursor-prompt: PASS");
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error("smoke-cursor-prompt: FAIL —", message);
	process.exit(1);
});
