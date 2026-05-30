/**
 * harness — Pi-native evaluate→improve→persist loop
 *
 * Builds on autoctx (judge/improve core) + Pi tools to provide a coherent
 * harness for systematic agent output improvement and knowledge accumulation.
 *
 * Auto-loaded from ~/.pi/agent/extensions/harness/index.ts
 *
 * Tools:
 *   harness_solve     — Full solve loop (generate → judge → improve → persist)
 *   harness_knowledge — Read/write/list playbooks and hints
 *   harness_status    — Recent runs and knowledge overview
 *
 * Command:
 *   /harness — Load the interactive skill
 */

import {
  type ExtensionAPI,
  truncateTail,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIMITS = { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES };
const KNOWLEDGE_ROOT_DEFAULT = "knowledge";
const RUNS_ROOT_DEFAULT = "runs";

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function ok(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: "text" as const, text }], details };
}
function okTrimmed(text: string, details: Record<string, unknown> = {}) {
  const t = truncateTail(text, LIMITS);
  return ok(t.content, t.truncated ? { ...details, truncated: true } : details);
}
function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}
function badge(n: number) {
  return n >= 0.85 ? `✅ ${pct(n)}` : n >= 0.6 ? `⚠️  ${pct(n)}` : `❌ ${pct(n)}`;
}

// ---------------------------------------------------------------------------
// File helpers (dynamic imports to avoid ESM/CJS issues at load time)
// ---------------------------------------------------------------------------

async function fs() {
  return await import("node:fs");
}
async function path() {
  return await import("node:path");
}

async function knowledgeDir(scenario: string, kind: "playbook" | "hints") {
  const root = process.env.AUTOCONTEXT_KNOWLEDGE_ROOT ?? KNOWLEDGE_ROOT_DEFAULT;
  const p = await path();
  return p.join(root, scenario, `${kind}.md`);
}

async function readKnowledge(scenario: string, kind: "playbook" | "hints"): Promise<string> {
  try {
    const f = await fs();
    return f.readFileSync(await knowledgeDir(scenario, kind), "utf-8");
  } catch {
    return "";
  }
}

async function writeKnowledge(scenario: string, kind: "playbook" | "hints", content: string) {
  const f = await fs();
  const p = await path();
  const dir = p.dirname(await knowledgeDir(scenario, kind));
  if (!f.existsSync(dir)) f.mkdirSync(dir, { recursive: true });
  f.writeFileSync(await knowledgeDir(scenario, kind), content, "utf-8");
}

async function listScenarios(): Promise<string[]> {
  try {
    const root = process.env.AUTOCONTEXT_KNOWLEDGE_ROOT ?? KNOWLEDGE_ROOT_DEFAULT;
    const f = await fs();
    const p = await path();
    if (!f.existsSync(root)) return [];
    return f
      .readdirSync(root)
      .filter((n: string) => f.statSync(p.join(root, n)).isDirectory())
      .filter((n: string) => f.existsSync(p.join(root, n, "playbook.md")));
  } catch {
    return [];
  }
}

async function runsJsonl() {
  const root = process.env.AUTOCONTEXT_RUNS_ROOT ?? RUNS_ROOT_DEFAULT;
  const p = await path();
  return p.join(root, "harness-runs.jsonl");
}

async function appendRun(run: Record<string, unknown>) {
  const f = await fs();
  const p = await path();
  const file = await runsJsonl();
  if (!f.existsSync(p.dirname(file))) f.mkdirSync(p.dirname(file), { recursive: true });
  f.appendFileSync(
    file,
    JSON.stringify({ ts: new Date().toISOString(), ...run }) + "\n",
    "utf-8",
  );
}

async function recentRuns(limit = 10): Promise<Record<string, unknown>[]> {
  try {
    const f = await fs();
    return f
      .readFileSync(await runsJsonl(), "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((l: string) => JSON.parse(l))
      .reverse();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Autoctx loader (deferred — not imported at registration time)
// ---------------------------------------------------------------------------

let _ac: any = null;
async function ac() {
  if (!_ac) _ac = await import("autoctx");
  return _ac;
}

function resolveProvider(a: any) {
  const settings =
    typeof a.resolveSettings === "function"
      ? a.resolveSettings()
      : {
          piCommand: process.env.AUTOCONTEXT_PI_COMMAND ?? "pi",
        };
  const config =
    typeof a.resolveProviderConfig === "function" ? a.resolveProviderConfig() : {};
  return a.createProvider({
    ...config,
    piCommand: settings.piCommand,
    piTimeout: settings.piTimeout,
    piWorkspace: settings.piWorkspace,
    piModel: settings.piModel,
  });
}

// ---------------------------------------------------------------------------
// Generate a candidate output for a given task prompt
// ---------------------------------------------------------------------------
async function generate(a: any, provider: any, prompt: string, model?: string) {
  // Use autoctx's SimpleAgentTask.generateOutput for structured generation
  try {
    const task = new a.SimpleAgentTask(prompt, "", provider, model ?? provider.defaultModel?.());
    const output = await task.generateOutput();
    return { output: output ?? "", tokensIn: 0, tokensOut: 0 };
  } catch {
    // Fallback: direct API via provider
    try {
      const resp = await provider.generateText?.({
        model: model ?? provider.defaultModel?.(provider.models?.[0] ?? ""),
        messages: [{ role: "user", content: prompt }],
        maxTokens: 8192,
      });
      return {
        output: resp?.content?.[0]?.text ?? resp?.completion ?? resp?.message?.content ?? "",
        tokensIn: resp?.usage?.inputTokens ?? 0,
        tokensOut: resp?.usage?.outputTokens ?? 0,
      };
    } catch {
      // Last resort: use the provider as a simple completion function
      const result = await provider.complete?.(prompt) ?? "(generation failed)";
      return { output: result, tokensIn: 0, tokensOut: 0 };
    }
  }
}

// ---------------------------------------------------------------------------
// Abort guard
// ---------------------------------------------------------------------------
function guard(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw new Error(String(signal.reason ?? "harness tool aborted"));
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function harness(pi: ExtensionAPI) {
  // ===================================================================
  // harness_solve — full evaluate→improve→persist loop
  // ===================================================================

  pi.registerTool({
    name: "harness_solve",
    label: "🧪 Solve",
    description:
      "Full solve loop: generate candidates, judge each against a rubric, iteratively improve, and persist playbook knowledge to knowledge/<scenario>/playbook.md. Use when you need systematic output improvement.",
    promptSnippet: "Run improve→judge→persist loop for systematic agent output improvement",
    promptGuidelines: [
      "Use for iterative improvement of agent outputs with judge-based scoring.",
      "gens controls the number of generation/improvement rounds (default 2, cheaper = lower).",
      "goal is the plain-language task description.",
      "rubric defines the evaluation criteria — be specific for best results.",
      "Results persist automatically as playbooks + run log.",
      "Each round consumes Pi provider quota.",
    ],
    parameters: Type.Object({
      goal: Type.String({ description: "Task goal in plain language" }),
      rubric: Type.String({ description: "Evaluation rubric / scoring criteria" }),
      scenario_name: Type.Optional(
        Type.String({ description: "Knowledge namespace (default: 'agent_task')" }),
      ),
      gens: Type.Optional(
        Type.Number({ description: "Generation rounds (1–10, default 2)" }),
      ),
      model: Type.Optional(Type.String({ description: "Model override for judge" })),
      verbose: Type.Optional(Type.Boolean({ description: "Show full output + reasoning" })),
    }),
    async execute(_id, params, signal, onUpdate, _ctx) {
      const a = await ac();
      const provider = resolveProvider(a);
      const scenario = (params.scenario_name as string) ?? "agent_task";
      const gens = Math.max(1, Math.min(10, (params.gens as number) ?? 2));
      const goal = params.goal as string;
      const rubric = params.rubric as string;
      const model = (params.model as string) || undefined;
      const verbose = params.verbose === true;

      onUpdate?.({
        content: [{ type: "text", text: `🧪 · ${goal.slice(0, 70)}… · ${gens} gen(s)` }],
        details: { scenario, gens },
      });

      const judge = new a.LLMJudge({
        provider,
        model: model || provider.defaultModel?.(),
        rubric,
      });

      const results: { gen: number; score: number; output: string; reasoning: string }[] = [];
      let bestScore = 0;
      let bestOutput = "";
      let current = "";

      for (let gen = 1; gen <= gens; gen++) {
        guard(signal);
        onUpdate?.({
          content: [{ type: "text", text: `  gen ${gen}/${gens} · generating…` }],
          details: { gen, gens },
        });

        const prompt =
          gen === 1
            ? goal
            : `${goal}\n\nPrevious best (${badge(bestScore)}):\n${bestOutput}\n\nImprove based on feedback and aim higher.`;
        const cand = await generate(a, provider, prompt, model);
        current = cand.output || "(empty)";

        guard(signal);
        onUpdate?.({
          content: [{ type: "text", text: `  gen ${gen}/${gens} · judging…` }],
          details: { gen, gens, phase: "judge" },
        });

        const j = await judge.evaluate({ taskPrompt: goal, agentOutput: current });
        const score = j.score ?? 0;
        results.push({ gen, score, output: current, reasoning: j.reasoning ?? "" });

        if (score > bestScore) {
          bestScore = score;
          bestOutput = current;
        }
        onUpdate?.({
          content: [{ type: "text", text: `  gen ${gen}/${gens} · ${badge(score)}` }],
          details: { gen, gens, score, bestScore },
        });
      }

      // --- Persist playbook ---
      const stamp = new Date().toISOString();
      const existing = await readKnowledge(scenario, "playbook");
      const entry = [
        `<!-- harness gen at ${stamp} -->`,
        `## ${goal.slice(0, 120)}`,
        `- Best: ${badge(bestScore)} after ${gens} gen(s)`,
        `- Rubric: ${rubric.slice(0, 250)}`,
        ...results.map((r) => `- Gen ${r.gen}: ${badge(r.score)} — ${r.reasoning.slice(0, 160)}`),
        "",
      ].join("\n");
      const pb = existing ? `${existing}\n\n${entry}` : `# Playbook: ${scenario}\n\n${entry}`;
      await writeKnowledge(scenario, "playbook", pb);

      // --- Record run ---
      const runId = `hrn_${Date.now().toString(36)}`;
      await appendRun({
        run_id: runId,
        scenario,
        goal: goal.slice(0, 300),
        gens,
        bestScore,
        scores: results.map((r) => ({ gen: r.gen, score: r.score })),
      });

      // --- Build output ---
      const lines = [
        `🏁 solve · ${runId}`,
        `   scenario: ${scenario}`,
        `   goal: ${goal}`,
        ``,
        `   scores:`,
        ...results.map((r) => `     gen ${r.gen}: ${badge(r.score)}`),
        ``,
        `   best: ${badge(bestScore)}`,
        `   playbook: knowledge/${scenario}/playbook.md`,
      ];
      if (verbose && bestOutput) {
        lines.push(``, `   best output:`, `   ${"─".repeat(40)}`, bestOutput, `   ${"─".repeat(40)}`);
      }
      return okTrimmed(lines.join("\n"), {
        runId,
        scenario,
        bestScore,
        gens,
        scores: results.map((r) => ({ gen: r.gen, score: r.score })),
      });
    },
    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("solve "))}${theme.fg("accent", (args.goal as string)?.slice(0, 60) ?? "")}`,
        0, 0,
      );
    },
    renderResult(result, _opts, theme) {
      const d = result.details as { bestScore?: number } | undefined;
      if (d?.bestScore !== undefined) return new Text(theme.fg("accent", badge(d.bestScore)), 0, 0);
      const t = result.content[0];
      return new Text(t?.type === "text" ? t.text : "", 0, 0);
    },
  });

  // ===================================================================
  // harness_knowledge — playbook/hint management
  // ===================================================================

  pi.registerTool({
    name: "harness_knowledge",
    label: "📚 Knowledge",
    description:
      "List, read, or write accumulated harness playbooks and hints. Playbooks live under knowledge/<scenario>/ and survive across sessions.",
    promptSnippet: "Manage accumulated harness knowledge (playbooks, hints)",
    promptGuidelines: [
      "Use 'list' to see all scenarios with playbooks.",
      "Use 'read' to inspect a scenario's full playbook.",
      "Use 'write' to append a manual knowledge entry.",
    ],
    parameters: Type.Object({
      action: Type.Enum({ list: "list", read: "read", write: "write" }),
      scenario: Type.Optional(Type.String({ description: "Scenario name (required for read/write)" })),
      content: Type.Optional(Type.String({ description: "Content to write (for action=write)" })),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const action = params.action as string;

      if (action === "list") {
        const sc = await listScenarios();
        return ok(sc.length ? `Scenarios:\n${sc.map((s: string) => `  · ${s}`).join("\n")}` : "No playbooks yet.");
      }

      const scenario = params.scenario as string;
      if (!scenario) return ok("error: scenario required", { error: true });

      if (action === "read") {
        const pb = await readKnowledge(scenario, "playbook");
        const hints = await readKnowledge(scenario, "hints");
        const parts: string[] = [];
        if (pb) parts.push(`## Playbook\n${pb}`);
        if (hints) parts.push(`## Hints\n${hints}`);
        return parts.length ? okTrimmed(parts.join("\n\n"), { scenario }) : ok(`(empty) ${scenario}`);
      }

      if (action === "write") {
        const content = params.content as string;
        if (!content) return ok("error: content required", { error: true });
        const existing = await readKnowledge(scenario, "playbook");
        const ts = new Date().toISOString();
        const prefix = existing ? `${existing}\n\n` : `# Playbook: ${scenario}\n\n`;
        await writeKnowledge(scenario, "playbook", `${prefix}<!-- ${ts} -->\n${content}`);
        return ok(`✓ knowledge/${scenario}/playbook.md`);
      }
      return ok(`unknown action: ${action}`, { error: true });
    },
    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("knowledge "))}${theme.fg("accent", args.action as string)}${args.scenario ? theme.fg("dim", ` ${args.scenario}`) : ""}`,
        0, 0,
      );
    },
  });

  // ===================================================================
  // harness_status — run history + knowledge overview
  // ===================================================================

  pi.registerTool({
    name: "harness_status",
    label: "📊 Status",
    description:
      "Show recent harness runs with scores, plus all scenarios with accumulated playbooks.",
    promptSnippet: "Show harness activity and accumulated knowledge",
    promptGuidelines: [
      "Quick overview of all harness activity.",
      "Optionally filter by scenario.",
    ],
    parameters: Type.Object({
      limit: Type.Optional(Type.Number({ description: "Runs to show (max 20, default 5)" })),
      scenario: Type.Optional(Type.String({ description: "Filter by scenario" })),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const limit = Math.min(20, Math.max(1, (params.limit as number) ?? 5));
      const filter = params.scenario as string | undefined;
      const runs = (await recentRuns(20)).filter((r) => !filter || r.scenario === filter);
      const scenarios = await listScenarios();

      const lines = [
        `📊 harness status`,
        `   runs: ${runs.length} total / ${scenarios.length} scenario(s) with playbooks`,
        ``,
      ];
      if (runs.length) {
        lines.push(`   recent runs:`);
        for (const r of runs.slice(0, limit)) {
          const s = typeof r.bestScore === "number" ? badge(r.bestScore) : "?";
          const g = ((r.goal as string) ?? "").slice(0, 50);
          const sc = (r.scenario as string) ?? "";
          lines.push(`     ${r.run_id}  ${s}  [${sc}]  ${g}`);
        }
      } else {
        lines.push(`   no runs yet. try \`harness_solve\`.`);
      }
      return okTrimmed(lines.join("\n"), { totalRuns: runs.length, scenarios });
    },
    renderCall(_args, theme) {
      return new Text(theme.fg("toolTitle", theme.bold("status ")), 0, 0);
    },
  });

  // ===================================================================
  // /harness command
  // ===================================================================

  pi.registerCommand("harness", {
    description: "Load the harness skill with usage instructions and interactive help",
    handler: async () => {
      // Skill handles the details
    },
  });

  // ===================================================================
  // Lifecycle
  // ===================================================================

  pi.on("session_start", async (_event, ctx) => {
    try {
      const { existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      if (existsSync(join(ctx.cwd, ".autoctx.json"))) {
        ctx.ui.setStatus("harness", "🧪 ready");
      }
    } catch {
      // ignore
    }
  });
}
