/**
 * Reference workflow for manual E2E (phase 2b).
 * Use with cursor_workflow once that tool is registered (step 27+).
 *
 * Globals (planned): cursor_worker, phase, log, args, cwd
 */
export const meta = {
	name: "e2e_two_phase",
	description: "Manual E2E: research then synthesize via two cursor_worker calls",
	phases: [{ title: "Research" }, { title: "Synthesize" }],
};

phase("Research");
const inventory = await cursor_worker(
	"List file names under pi-cursor-worker/src (basenames only). Reply as plain text.",
	{ label: "src inventory" },
);
if (inventory == null) {
	return { ok: false, verdict: "research_failed" };
}

phase("Synthesize");
const countLine = await cursor_worker(
	`Previous listing:\n${inventory}\n\nReply with only the count of .ts files as one integer.`,
	{ label: "ts count" },
);
if (countLine == null) {
	return { ok: false, verdict: "synthesize_failed", inventory };
}

return {
	ok: true,
	verdict: "pass",
	inventory,
	tsFileCount: countLine,
};
