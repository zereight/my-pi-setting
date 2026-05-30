import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createCursorWorkerTool } from "../src/cursor-worker-tool.js";

export default function extension(pi: ExtensionAPI) {
	const cursorWorkerTool = createCursorWorkerTool();
	pi.registerTool(cursorWorkerTool);

	pi.on("session_start", () => {
		const active = pi.getActiveTools();
		if (!active.includes(cursorWorkerTool.name)) {
			pi.setActiveTools([...active, cursorWorkerTool.name]);
		}
	});
}
