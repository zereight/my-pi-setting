/** Package entry — built to dist/ for library imports from the extension (later steps). */
export const PACKAGE_NAME = "pi-cursor-worker";

export { createCursorWorkerTool } from "./cursor-worker-tool.js";
export {
	runCursorPromptAsync,
	type RunCursorPromptOptions,
} from "./cursor-prompt.js";
export {
	formatCursorPromptError,
	formatCursorRunFailure,
	MISSING_CURSOR_API_KEY_MESSAGE,
} from "./cursor-prompt-errors.js";
