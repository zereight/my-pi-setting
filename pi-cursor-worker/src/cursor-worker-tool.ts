import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { formatCursorPromptError } from "./cursor-prompt-errors.js";
import { runCursorPromptAsync } from "./cursor-prompt.js";

const CursorWorkerParams = Type.Object({
	prompt: Type.String({
		description: "Task for the Cursor SDK local agent (sub-task prompt)",
	}),
	model: Type.Optional(
		Type.String({
			description: "Cursor model id (default: composer-2.5)",
		}),
	),
	cwd: Type.Optional(
		Type.String({
			description: "Working directory for the Cursor local agent",
		}),
	),
});

export function createCursorWorkerTool(): ToolDefinition {
	return defineTool({
		name: "cursor_worker",
		label: "Cursor Worker",
		description:
			"Run a sub-task via Cursor SDK (Agent.prompt). Pi orchestrates; this tool executes one Cursor local-agent run.",
		parameters: CursorWorkerParams,

		async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
			onUpdate?.({
				content: [{ type: "text", text: "Cursor worker: starting…" }],
				details: { phase: "starting" },
			});

			try {
				const result = await runCursorPromptAsync(params.prompt, {
					modelId: params.model,
					cwd: params.cwd,
				});

				const text = result.result?.trim() ?? "";

				onUpdate?.({
					content: [{ type: "text", text: text || "(empty result)" }],
					details: {
						phase: "finished",
						runId: result.id,
						durationMs: result.durationMs,
					},
				});

				return {
					content: [{ type: "text", text: text || "(empty result)" }],
					details: {
						runId: result.id,
						status: result.status,
						durationMs: result.durationMs,
						model: result.model,
					},
				};
			} catch (error) {
				const message = formatCursorPromptError(error);
				return {
					content: [{ type: "text", text: message }],
					details: { error: true },
				};
			}
		},
	});
}
