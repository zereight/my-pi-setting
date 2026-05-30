/**
 * Bash command safety assessment for plan/review mode.
 * All functions are pure string checks — no actual commands are executed.
 *
 * Plan mode decision flow:
 *   1. normalizeCommand()
 *   2. hasShellCompound() — reject chains, pipes, redirects, subshells
 *   3. isDefinitelyWriteCommand()
 *   4. SAFE_BASH allow-list
 *   5. isReadOnlyExternalCommand()
 *
 * Review mode allows read-only compounds (&&, |, 2>&1) when every segment
 * passes the same read-only checks — needed for PR review / zereight-review.
 */

// ── Local read-only command patterns ────────────────────────
/** Commands considered safe in plan mode (no side effects). */
export const SAFE_BASH: RegExp[] = [
  /^\s*(pwd|ls|tree|find|fd|rg|grep|cat|head|tail|less|more|wc|sed\s+-n|awk)\b/i,
  /^\s*git\s+(status|log|show|diff|branch|remote|rev-parse|fetch|merge-base|rev-list|describe|ls-remote)\b/i,
  /^\s*(npm|pnpm|yarn)\s+(list|outdated|info|why|view|show)\b/i,
  /^\s*(uname|whoami|date|uptime)\b/i,
  /^\s*npx\s+react-doctor\b/i,
];

/** Review mode extends plan allow-list with shell navigation helpers. */
export const REVIEW_SAFE_BASH: RegExp[] = [
  ...SAFE_BASH,
  /^\s*cd\s+\S+/,
];

// ── Normalization ───────────────────────────────────────────

/**
 * Normalize a bash command for safety checking:
 * - Strip `rtk` prefix
 * - Normalize absolute mcporter path to just "mcporter"
 */
export function normalizeCommand(command: string): string {
  let cmd = command.trim();
  cmd = cmd.replace(/^rtk\s+/, "");
  cmd = cmd.replace(
    /^\/Users\/[^\/]+\/\.nvm\/versions\/node\/[^\/]+\/bin\/mcporter\b/,
    "mcporter",
  );
  return cmd.trim();
}

// ── Compound detection ──────────────────────────────────────

/**
 * Reject compound shell commands (chains, pipes, redirections, subshells)
 * in plan/review mode. Only single, simple commands are allowed.
 *
 * Strips quoted strings first so `grep -E 'foo|bar'` is treated as simple.
 */
export function hasShellCompound(command: string): boolean {
  // Strip quoted strings to avoid false positives inside arguments
  const stripped = command
    .replace(/"[^"]*"/g, "")
    .replace(/'[^']*'/g, "");

  // Shell chains: ; && || (| also handled as pipe below)
  if (/[;&|]/.test(stripped)) return true;

  // Redirections: < > >>
  if (/[<>]/.test(stripped)) return true;

  // Subshells / command substitution: $() and backticks
  if (/\$\(/.test(stripped) || stripped.includes("`")) return true;

  return false;
}

// ── Review-mode compound helpers ─────────────────────────────

/** Strip read-only stderr/stdout merges before segment classification. */
export function cleanBashSegment(segment: string): string {
  return segment
    .trim()
    .replace(/\s+2>&1\s*$/g, "")
    .replace(/\s+2>\/dev\/null\s*$/g, "")
    .replace(/\s+>\/dev\/null\s*$/g, "")
    .replace(/\s+&>\/dev\/null\s*$/g, "")
    .trim();
}

/**
 * Split a command on unquoted shell operators.
 * Supports: |  &&  ||  ;
 */
export function splitByUnquotedOperators(
  command: string,
  operators: Array<"|" | "&&" | "||" | ";">,
): string[] {
  const parts: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) parts.push(trimmed);
    current = "";
  };

  let index = 0;
  while (index < command.length) {
    const char = command[index];

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      current += char;
      index += 1;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      current += char;
      index += 1;
      continue;
    }

    if (!inSingle && !inDouble) {
      const rest = command.slice(index);
      let matched = false;
      for (const operator of operators) {
        const pattern =
          operator === "|"
            ? /^\s*\|\s*/
            : operator === "&&"
              ? /^\s*&&\s*/
              : operator === "||"
                ? /^\s*\|\|\s*/
                : /^\s*;\s*/;
        const match = rest.match(pattern);
        if (match) {
          pushCurrent();
          index += match[0].length;
          matched = true;
          break;
        }
      }
      if (matched) continue;
    }

    current += char;
    index += 1;
  }

  pushCurrent();
  return parts;
}

/** Block subshells, file redirects, and backgrounding in review compounds. */
export function hasUnsafeShellConstruct(command: string): boolean {
  const stripped = command
    .replace(/"[^"]*"/g, "")
    .replace(/'[^']*'/g, "");

  if (/\$\(/.test(stripped) || stripped.includes("`")) return true;

  const withoutSafeRedirects = stripped
    .replace(/\d>&\d/g, " ")
    .replace(/\d>\/dev\/null/g, " ")
    .replace(/>\/dev\/null/g, " ")
    .replace(/&>\/dev\/null/g, " ")
    .replace(/\d<&\d/g, " ");

  if (/[<>]/.test(withoutSafeRedirects)) return true;

  if (/(?:^|[^&])&(?:\s|$)/.test(withoutSafeRedirects)) return true;

  return false;
}

function forEachCompoundSegment(
  rawCommand: string,
  visit: (segment: string) => void,
): void {
  const pipelines = splitByUnquotedOperators(rawCommand, ["|"]);
  for (const pipeline of pipelines) {
    const segments = splitByUnquotedOperators(pipeline, ["&&", "||", ";"]);
    for (const segment of segments) visit(segment);
  }
}

function hasWriteSegment(rawCommand: string): boolean {
  let found = false;
  forEachCompoundSegment(rawCommand, (segment) => {
    const command = normalizeCommand(cleanBashSegment(segment));
    if (command && isDefinitelyWriteCommand(command)) found = true;
  });
  return found;
}

function isSegmentReadOnly(segment: string, mode: "plan" | "review"): boolean {
  const command = normalizeCommand(cleanBashSegment(segment));
  if (!command) return true;

  if (isDefinitelyWriteCommand(command)) return false;

  const allowlist = mode === "review" ? REVIEW_SAFE_BASH : SAFE_BASH;
  if (allowlist.some((pattern) => pattern.test(command))) return true;
  if (isReadOnlyExternalCommand(command)) return true;

  return false;
}

/**
 * Review mode: allow compound commands when every pipeline segment is read-only.
 * Examples: `cd repo && git diff ...`, `mcporter call ... | head`, `cmd 2>&1`
 */
export function isReviewReadOnlyCompound(rawCommand: string): boolean {
  if (hasUnsafeShellConstruct(rawCommand)) return false;

  let allReadOnly = true;
  forEachCompoundSegment(rawCommand, (segment) => {
    if (!isSegmentReadOnly(segment, "review")) allReadOnly = false;
  });
  return allReadOnly;
}

// ── Deny-list — definitely-write commands ───────────────────

/**
 * Deny-list for definitely-write GitHub/Mcporter/Curl/Find commands.
 * Checked before the read-only allowlist — if any pattern matches, block immediately.
 */
export function isDefinitelyWriteCommand(cmd: string): boolean {
  return [
    // Write GitHub CLI subcommands
    /^\s*gh\s+pr\s+(review|merge|close|reopen|edit|comment|ready|lock|unlock)\b/i,
    /^\s*gh\s+issue\s+(create|edit|comment|close|reopen|transfer|delete|lock|unlock)\b/i,
    /^\s*gh\s+repo\s+(create|delete|rename|edit|transfer|archive|unarchive)\b/i,
    /^\s*gh\s+run\s+(rerun|cancel|delete)\b/i,
    /^\s*gh\s+release\s+(create|edit|delete|upload|download)\b/i,
    // Write GitHub API: explicit method flags or body/data flags
    /^\s*gh\s+api\b[\s\S]*\s(-X|--method)\s+(POST|PATCH|PUT|DELETE)\b/i,
    /^\s*gh\s+api\b[\s\S]*\s(-f|-F|--field|--raw-field|--input)\b/i,
    // Write Mcporter: atlassian mutators (no trailing \b — real calls use PascalCase suffixes)
    /^\s*mcporter\s+call\s+atlassian\.(create|update|delete|remove|transition|assign|add|post|put\b|patch|send|trigger|write|modify|set|revoke|approve|decline|merge|unassign)/i,
    // Write Mcporter: bitbucket mutators (no trailing \b — real calls use _suffixes)
    /^\s*mcporter\s+call\s+bitbucket\.(bb_(post|create|update|delete|remove|merge|approve|decline|add|edit|write|put|patch|comment|assign|review|request))/i,
    // Write curl: explicit write flags
    /^\s*curl\b[\s\S]*\s(-X|--request)\s+(POST|PATCH|PUT|DELETE)\b/i,
    /^\s*curl\b[\s\S]*\s(-d\b|--data\b|--data-raw|--data-binary|--form|--upload-file|--json)\b/i,
    /^\s*curl\b[\s\S]*\s(-o\s+\S+|--output\s+\S+|--remote-name)\b/i,
    /^\s*curl\b[\s\S]*\s-O\b/i,
    // Write find: -delete, -exec, -execdir (preceded by space to avoid matching filenames)
    /^\s*find\b[\s\S]*\s-(?:delete|exec|execdir)\b/i,
  ].some((p) => p.test(cmd));
}

// ── Allow-list — read-only external commands ────────────────

/**
 * Allow-list for read-only external commands (gh, mcporter, curl).
 * Only called *after* isDefinitelyWriteCommand passes (no match).
 */
export function isReadOnlyExternalCommand(cmd: string): boolean {
  return [
    // Read-only GitHub PR, issue, repo, run inspection
    /^\s*gh\s+pr\s+(list|view|diff|checks)\b/i,
    /^\s*gh\s+issue\s+(list|view)\b/i,
    /^\s*gh\s+repo\s+(list|view)\b/i,
    /^\s*gh\s+run\s+(list|view|watch)\b/i,
    /^\s*gh\s+api\b(?!.*\s(-X|--method|--field|--raw-field|--input|-f|-F))/i,
    // Read-only mcporter: server/help inspection
    /^\s*mcporter\s+(list|help|version)\b/i,
    // Read-only mcporter atlassian calls (no trailing \b — real calls use PascalCase suffixes)
    /^\s*mcporter\s+call\s+atlassian\.(get|search|fetch|list|lookup|find|read|query|accessible)/i,
    // Read-only mcporter bitbucket calls (no trailing \b — real calls use _suffixes)
    /^\s*mcporter\s+call\s+bitbucket\.(bb_(get|ls_|diff|list|search|check|describe|find|status|lookup))/i,
    // Read-only mcporter fuck-u-code static analysis (no external ai-review)
    /^\s*mcporter\s+call\s+fuck-u-code\.(analyze|list|help)\b/i,
    // Read-only curl to known safe hosts (write flags blocked separately by isDefinitelyWriteCommand)
    /^\s*curl\b[\s\S]*https:\/\/(?:raw\.githubusercontent\.com|api\.github\.com|registry\.npmjs\.org|context7\.com|api\.bitbucket\.org)\//i,
    // Read-only bitbucket-API helper script: any path ending in bitbucket-api.mjs with read subcommands
    /^\s*node\s+\S*bitbucket-api\.mjs\s+(pr|diff|diffstat|comments|activity|request\s+GET)\b/i,
  ].some((p) => p.test(cmd));
}

// ── Combined classifier ─────────────────────────────────────

/** Result of classifying a bash command in plan/review mode. */
export type BashSafetyResult = "allowed" | "compound" | "write" | "unknown";

/**
 * Classify a bash command for plan/review mode.
 *
 * @param rawCommand  The original command string from the tool call.
 * @param mode        "plan" or "review".
 * @returns           Classification result.
 */
export function classifyBashCommand(
  rawCommand: string,
  mode: "plan" | "review",
): BashSafetyResult {
  const command = normalizeCommand(rawCommand);

  // Review mode: allow read-only compound commands (PR review workflows)
  if (mode === "review" && hasShellCompound(rawCommand)) {
    if (hasWriteSegment(rawCommand) || isDefinitelyWriteCommand(command)) {
      return "write";
    }
    return isReviewReadOnlyCompound(rawCommand) ? "allowed" : "compound";
  }

  // Plan mode (and simple review commands): reject compounds
  if (hasShellCompound(rawCommand)) {
    return "compound";
  }

  // Deny-list: definitely-write patterns
  if (isDefinitelyWriteCommand(command)) {
    return "write";
  }

  // Local safe command allow-list
  const allowlist = mode === "review" ? REVIEW_SAFE_BASH : SAFE_BASH;
  if (allowlist.some((pattern) => pattern.test(command))) {
    return "allowed";
  }

  // Read-only external command allow-list (gh, mcporter, curl)
  if (isReadOnlyExternalCommand(command)) {
    return "allowed";
  }

  // Block everything else
  return "unknown";
}
