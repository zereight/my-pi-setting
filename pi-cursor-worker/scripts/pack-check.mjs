#!/usr/bin/env node
/**
 * Step 35: npm pack pre-publish check — tarball must ship Pi extension + dist, not node_modules.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_PREFIXES = [
	"package/package.json",
	"package/extensions/cursor-worker.ts",
	"package/src/cursor-worker-tool.ts",
	"package/dist/index.js",
	"package/dist/cursor-worker-tool.js",
	"package/dist/cursor-prompt.js",
	"package/dist/cursor-prompt-errors.js",
	"package/README.md",
];

const FORBIDDEN_SUBSTRINGS = ["/node_modules/", "package-lock.json"];

function fail(message) {
	console.error(`pack-check: FAIL — ${message}`);
	process.exit(1);
}

function listTarball(tgzPath) {
	const listing = execSync(`tar -tzf "${tgzPath}"`, { encoding: "utf8" });
	return listing.split("\n").filter((line) => line.length > 0);
}

function main() {
	const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
	if (!pkg.pi?.extensions?.length) {
		fail("package.json missing pi.extensions");
	}

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-cursor-worker-pack-"));
	let tgzPath;
	try {
		const packed = execSync(`npm pack --pack-destination "${tmpDir}"`, {
			cwd: packageRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		const tgzName = packed.split("\n").pop()?.trim();
		if (!tgzName?.endsWith(".tgz")) {
			fail(`unexpected npm pack output: ${packed}`);
		}
		tgzPath = path.join(tmpDir, tgzName);
		if (!fs.existsSync(tgzPath)) {
			fail(`tarball not found: ${tgzPath}`);
		}

		const entries = listTarball(tgzPath);
		const entrySet = new Set(entries);

		for (const required of REQUIRED_PREFIXES) {
			if (!entrySet.has(required)) {
				fail(`tarball missing ${required}`);
			}
		}

		for (const entry of entries) {
			for (const forbidden of FORBIDDEN_SUBSTRINGS) {
				if (entry.includes(forbidden)) {
					fail(`tarball must not include ${forbidden} (found ${entry})`);
				}
			}
		}

		const bytes = fs.statSync(tgzPath).size;
		console.log(`pack-check: tarball ok (${entries.length} paths, ${bytes} bytes)`);
		console.log("pack-check: PASS");
		if (pkg.private === true) {
			console.log(
				'pack-check: note — package is private; remove "private" before npm publish',
			);
		}
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

main();
