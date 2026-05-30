import { Agent } from "@cursor/sdk";
import type { AgentOptions, RunResult } from "@cursor/sdk";
import { resolveCursorApiKey } from "./cursor-api-key.js";
import {
	assertCursorRunFinished,
	formatCursorPromptError,
	MISSING_CURSOR_API_KEY_MESSAGE,
} from "./cursor-prompt-errors.js";

const DEFAULT_MODEL_ID = "composer-2.5";

export interface RunCursorPromptOptions {
	/** Cursor SDK API key; falls back to `CURSOR_API_KEY` env when omitted. */
	apiKey?: string;
	/** Cursor model id (e.g. `composer-2.5`). */
	modelId?: string;
	/** Local agent working directory (passed to `AgentOptions.local.cwd`). */
	cwd?: string | string[];
}

function buildAgentOptions(options: RunCursorPromptOptions, apiKey: string): AgentOptions {
	const agentOptions: AgentOptions = {
		apiKey,
		model: { id: options.modelId ?? DEFAULT_MODEL_ID },
	};
	if (options.cwd !== undefined) {
		agentOptions.local = { cwd: options.cwd };
	}
	return agentOptions;
}

/**
 * Run one Cursor local-agent prompt (create → prompt → close via `Agent.prompt`).
 */
export async function runCursorPromptAsync(
	prompt: string,
	options: RunCursorPromptOptions = {},
): Promise<RunResult> {
	const apiKey = resolveCursorApiKey(options.apiKey);
	if (!apiKey) {
		throw new Error(MISSING_CURSOR_API_KEY_MESSAGE);
	}

	try {
		const result = await Agent.prompt(prompt, buildAgentOptions(options, apiKey));
		assertCursorRunFinished(result);
		return result;
	} catch (error) {
		if (error instanceof Error && error.message === MISSING_CURSOR_API_KEY_MESSAGE) {
			throw error;
		}
		throw new Error(formatCursorPromptError(error));
	}
}
