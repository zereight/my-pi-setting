import {
	AgentBusyError,
	AuthenticationError,
	ConfigurationError,
	CursorSdkError,
	NetworkError,
	RateLimitError,
} from "@cursor/sdk";
import type { RunResult } from "@cursor/sdk";

export const MISSING_CURSOR_API_KEY_MESSAGE =
	"Cursor API key missing. Set CURSOR_API_KEY, pass apiKey to cursor_worker, or save a key via `pi /login` → Use an API key → Cursor.";

function isLikelyAuthMessage(message: string): boolean {
	return /\b(unauthenticated|unauthorized|unauthorised|forbidden|invalid api key|invalid key|authentication|auth|401|403)\b/i.test(
		message,
	);
}

function isLikelyNetworkMessage(message: string): boolean {
	return (
		/\b(ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN)\b/i.test(message) ||
		/\b(timeout|timed out|unavailable|network)\b/i.test(message)
	);
}

/**
 * Map thrown SDK/config errors to short messages suitable for Pi tool output.
 */
export function formatCursorPromptError(error: unknown): string {
	if (error instanceof AuthenticationError) {
		return "Cursor authentication failed. Check CURSOR_API_KEY or run `pi /login` → Use an API key → Cursor.";
	}
	if (error instanceof RateLimitError) {
		const detail = error.message.trim();
		return detail ? `Cursor rate limit: ${detail}` : "Cursor rate limit exceeded. Retry later.";
	}
	if (error instanceof AgentBusyError) {
		return "Cursor agent is busy with another run. Wait and retry.";
	}
	if (error instanceof NetworkError) {
		const detail = error.message.trim();
		return detail
			? `Cursor network error: ${detail}`
			: "Cursor network error. Check connectivity and retry.";
	}
	if (error instanceof ConfigurationError) {
		const detail = error.message.trim();
		return detail ? `Cursor configuration error: ${detail}` : "Cursor configuration error.";
	}
	if (error instanceof CursorSdkError) {
		const detail = error.message.trim();
		return detail ? `Cursor SDK error: ${detail}` : "Cursor SDK request failed.";
	}
	if (error instanceof Error) {
		const detail = error.message.trim();
		if (!detail) return "Cursor worker request failed.";
		if (detail === MISSING_CURSOR_API_KEY_MESSAGE) return MISSING_CURSOR_API_KEY_MESSAGE;
		if (isLikelyAuthMessage(detail)) {
			return "Cursor authentication failed. Check CURSOR_API_KEY or run `pi /login` → Use an API key → Cursor.";
		}
		if (isLikelyNetworkMessage(detail)) {
			return `Cursor network error: ${detail}`;
		}
		return detail;
	}
	if (typeof error === "string" && error.trim()) {
		return error.trim();
	}
	return "Cursor worker request failed.";
}

/**
 * Map a non-finished RunResult to a readable failure message.
 */
export function formatCursorRunFailure(result: RunResult): string {
	if (result.status === "cancelled") {
		return "Cursor worker run was cancelled.";
	}
	if (result.status === "error") {
		const detail = result.result?.trim();
		if (detail) {
			if (isLikelyAuthMessage(detail)) {
				return "Cursor authentication failed. Check CURSOR_API_KEY or run `pi /login` → Use an API key → Cursor.";
			}
			return `Cursor worker failed: ${detail}`;
		}
		return `Cursor worker failed (run ${result.id}).`;
	}
	return `Cursor worker ended with unexpected status: ${result.status}`;
}

export function assertCursorRunFinished(result: RunResult): void {
	if (result.status !== "finished") {
		throw new Error(formatCursorRunFailure(result));
	}
}
