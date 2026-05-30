import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function createCursorWorkerTool(): ToolDefinition {
	return defineTool({
		name: "cursor_worker",
		label: "Cursor Worker",
		description: "Run a sub-task via Cursor SDK (stub — returns ok until wired in later steps)",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			return {
				content: [{ type: "text", text: "ok" }],
				details: { stub: true },
			};
		},
	});
}
