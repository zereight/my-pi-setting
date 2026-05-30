import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function readPiAuthCursorKey(): string | undefined {
	const authPath = path.join(os.homedir(), ".pi/agent/auth.json");
	if (!fs.existsSync(authPath)) {
		return undefined;
	}
	try {
		const auth = JSON.parse(fs.readFileSync(authPath, "utf8")) as {
			cursor?: { key?: string; apiKey?: string };
		};
		const key = auth.cursor?.key?.trim() ?? auth.cursor?.apiKey?.trim();
		return key && key.length > 0 ? key : undefined;
	} catch {
		return undefined;
	}
}

/** Resolve Cursor SDK API key: explicit → CURSOR_API_KEY → pi /login cursor key. */
export function resolveCursorApiKey(explicit?: string): string | undefined {
	const trimmed = explicit?.trim();
	if (trimmed) {
		return trimmed;
	}
	const fromEnv = process.env.CURSOR_API_KEY?.trim();
	if (fromEnv) {
		return fromEnv;
	}
	return readPiAuthCursorKey();
}
