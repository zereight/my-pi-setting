#!/usr/bin/env node
/**
 * Step 7 check: local package is on disk, pi manifest resolves, stub tool returns ok.
 * Full TUI check: pi list, then in Pi run /reload and confirm cursor_worker is available.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const settingsPath = path.join(process.env.HOME ?? "", ".pi/agent/settings.json");

function fail(message) {
	console.error(`verify-install: FAIL — ${message}`);
	process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const extensionPaths = pkg.pi?.extensions ?? [];
if (extensionPaths.length === 0) {
	fail("package.json has no pi.extensions");
}

for (const rel of extensionPaths) {
	const abs = path.resolve(packageRoot, rel);
	if (!fs.existsSync(abs)) {
		fail(`missing extension file: ${abs}`);
	}
	console.log(`verify-install: extension ok — ${rel}`);
}

if (!fs.existsSync(path.join(packageRoot, "dist/cursor-worker-tool.js"))) {
	fail("run npm run build first (dist/cursor-worker-tool.js missing)");
}

const { createCursorWorkerTool } = await import(
	`file://${path.join(packageRoot, "dist/cursor-worker-tool.js")}`
);
const tool = createCursorWorkerTool();
if (tool.name !== "cursor_worker") {
	fail(`unexpected tool name: ${tool.name}`);
}
const props = tool.parameters?.properties;
if (!props?.prompt) {
	fail("cursor_worker schema missing required prompt");
}
console.log(`verify-install: tool ok — ${tool.name} (prompt schema present)`);

if (fs.existsSync(settingsPath)) {
	const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
	const packages = settings.packages ?? [];
	const linked = packages.some((entry) => {
		const resolved = path.resolve(path.dirname(settingsPath), entry);
		return resolved === packageRoot;
	});
	if (!linked) {
		fail(
			`not in ~/.pi/agent/settings.json packages — run: pi install ${packageRoot}`,
		);
	}
	console.log("verify-install: settings.json packages entry ok");
} else {
	console.warn("verify-install: warn — ~/.pi/agent/settings.json not found");
}

console.log("verify-install: PASS (run /reload in Pi TUI to load the extension)");
