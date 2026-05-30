/**
 * AgentMemory Extension for Pi
 *
 * Provides persistent, cross-session memory for Pi using JSONL file storage
 * and keyword-based search. Zero external dependencies.
 *
 * Features:
 * - memory_search / memory_add / memory_list / memory_delete tools for LLM
 * - /memory command for users
 * - Auto context injection via before_agent_start
 * - Sensitive data filtering
 * - Project namespacing (project-level + global-level memories)
 * - Configurable via settings
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { matchesKey, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemoryRecord {
  id: string;
  text: string;
  tags: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface MemoryConfig {
  /** Top-K results for auto search injection */
  topK: number;
  /** Max characters per memory result in auto injection */
  maxCharsPerResult: number;
  /** Enable automatic search on every prompt */
  autoSearch: boolean;
  /** Timeout in ms for file operations */
  timeoutMs: number;
  /** Require user confirmation before saving */
  requireConfirm: boolean;
  /** File path for memories storage (overrides default) */
  storagePath?: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: MemoryConfig = {
  topK: 5,
  maxCharsPerResult: 500,
  autoSearch: true,
  timeoutMs: 3000,
  requireConfirm: false,
};

/** Patterns that indicate sensitive data – never store these. */
const SENSITIVE_PATTERNS: RegExp[] = [
  /api[_-]?key/i,
  /(sk|pk)_[a-zA-Z0-9]{10,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /xox[baprs]-[a-zA-Z0-9-]{10,}/,
  /(password|passwd|pwd|secret|token)[\s:=]+['"]?[a-zA-Z0-9!@#$%^&*()_+]{8,}/i,
  /refresh.?token/i,
  /access.?token/i,
  /bearer\s+[a-zA-Z0-9._-]+/i,
  /\.env/i,
  /(?:\d{6}[-\s]?\d{7}|[0-9]{13})/, // 주민번호 패턴
];

// ─── Memory Store ────────────────────────────────────────────────────────────

class MemoryStore {
  private filePath: string;
  private memories: MemoryRecord[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /** Load memories from JSONL file. Creates dir/file if missing. */
  async load(): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "", "utf-8");
      this.memories = [];
      return;
    }
    const lines = fs.readFileSync(this.filePath, "utf-8").split("\n").filter(Boolean);
    this.memories = lines.map((line) => JSON.parse(line) as MemoryRecord);
  }

  /** Save all memories to JSONL */
  private async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const lines = this.memories.map((m) => JSON.stringify(m)).join("\n") + "\n";
    fs.writeFileSync(this.filePath, lines, "utf-8");
  }

  /** Add a new memory */
  async add(text: string, tags: string[], source: string): Promise<MemoryRecord> {
    const now = new Date().toISOString();
    const mem: MemoryRecord = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      tags,
      source,
      createdAt: now,
      updatedAt: now,
    };
    this.memories.push(mem);
    await this.save();
    return mem;
  }

  /** Delete a memory by ID */
  async delete(id: string): Promise<boolean> {
    const idx = this.memories.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    this.memories.splice(idx, 1);
    await this.save();
    return true;
  }

  /** Search memories by keyword overlap scoring */
  search(query: string, topK: number = 5): MemoryRecord[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scored = this.memories.map((mem) => {
      const memTokens = this.tokenize(mem.text);
      const tagTokens = mem.tags.flatMap((t) => this.tokenize(t));
      const allTokens = new Set([...memTokens, ...tagTokens]);

      let matches = 0;
      for (const qt of queryTokens) {
        // Direct match
        if (allTokens.has(qt)) {
          matches += 2;
          continue;
        }
        // Partial match (prefix/substring)
        for (const mt of allTokens) {
          if (mt.includes(qt) || qt.includes(mt)) {
            matches += 1;
            break;
          }
        }
      }

      const score = allTokens.size > 0 ? matches / (queryTokens.length * 2) : 0;
      return { mem, score: Math.min(score, 1) };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.mem);
  }

  /** Get all memories (newest first) */
  list(limit: number = 20): MemoryRecord[] {
    return [...this.memories].reverse().slice(0, limit);
  }

  /** Get count */
  count(): number {
    return this.memories.length;
  }

  /** Simple tokenizer: lowercase, split on non-alphanumeric, filter short */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-zA-Z0-9가-힣_]+/)
      .filter((t) => t.length >= 2);
  }
}

// ─── Sensitive data check ────────────────────────────────────────────────────

function containsSensitiveData(text: string): boolean {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function shouldCloseMemoryView(data: string): boolean {
  return (
    matchesKey(data, "escape") ||
    matchesKey(data, "enter") ||
    matchesKey(data, "ctrl+c") ||
    data === "\x1b" ||
    data.toLowerCase() === "q"
  );
}

function createClosableTextComponent(content: string, done: () => void) {
  const text = new Text(content, 0, 0);

  return {
    render: (width: number) => text.render(width),
    invalidate: () => text.invalidate(),
    handleInput: (data: string) => {
      if (shouldCloseMemoryView(data)) {
        done();
      }
    },
  };
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── State ──────────────────────────────────────────────────────────────

  let config: MemoryConfig = { ...DEFAULT_CONFIG };
  let projectStore: MemoryStore | null = null;
  let globalStore: MemoryStore | null = null;
  let currentCwd: string = "";

  // ── Helpers ────────────────────────────────────────────────────────────

  function getMemoryFilePath(baseDir: string): string {
    return path.join(baseDir, ".pi", "memory", "memories.jsonl");
  }

  function getGlobalMemoryPath(): string {
    const piDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
    return path.join(piDir, "memory", "memories.jsonl");
  }

  async function initStores(cwd: string): Promise<void> {
    currentCwd = cwd;

    // Global store
    const globalPath = getGlobalMemoryPath();
    globalStore = new MemoryStore(globalPath);
    await globalStore.load();

    // Project store (if in a project with .pi)
    const projectPath = getMemoryFilePath(cwd);
    if (fs.existsSync(path.join(cwd, ".pi"))) {
      projectStore = new MemoryStore(projectPath);
      await projectStore.load();
    } else {
      projectStore = null;
    }
  }

  /** Search across stores: project first, then global */
  function searchMemories(query: string): MemoryRecord[] {
    const results: MemoryRecord[] = [];
    const seen = new Set<string>();

    // Project memories take priority
    if (projectStore) {
      for (const mem of projectStore.search(query, config.topK)) {
        results.push(mem);
        seen.add(mem.id);
      }
    }

    // Global memories (only if we haven't hit topK)
    if (globalStore && results.length < config.topK) {
      const remaining = config.topK - results.length;
      for (const mem of globalStore.search(query, remaining)) {
        if (!seen.has(mem.id)) {
          results.push(mem);
          seen.add(mem.id);
        }
      }
    }

    return results;
  }

  /** Add memory to appropriate store */
  async function addMemory(
    text: string,
    tags: string[],
    source: string,
  ): Promise<{ memory: MemoryRecord | null; error?: string }> {
    if (containsSensitiveData(text)) {
      return { memory: null, error: "Blocked: memory contains sensitive data (API keys, tokens, passwords, etc.)" };
    }

    // Prefer project store if available
    const store = projectStore || globalStore;
    if (!store) {
      return { memory: null, error: "Memory store not initialized" };
    }

    const memory = await store.add(text, tags, source);
    return { memory };
  }

  // ── Load config from settings ─────────────────────────────────────────

  function loadConfig(settings?: Record<string, unknown>): MemoryConfig {
    const memorySettings = (settings?.memory ?? {}) as Record<string, unknown>;
    return {
      topK: (memorySettings.topK as number) ?? DEFAULT_CONFIG.topK,
      maxCharsPerResult: (memorySettings.maxCharsPerResult as number) ?? DEFAULT_CONFIG.maxCharsPerResult,
      autoSearch: (memorySettings.autoSearch as boolean) ?? DEFAULT_CONFIG.autoSearch,
      timeoutMs: (memorySettings.timeoutMs as number) ?? DEFAULT_CONFIG.timeoutMs,
      requireConfirm: (memorySettings.requireConfirm as boolean) ?? DEFAULT_CONFIG.requireConfirm,
      storagePath: memorySettings.storagePath as string | undefined,
    };
  }

  // ── Events ─────────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    await initStores(ctx.cwd);
    const count = (projectStore?.count() ?? 0) + (globalStore?.count() ?? 0);
    ctx.ui.notify(`🧠 AgentMemory loaded (${count} memories)`, "info");
  });

  pi.on("session_shutdown", async () => {
    projectStore = null;
    globalStore = null;
  });

  // ── Tool: memory_search ────────────────────────────────────────────────

  pi.registerTool({
    name: "memory_search",
    label: "Memory Search",
    description: "Search persistent memories from previous sessions. Use this to recall user preferences, project decisions, past instructions, and other cross-session context.",
    promptSnippet: "Search and retrieve memories from previous sessions",
    promptGuidelines: [
      "Use memory_search at the start of a session or when you need context from past conversations.",
      "Be specific in your query — use key terms the memory was stored with.",
      "If the user references something from \"before\" or \"last time\", search memory first.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query to find relevant memories" }),
      limit: Type.Optional(Type.Number({ description: "Maximum results (default: 5)" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const limit = params.limit ?? config.topK;
      const results = searchMemories(params.query);

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: "No relevant memories found." }],
          details: { results: [], query: params.query },
        };
      }

      let text = `Found ${results.length} relevant memory/memories:\n\n`;
      for (const mem of results) {
        const tags = mem.tags.length > 0 ? ` [${mem.tags.join(", ")}]` : "";
        text += `[${mem.id}]${tags}\n${mem.text}\n\n`;
      }

      return {
        content: [{ type: "text", text: text.trim() }],
        details: { results: results.slice(0, limit), query: params.query },
      };
    },

    renderCall(args, theme, _context) {
      return new Text(
        theme.fg("toolTitle", theme.bold("memory_search ")) +
          theme.fg("muted", `"${args.query}"`) +
          (args.limit ? ` ${theme.fg("dim", `(limit: ${args.limit})`)}` : ""),
        0,
        0,
      );
    },

    renderResult(result, { expanded }, theme, _context) {
      const details = result.details as { results?: MemoryRecord[] } | undefined;
      if (!details?.results || details.results.length === 0) {
        return new Text(theme.fg("dim", "No memories found"), 0, 0);
      }
      let text = theme.fg("success", `✓ ${details.results.length} memory/memories`);
      if (expanded) {
        for (const mem of details.results) {
          text += `\n  ${theme.fg("accent", `[${mem.id}]`)} ${theme.fg("muted", mem.text.slice(0, 80))}`;
        }
      }
      return new Text(text, 0, 0);
    },
  });

  // ── Tool: memory_add ───────────────────────────────────────────────────

  pi.registerTool({
    name: "memory_add",
    label: "Memory Add",
    description: "Store a new persistent memory. Use this to remember user preferences, important decisions, project rules, or anything worth recalling across sessions.",
    promptSnippet: "Store new memories for cross-session recall",
    promptGuidelines: [
      "Use memory_add when the user explicitly asks you to remember something.",
      "Use memory_add when you learn a durable user preference (e.g., preferred language, coding style).",
      "Use memory_add to record important project decisions that should outlive the current session.",
      "Do NOT store secrets, passwords, API keys, or other sensitive data.",
      "Add relevant tags to make the memory searchable — include the project name, topic, and type.",
    ],
    parameters: Type.Object({
      text: Type.String({ description: "The memory content to store" }),
      tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for categorization (e.g., ['preference', 'project-x'])" })),
      source: Type.Optional(StringEnum(["user", "agent", "decision"] as const)),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      // Check for sensitive data
      const tags = params.tags ?? [];
      const source = params.source ?? "agent";

      // If requireConfirm, ask the user
      if (config.requireConfirm && ctx.hasUI) {
        const confirmed = await ctx.ui.confirm(
          "Save to Memory?",
          `Save this to persistent memory?\n\n${params.text.slice(0, 200)}${params.text.length > 200 ? "..." : ""}`,
        );
        if (!confirmed) {
          return {
            content: [{ type: "text", text: "Memory save cancelled by user." }],
            details: { saved: false, reason: "cancelled" },
          };
        }
      }

      const result = await addMemory(params.text, tags, source);
      if (result.error) {
        throw new Error(result.error);
      }

      const mem = result.memory!;
      return {
        content: [{ type: "text", text: `Memory saved [${mem.id}]` }],
        details: { saved: true, memory: mem },
      };
    },

    renderCall(args, theme, _context) {
      const preview = args.text.length > 60 ? args.text.slice(0, 60) + "…" : args.text;
      return new Text(
        theme.fg("toolTitle", theme.bold("memory_add ")) + theme.fg("muted", preview),
        0,
        0,
      );
    },

    renderResult(result, theme, _context) {
      const details = result.details as { saved?: boolean; memory?: MemoryRecord } | undefined;
      if (details?.saved && details.memory) {
        return new Text(
          theme.fg("success", "✓ Saved ") + theme.fg("accent", `[${details.memory.id}]`),
          0,
          0,
        );
      }
      return new Text(theme.fg("error", "✗ Failed to save"), 0, 0);
    },
  });

  // ── Tool: memory_list ──────────────────────────────────────────────────

  pi.registerTool({
    name: "memory_list",
    label: "Memory List",
    description: "List recently stored memories. Use this to get an overview of what's been remembered.",
    promptSnippet: "List recently stored memories",
    parameters: Type.Object({
      limit: Type.Optional(Type.Number({ description: "Maximum memories to list (default: 10)" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const limit = params.limit ?? 10;
      const all: MemoryRecord[] = [];
      if (projectStore) all.push(...projectStore.list(limit));
      if (globalStore) all.push(...globalStore.list(limit));
      // Deduplicate by id
      const seen = new Set<string>();
      const unique = all.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }).slice(0, limit);

      if (unique.length === 0) {
        return {
          content: [{ type: "text", text: "No memories stored yet." }],
          details: { memories: [] },
        };
      }

      let text = `Recent memories (${unique.length}):\n\n`;
      for (const mem of unique) {
        const tags = mem.tags.length > 0 ? ` [${mem.tags.join(", ")}]` : "";
        text += `[${mem.id}]${tags} (${mem.createdAt.slice(0, 10)})\n${mem.text.slice(0, 200)}\n\n`;
      }

      return {
        content: [{ type: "text", text: text.trim() }],
        details: { memories: unique },
      };
    },
  });

  // ── Tool: memory_delete ────────────────────────────────────────────────

  pi.registerTool({
    name: "memory_delete",
    label: "Memory Delete",
    description: "Delete a memory by its ID. Use this to remove outdated or incorrect memories.",
    parameters: Type.Object({
      id: Type.String({ description: "The memory ID to delete (e.g., mem_1234567890_abc123)" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      // Try project store first, then global
      let deleted = false;
      if (projectStore) {
        deleted = await projectStore.delete(params.id);
      }
      if (!deleted && globalStore) {
        deleted = await globalStore.delete(params.id);
      }

      if (!deleted) {
        return {
          content: [{ type: "text", text: `Memory [${params.id}] not found.` }],
          details: { deleted: false },
        };
      }

      return {
        content: [{ type: "text", text: `Memory [${params.id}] deleted.` }],
        details: { deleted: true, id: params.id },
      };
    },
  });

  // ── Auto context injection ─────────────────────────────────────────────

  pi.on("before_agent_start", async (event) => {
    if (!config.autoSearch) return;

    const query = event.prompt;
    if (!query || query.trim().length < 5) return;

    const results = searchMemories(query);
    if (results.length === 0) return;

    let memoryBlock = "\n\n## Retrieved Memories\n\n";
    memoryBlock += "The following memories from previous sessions may be relevant. ";
    memoryBlock += "Treat them as helpful context. If they conflict with explicit instructions or the user's current request, follow the current instructions.\n\n";

    for (const mem of results) {
      const tags = mem.tags.length > 0 ? ` [${mem.tags.join(", ")}]` : "";
      const text = mem.text.length > config.maxCharsPerResult
        ? mem.text.slice(0, config.maxCharsPerResult) + "…"
        : mem.text;
      memoryBlock += `<memory id="${mem.id}"${tags}>\n${text}\n</memory>\n\n`;
    }

    return {
      systemPrompt: event.systemPrompt + memoryBlock,
    };
  });

  // ── Command: /memory ───────────────────────────────────────────────────

  pi.registerCommand("memory", {
    description: "Manage AgentMemory: search, add, list, delete, status",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/memory requires interactive mode", "error");
        return;
      }

      // Parse subcommand
      const trimmed = (args ?? "").trim();
      const spaceIdx = trimmed.indexOf(" ");
      const subcmd = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx).toLowerCase() : trimmed.toLowerCase();
      const rest = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1).trim() : "";

      switch (subcmd) {
        case "search": {
          if (!rest) {
            ctx.ui.notify("Usage: /memory search <query>", "warning");
            return;
          }
          const results = searchMemories(rest);
          if (results.length === 0) {
            ctx.ui.notify("No memories found.", "info");
            return;
          }
          await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
            const lines: string[] = [
              "",
              theme.fg("accent", theme.bold(` Search: "${rest}" (${results.length} results) `)),
              "",
            ];
            for (const mem of results) {
              const tags = mem.tags.length > 0 ? theme.fg("dim", ` [${mem.tags.join(", ")}]`) : "";
              lines.push(`  ${theme.fg("accent", `[${mem.id}]`)}${tags}`);
              lines.push(`  ${theme.fg("text", mem.text)}`);
              lines.push(`  ${theme.fg("dim", mem.createdAt.slice(0, 10))}`);
              lines.push("");
            }
            lines.push(theme.fg("dim", " Press Escape, Enter, q, or Ctrl+C to close"));

            return createClosableTextComponent(lines.join("\n"), () => done());
          });
          break;
        }

        case "add": {
          if (!rest) {
            ctx.ui.notify("Usage: /memory add <text>", "warning");
            return;
          }
          if (containsSensitiveData(rest)) {
            ctx.ui.notify("Blocked: memory contains sensitive data", "error");
            return;
          }
          const result = await addMemory(rest, ["manual"], "user");
          if (result.error) {
            ctx.ui.notify(`Error: ${result.error}`, "error");
          } else {
            ctx.ui.notify(`Saved [${result.memory!.id}]`, "success");
          }
          break;
        }

        case "list": {
          const limit = rest ? parseInt(rest, 10) || 10 : 10;
          const all: MemoryRecord[] = [];
          if (projectStore) all.push(...projectStore.list(limit));
          if (globalStore) all.push(...globalStore.list(limit));
          const seen = new Set<string>();
          const unique = all.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          }).slice(0, limit);

          if (unique.length === 0) {
            ctx.ui.notify("No memories stored yet.", "info");
            return;
          }

          await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
            const lines: string[] = [
              "",
              theme.fg("accent", theme.bold(` Memories (${unique.length}) `)),
              "",
            ];
            for (const mem of unique) {
              const tags = mem.tags.length > 0 ? theme.fg("dim", ` [${mem.tags.join(", ")}]`) : "";
              lines.push(`  ${theme.fg("accent", `[${mem.id}]`)}${tags}`);
              lines.push(`  ${theme.fg("text", mem.text.slice(0, 120))}`);
              lines.push(`  ${theme.fg("dim", mem.createdAt.slice(0, 10))}`);
              lines.push("");
            }
            lines.push(theme.fg("dim", " Press Escape, Enter, q, or Ctrl+C to close"));

            return createClosableTextComponent(lines.join("\n"), () => done());
          });
          break;
        }

        case "delete": {
          if (!rest) {
            ctx.ui.notify("Usage: /memory delete <id>", "warning");
            return;
          }
          let deleted = false;
          if (projectStore) deleted = await projectStore.delete(rest);
          if (!deleted && globalStore) deleted = await globalStore.delete(rest);
          if (deleted) {
            ctx.ui.notify(`Memory [${rest}] deleted.`, "success");
          } else {
            ctx.ui.notify(`Memory [${rest}] not found.`, "warning");
          }
          break;
        }

        case "status": {
          const projectCount = projectStore?.count() ?? 0;
          const globalCount = globalStore?.count() ?? 0;
          const storeType = projectStore ? "project" : "global";
          const lines = [
            `🧠 AgentMemory Status`,
            ``,
            `  Store:     ${storeType} (${projectCount + globalCount} total)`,
            `  Auto search: ${config.autoSearch ? "on" : "off"}`,
            `  Top-K:    ${config.topK}`,
            `  Confirm:  ${config.requireConfirm ? "yes" : "no"}`,
          ];
          if (projectStore) {
            lines.push(`  Project:  ${path.dirname(projectStore["filePath"])}`);
          }
          if (globalStore) {
            lines.push(`  Global:   ${path.dirname(globalStore["filePath"])}`);
          }
          ctx.ui.notify(lines.join("\n"), "info");
          break;
        }

        default: {
          ctx.ui.notify(
            "Usage:\n  /memory search <query>\n  /memory add <text>\n  /memory list [limit]\n  /memory delete <id>\n  /memory status",
            "info",
          );
        }
      }
    },
  });
}
