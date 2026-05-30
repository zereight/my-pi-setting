/**
 * Tests for bash-safety.ts — pure string checks, no commands executed.
 *
 * Run: npx tsx bash-safety.test.ts
 */

import {
  normalizeCommand,
  hasShellCompound,
  isDefinitelyWriteCommand,
  isReadOnlyExternalCommand,
  SAFE_BASH,
  REVIEW_SAFE_BASH,
  classifyBashCommand,
  BashSafetyResult,
} from "./bash-safety";

// ── Test runner ──────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`✗ FAIL: ${name}`);
    console.error(`  ${e}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertBlock(fn: (cmd: string) => boolean, cmd: string, msg?: string) {
  assert(fn(cmd) === true, msg ?? `expected BLOCK for: ${cmd}`);
}

function assertAllow(fn: (cmd: string) => boolean, cmd: string, msg?: string) {
  assert(fn(cmd) === false, msg ?? `expected ALLOW for: ${cmd}`);
}

function assertClassification(
  cmd: string,
  mode: "plan" | "review",
  expected: BashSafetyResult,
) {
  const actual = classifyBashCommand(cmd, mode);
  assert(
    actual === expected,
    `classifyBashCommand("${cmd}", "${mode}") = "${actual}", expected "${expected}"`,
  );
}

// ── normalizeCommand ────────────────────────────────────────

test("normalizeCommand: strips rtk prefix", () => {
  assert(
    normalizeCommand("rtk git status") === "git status",
    "rtk stripped",
  );
});

test("normalizeCommand: handles mcporter absolute path", () => {
  const fullPath =
    "/Users/foo/.nvm/versions/node/v22.22.2/bin/mcporter list";
  assert(normalizeCommand(fullPath) === "mcporter list", "mcporter normalized");
});

test("normalizeCommand: no-op for clean commands", () => {
  assert(normalizeCommand("ls -la") === "ls -la", "clean");
});

// ── hasShellCompound ────────────────────────────────────────

test("hasShellCompound: semicolon chain (no space)", () => {
  assertBlock(hasShellCompound, "pwd;ls", "semicolon without space");
});

test("hasShellCompound: semicolon chain (with space)", () => {
  assertBlock(hasShellCompound, "pwd ; ls", "semicolon with space");
});

test("hasShellCompound: && chain", () => {
  assertBlock(hasShellCompound, "pwd && ls", "&& chain");
});

test("hasShellCompound: || chain", () => {
  assertBlock(hasShellCompound, "false || pwd", "|| chain");
});

test("hasShellCompound: pipe", () => {
  assertBlock(hasShellCompound, "ls | wc -l", "pipe");
});

test("hasShellCompound: pipe without space", () => {
  assertBlock(hasShellCompound, "ls|wc -l", "pipe no space");
});

test("hasShellCompound: stdout redirect >", () => {
  assertBlock(hasShellCompound, "echo hi > /tmp/x", "> redirect");
});

test("hasShellCompound: stdin redirect <", () => {
  assertBlock(hasShellCompound, "cat < input.txt", "< redirect");
});

test("hasShellCompound: stderr redirect 2>&1", () => {
  assertBlock(hasShellCompound, "cmd 2>&1", "2>&1 redirect");
});

test("hasShellCompound: append redirect >>", () => {
  assertBlock(hasShellCompound, "echo hi >> file", ">> redirect");
});

test("hasShellCompound: here-string <<<", () => {
  assertBlock(hasShellCompound, "cmd <<< word", "<<< redirect");
});

test("hasShellCompound: $() subshell", () => {
  assertBlock(hasShellCompound, 'echo $(pwd)', "$() subshell");
});

test("hasShellCompound: backtick subshell", () => {
  assertBlock(hasShellCompound, "echo `pwd`", "backtick subshell");
});

test("hasShellCompound: allows simple command", () => {
  assertAllow(hasShellCompound, "ls -la", "simple ls");
});

test("hasShellCompound: allows git status", () => {
  assertAllow(hasShellCompound, "git status", "simple git");
});

test("hasShellCompound: allows npm view with pipe-in-quoted-arg", () => {
  assertAllow(
    hasShellCompound,
    "grep -E 'foo|bar' file",
    "pipe inside single quotes",
  );
  assertAllow(
    hasShellCompound,
    'grep -E "foo|bar" file',
    "pipe inside double quotes",
  );
});

test("hasShellCompound: allows $PATH reference", () => {
  assertAllow(hasShellCompound, "echo $PATH", "plain $ variable");
});

test("hasShellCompound: allows $HOME", () => {
  assertAllow(hasShellCompound, "echo $HOME", "$HOME");
});

test("hasShellCompound: allows find with glob in quotes", () => {
  assertAllow(hasShellCompound, "find . -name '*.txt'", "find with glob");
});

test("hasShellCompound: blocks & backgrounding", () => {
  assertBlock(hasShellCompound, "cmd &", "& backgrounding");
});

// ── isDefinitelyWriteCommand ────────────────────────────────

test("isDefinitelyWriteCommand: gh pr review", () => {
  assertBlock(isDefinitelyWriteCommand, "gh pr review 123 -a", "gh pr review");
});

test("isDefinitelyWriteCommand: gh pr merge", () => {
  assertBlock(isDefinitelyWriteCommand, "gh pr merge 123", "gh pr merge");
});

test("isDefinitelyWriteCommand: gh issue create", () => {
  assertBlock(isDefinitelyWriteCommand, "gh issue create -t x", "gh issue create");
});

test("isDefinitelyWriteCommand: gh api with -X POST", () => {
  assertBlock(isDefinitelyWriteCommand, "gh api repos/a/b -X POST", "gh api POST");
});

test("isDefinitelyWriteCommand: gh api with -f field", () => {
  assertBlock(isDefinitelyWriteCommand, "gh api repos/a/b -f title=test", "gh api -f");
});

test("isDefinitelyWriteCommand: mcporter atlassian create", () => {
  assertBlock(isDefinitelyWriteCommand, "mcporter call atlassian.createIssue", "atlassian create");
});

test("isDefinitelyWriteCommand: mcporter bitbucket post", () => {
  assertBlock(isDefinitelyWriteCommand, "mcporter call bitbucket.bb_post_comment", "bitbucket post");
});

test("isDefinitelyWriteCommand: curl -X POST", () => {
  assertBlock(isDefinitelyWriteCommand, "curl -X POST https://example.com", "curl POST");
});

test("isDefinitelyWriteCommand: curl -d data", () => {
  assertBlock(isDefinitelyWriteCommand, "curl -d '{}' https://api.github.com/repos/a/b", "curl -d");
});

test("isDefinitelyWriteCommand: curl --data", () => {
  assertBlock(isDefinitelyWriteCommand, "curl --data '{}' https://api.github.com/repos/a/b", "curl --data");
});

test("isDefinitelyWriteCommand: curl --json", () => {
  assertBlock(isDefinitelyWriteCommand, "curl --json '{}' https://api.github.com/repos/a/b", "curl --json");
});

test("isDefinitelyWriteCommand: curl -o output", () => {
  assertBlock(isDefinitelyWriteCommand, "curl -o /tmp/x https://raw.githubusercontent.com/a/b/main/x", "curl -o");
});

test("isDefinitelyWriteCommand: curl -O remote-name", () => {
  assertBlock(isDefinitelyWriteCommand, "curl -O https://raw.githubusercontent.com/a/b/main/x", "curl -O");
});

test("isDefinitelyWriteCommand: curl --output", () => {
  assertBlock(isDefinitelyWriteCommand, "curl --output /tmp/x https://raw.githubusercontent.com/a/b/main/x", "curl --output");
});

test("isDefinitelyWriteCommand: curl --upload-file", () => {
  assertBlock(isDefinitelyWriteCommand, "curl --upload-file ./x https://example.com", "curl --upload-file");
});

test("isDefinitelyWriteCommand: find -delete", () => {
  assertBlock(isDefinitelyWriteCommand, "find . -type f -delete", "find -delete");
});

test("isDefinitelyWriteCommand: find -exec", () => {
  assertBlock(isDefinitelyWriteCommand, "find . -exec rm {} +", "find -exec");
});

test("isDefinitelyWriteCommand: find -execdir", () => {
  assertBlock(isDefinitelyWriteCommand, "find . -execdir ls {} \\;", "find -execdir");
});

test("isDefinitelyWriteCommand: allows read-only gh commands", () => {
  assertAllow(isDefinitelyWriteCommand, "gh pr list", "gh pr list");
  assertAllow(isDefinitelyWriteCommand, "gh pr view 123", "gh pr view");
  assertAllow(isDefinitelyWriteCommand, "gh issue list", "gh issue list");
  assertAllow(isDefinitelyWriteCommand, "gh api repos/a/b", "gh api GET");
});

test("isDefinitelyWriteCommand: allows read-only curl", () => {
  assertAllow(isDefinitelyWriteCommand, "curl -sS https://api.github.com/repos/a/b", "curl read-only");
});

test("isDefinitelyWriteCommand: allows find with -name only", () => {
  assertAllow(isDefinitelyWriteCommand, "find . -name 'foo-delete.txt'", "find name only");
  assertAllow(isDefinitelyWriteCommand, "find . -type f -name '*.txt'", "find type name");
});

test("isDefinitelyWriteCommand: allows gh pr list", () => {
  assertAllow(isDefinitelyWriteCommand, "gh pr list", "gh pr list");
});

test("isDefinitelyWriteCommand: allows gh api -H", () => {
  assertAllow(isDefinitelyWriteCommand, "gh api repos/a/b -H 'Accept: raw'", "gh api -H");
});

// ── isReadOnlyExternalCommand ───────────────────────────────

test("isReadOnlyExternalCommand: gh pr list", () => {
  assert(isReadOnlyExternalCommand("gh pr list"), "gh pr list");
});

test("isReadOnlyExternalCommand: gh pr view", () => {
  assert(isReadOnlyExternalCommand("gh pr view 123"), "gh pr view");
});

test("isReadOnlyExternalCommand: gh pr diff", () => {
  assert(isReadOnlyExternalCommand("gh pr diff"), "gh pr diff");
});

test("isReadOnlyExternalCommand: gh pr checks", () => {
  assert(isReadOnlyExternalCommand("gh pr checks"), "gh pr checks");
});

test("isReadOnlyExternalCommand: gh issue view", () => {
  assert(isReadOnlyExternalCommand("gh issue view 1"), "gh issue view");
});

test("isReadOnlyExternalCommand: gh repo list", () => {
  assert(isReadOnlyExternalCommand("gh repo list"), "gh repo list");
});

test("isReadOnlyExternalCommand: gh api plain GET", () => {
  assert(isReadOnlyExternalCommand("gh api repos/a/b"), "gh api GET");
});

test("isReadOnlyExternalCommand: gh api with -H header", () => {
  assert(isReadOnlyExternalCommand("gh api repos/a/b -H 'Accept: raw'"), "gh api -H");
});

test("isReadOnlyExternalCommand: mcporter list", () => {
  assert(isReadOnlyExternalCommand("mcporter list"), "mcporter list");
});

test("isReadOnlyExternalCommand: mcporter atlassian get", () => {
  assert(isReadOnlyExternalCommand("mcporter call atlassian.getIssue"), "atlassian get");
});

test("isReadOnlyExternalCommand: mcporter bitbucket bb_get", () => {
  assert(isReadOnlyExternalCommand("mcporter call bitbucket.bb_get_pr"), "bitbucket get");
});

test("isReadOnlyExternalCommand: curl raw.githubusercontent", () => {
  assert(
    isReadOnlyExternalCommand(
      "curl -sSL https://raw.githubusercontent.com/software-mansion/rnrepo/main/README.md",
    ),
    "curl raw.githubusercontent",
  );
});

test("isReadOnlyExternalCommand: curl api.github.com", () => {
  assert(
    isReadOnlyExternalCommand(
      "curl -sS https://api.github.com/repos/software-mansion/rnrepo",
    ),
    "curl api.github.com",
  );
});

test("isReadOnlyExternalCommand: curl registry.npmjs.org", () => {
  assert(
    isReadOnlyExternalCommand("curl -sS https://registry.npmjs.org/react-native"),
    "curl registry.npmjs.org",
  );
});

test("isReadOnlyExternalCommand: curl context7.com", () => {
  assert(
    isReadOnlyExternalCommand("curl -sS https://context7.com/api/v2/libs/search"),
    "curl context7.com",
  );
});

test("isReadOnlyExternalCommand: curl api.bitbucket.org", () => {
  assert(
    isReadOnlyExternalCommand(
      "curl -sS --fail https://api.bitbucket.org/2.0/repositories/bank-x/mobile-app-workspace/pullrequests/2124",
    ),
    "curl api.bitbucket.org",
  );
});

test("isReadOnlyExternalCommand: node bitbucket-api.mjs pr", () => {
  assert(
    isReadOnlyExternalCommand(
      "node /Users/tao.exe/Documents/skill/skills/bitbucket-api-env/scripts/bitbucket-api.mjs pr 2124",
    ),
    "node bitbucket-api.mjs pr",
  );
});

test("isReadOnlyExternalCommand: node bitbucket-api.mjs diff", () => {
  assert(
    isReadOnlyExternalCommand(
      "node /path/to/bitbucket-api.mjs diff 2124",
    ),
    "node bitbucket-api.mjs diff",
  );
});

test("isReadOnlyExternalCommand: node bitbucket-api.mjs diffstat", () => {
  assert(
    isReadOnlyExternalCommand(
      "node /path/to/bitbucket-api.mjs diffstat 2124",
    ),
    "node bitbucket-api.mjs diffstat",
  );
});

test("isReadOnlyExternalCommand: node bitbucket-api.mjs request GET", () => {
  assert(
    isReadOnlyExternalCommand(
      "node /path/to/bitbucket-api.mjs request GET /repositories/bank-x/mobile-app-workspace/pullrequests?state=OPEN",
    ),
    "node bitbucket-api.mjs request GET",
  );
});

test("isReadOnlyExternalCommand: rejects node bitbucket-api.mjs request POST", () => {
  assert(
    !isReadOnlyExternalCommand(
      "node /path/to/bitbucket-api.mjs request POST /repositories/bank-x/mobile-app-workspace/pullrequests",
    ),
    "node bitbucket-api.mjs request POST not read-only",
  );
});

test("isReadOnlyExternalCommand: rejects gh api with -X POST", () => {
  assert(
    !isReadOnlyExternalCommand("gh api repos/a/b -X POST"),
    "gh api POST not read-only",
  );
});

test("isReadOnlyExternalCommand: rejects gh api with -f", () => {
  assert(
    !isReadOnlyExternalCommand("gh api repos/a/b -f title=test"),
    "gh api -f not read-only",
  );
});

// ── SAFE_BASH local allow-list ──────────────────────────────

test("SAFE_BASH: finds npm view", () => {
  assert(
    SAFE_BASH.some((p) => p.test("npm view react-native version")),
    "npm view matched",
  );
});

test("SAFE_BASH: finds npm show", () => {
  assert(
    SAFE_BASH.some((p) => p.test("npm show react-native")),
    "npm show matched",
  );
});

test("SAFE_BASH: finds npm info", () => {
  assert(
    SAFE_BASH.some((p) => p.test("npm info react-native")),
    "npm info matched",
  );
});

test("SAFE_BASH: finds pnpm view", () => {
  assert(
    SAFE_BASH.some((p) => p.test("pnpm view react-native version")),
    "pnpm view matched",
  );
});

test("SAFE_BASH: finds git diff", () => {
  assert(SAFE_BASH.some((p) => p.test("git diff HEAD~3..HEAD")), "git diff");
});

// ── classifyBashCommand (integration) ───────────────────────

test("classifyBashCommand: allows pwd in plan mode", () => {
  assertClassification("pwd", "plan", "allowed");
});

test("classifyBashCommand: allows rtk git status", () => {
  assertClassification("rtk git status", "plan", "allowed");
});

test("classifyBashCommand: allows curl read-only to raw.githubusercontent.com", () => {
  assertClassification(
    "curl -sSL https://raw.githubusercontent.com/software-mansion/rnrepo/main/README.md",
    "plan",
    "allowed",
  );
});

test("classifyBashCommand: allows curl to registry.npmjs.org", () => {
  assertClassification(
    "curl -sS https://registry.npmjs.org/react-native",
    "plan",
    "allowed",
  );
});

test("classifyBashCommand: allows npm view", () => {
  assertClassification("npm view react-native version", "plan", "allowed");
});

test("classifyBashCommand: allows gh api read-only", () => {
  assertClassification("gh api repos/software-mansion/rnrepo", "plan", "allowed");
});

test("classifyBashCommand: blocks compound command (semicolon)", () => {
  assertClassification("pwd; ls", "plan", "compound");
});

test("classifyBashCommand: blocks pipe", () => {
  assertClassification("ls | wc -l", "plan", "compound");
});

test("classifyBashCommand: blocks curl -o", () => {
  assertClassification("curl -o /tmp/x https://raw.githubusercontent.com/a/b/c", "plan", "write");
});

test("classifyBashCommand: blocks curl -d", () => {
  assertClassification("curl -d '{}' https://api.github.com/repos/a/b", "plan", "write");
});

test("classifyBashCommand: blocks gh pr merge", () => {
  assertClassification("gh pr merge", "plan", "write");
});

test("classifyBashCommand: blocks find -delete", () => {
  assertClassification("find . -type f -delete", "plan", "write");
});

test("classifyBashCommand: blocks unknown command", () => {
  assertClassification("rm -rf /", "plan", "unknown");
});

test("classifyBashCommand: allows curl to api.bitbucket.org in review mode", () => {
  assertClassification(
    "curl -sS --fail https://api.bitbucket.org/2.0/repositories/bank-x/mobile-app-workspace/pullrequests/2124",
    "review",
    "allowed",
  );
});

test("classifyBashCommand: allows node bitbucket-api.mjs pr in review mode", () => {
  assertClassification(
    "node /Users/tao.exe/Documents/skill/skills/bitbucket-api-env/scripts/bitbucket-api.mjs pr 2124",
    "review",
    "allowed",
  );
});

test("classifyBashCommand: blocks node bitbucket-api.mjs request POST in review mode", () => {
  assertClassification(
    "node /path/to/bitbucket-api.mjs request POST /repositories/bank-x/mobile-app-workspace/pullrequests",
    "review",
    "unknown",
  );
});

test("classifyBashCommand: blocks curl with -X POST", () => {
  assertClassification(
    "curl -X POST https://api.github.com/repos/a/b/issues",
    "plan",
    "write",
  );
});

test("classifyBashCommand: blocks curl with -X POST to api.bitbucket.org", () => {
  assertClassification(
    "curl -X POST https://api.bitbucket.org/2.0/repositories/bank-x/mobile-app-workspace/pullrequests",
    "review",
    "write",
  );
});

test("classifyBashCommand: allows curl -sS to api.github.com", () => {
  assertClassification(
    "curl -sS https://api.github.com/repos/software-mansion/rnrepo",
    "plan",
    "allowed",
  );
});

test("classifyBashCommand: allows gh pr view", () => {
  assertClassification("gh pr view 123", "plan", "allowed");
});

test("classifyBashCommand: allows gh issue list", () => {
  assertClassification("gh issue list", "plan", "allowed");
});

test("classifyBashCommand: allows mcporter list", () => {
  assertClassification("mcporter list", "plan", "allowed");
});

test("classifyBashCommand: allows find with -name", () => {
  assertClassification("find . -name '*.txt'", "plan", "allowed");
});

test("classifyBashCommand: blocks gh api with -f", () => {
  assertClassification("gh api repos/a/b -f title=x", "plan", "write");
});

test("classifyBashCommand: mcporter bitbucket bb_create is write", () => {
  assertClassification(
    "mcporter call bitbucket.bb_create_pr",
    "plan",
    "write",
  );
});

// ── Review mode: read-only compound commands ─────────────────

test("classifyBashCommand review: allows mcporter list with 2>&1", () => {
  assertClassification("mcporter list fuck-u-code 2>&1", "review", "allowed");
});

test("classifyBashCommand review: allows mcporter bb_get_pr piped to head", () => {
  assertClassification(
    "mcporter call bitbucket.bb_get_pr workspaceSlug=bank-x repoSlug=mobile-app-workspace prId=2220 includeFullDiff=true | head -c 500000",
    "review",
    "allowed",
  );
});

test("classifyBashCommand review: allows cd && git fetch chain", () => {
  assertClassification(
    "cd /Users/tao.exe/Documents/my-project && git fetch origin && git rev-parse HEAD && git branch --show-current && git log -1 --oneline",
    "review",
    "allowed",
  );
});

test("classifyBashCommand review: allows git diff with 2>&1", () => {
  assertClassification(
    "git diff refs/remotes/origin/develop...refs/remotes/origin/jira/MP-1232-2 --stat 2>&1",
    "review",
    "allowed",
  );
});

test("classifyBashCommand review: allows git log piped to head", () => {
  assertClassification(
    "git log refs/remotes/origin/develop..refs/remotes/origin/jira/MP-1232-2 --oneline | head -30",
    "review",
    "allowed",
  );
});

test("classifyBashCommand review: allows fuck-u-code analyze piped to head", () => {
  assertClassification(
    'mcporter call fuck-u-code.analyze path="/Users/tao.exe/Documents/my-project/packages/core/src/lib" format=json top=15 verbose=false | head -c 80000',
    "review",
    "allowed",
  );
});

test("classifyBashCommand review: blocks write segment inside compound", () => {
  assertClassification("gh pr merge && git status", "review", "write");
});

test("classifyBashCommand review: still blocks subshell compounds", () => {
  assertClassification("echo $(pwd)", "review", "compound");
});

test("classifyBashCommand plan: still blocks mcporter list with 2>&1", () => {
  assertClassification("mcporter list fuck-u-code 2>&1", "plan", "compound");
});

// ── Report ──────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
const total = passed + failed;
console.log(`Results: ${passed}/${total} passed, ${failed}/${total} failed`);
if (failed > 0) process.exit(1);
