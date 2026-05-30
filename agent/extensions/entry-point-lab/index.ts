/**
 * Entry-point lab — Pi extension learning track
 *
 * Step 4: default export factory (ExtensionAPI)
 * Step 5: registerCommand → slash command in TUI
 * Step 6: pi.on event hooks (see EVENTS.md)
 *
 * Auto-discovery: ~/.pi/agent/extensions/entry-point-lab/index.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function entryPointLab(pi: ExtensionAPI) {
	pi.on("session_start", async (event, ctx) => {
		if (event.reason === "startup" || event.reason === "reload") {
			ctx.ui.setStatus("entry-point-lab", "hooks active");
		}
	});

	pi.registerCommand("entry-point-lab:hello", {
		description: "Greet from the entry-point-lab extension (step 5)",
		handler: async (args, ctx) => {
			const name = args?.trim() || "Pi learner";
			ctx.ui.notify(`Hello, ${name}!`, "info");
		},
	});
}
