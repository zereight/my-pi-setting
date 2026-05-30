type AgentMode = "plan" | "build" | "review";

type PiLike = {
  appendEntry?: (customType: string, data?: unknown) => void;
  getActiveTools?: () => string[];
  getAllTools?: () => Array<{ name: string }>;
  on: (
    event: string,
    handler: (event: any, ctx: any) => unknown | Promise<unknown>,
  ) => void;
  registerCommand?: (
    name: string,
    definition: {
      description: string;
      handler: (args: string, ctx: any) => unknown | Promise<unknown>;
    },
  ) => void;
  registerShortcut?: (
    shortcut: string,
    definition: {
      description: string;
      handler: (ctx: any) => unknown | Promise<unknown>;
    },
  ) => void;
  setActiveTools?: (names: string[]) => void;
  setModel?: (model: any) => Promise<boolean>;
  setThinkingLevel?: (level: string) => void;
};

const STATE_ENTRY = "agent-mode-state";
const MODEL_CONFIG_VERSION = 6;
const SHORTCUTS = ["ctrl+shift+x", "f2", "ctrl+alt+p"] as const;
const PLAN_TOOLS = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "usage_insights_report",
  "web_search",
  "fetch_content",
  "get_search_content",
  "subagent_status",
];
const REVIEW_TOOLS = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "usage_insights_report",
  "subagent",
  "subagent_status",
  "web_search",
  "fetch_content",
  "get_search_content",
];
const BUILD_TOOLS = [
  "read",
  "bash",
  "edit",
  "write",
  "usage_insights_report",
  "subagent",
  "subagent_status",
  "web_search",
  "fetch_content",
  "get_search_content",
];
import {
  classifyBashCommand,
  type BashSafetyResult,
} from "./bash-safety";

const DEFAULT_MODELS: Record<AgentMode, { provider: string; id: string }> = {
  plan: { provider: "cursor", id: "composer-2.5" },
  build: { provider: "cursor", id: "composer-2.5" },
  review: { provider: "cursor", id: "composer-2.5" },
};

type ModelConfig = { provider: string; id: string };

export default function agentMode(pi: PiLike) {
  let mode: AgentMode = "build";
  let previousActiveTools: string[] | undefined;
  // Per-mode model configs (mutable via /mode plan model://... commands)
  const modelConfigs: Record<AgentMode, ModelConfig> = {
    plan: { ...DEFAULT_MODELS.plan },
    build: { ...DEFAULT_MODELS.build },
    review: { ...DEFAULT_MODELS.review },
  };

  const notify = (ctx: any, message: string, level = "info") => {
    if (ctx?.hasUI) ctx.ui?.notify?.(message, level);
  };

  const status = (ctx: any) => {
    if (ctx?.hasUI) ctx.ui?.setStatus?.("agent-mode", `mode: ${mode}`);
  };

  const allToolNames = () =>
    (pi.getAllTools?.() ?? []).map((tool) => tool.name);
  const selectTools = (wanted: readonly string[]) => {
    const available = new Set(allToolNames());
    return wanted.filter((name) => available.has(name));
  };

  const switchModel = async (target: AgentMode, ctx: any): Promise<boolean> => {
    const cfg = modelConfigs[target];
    const model = ctx?.modelRegistry?.find(cfg.provider, cfg.id);
    if (!model) {
      notify(ctx, `Model not found: ${cfg.provider}/${cfg.id}`, "warning");
      return false;
    }
    const ok = await pi.setModel?.(model);
    if (!ok) {
      notify(
        ctx,
        `Failed to switch model (no API key?): ${cfg.provider}/${cfg.id}`,
        "error",
      );
      return false;
    }
    return true;
  };

  const modelLabel = (m: AgentMode) =>
    `${modelConfigs[m].provider}/${modelConfigs[m].id}`;

  const persist = () => {
    pi.appendEntry?.(STATE_ENTRY, {
      mode,
      updatedAt: Date.now(),
      ...(previousActiveTools?.length ? { previousActiveTools } : {}),
      modelConfigVersion: MODEL_CONFIG_VERSION,
      modelConfigs: {
        plan: { ...modelConfigs.plan },
        build: { ...modelConfigs.build },
        review: { ...modelConfigs.review },
      },
    });
  };

  const setMode = async (next: AgentMode, ctx: any) => {
    if (next === mode) {
      status(ctx);
      notify(ctx, `Already in ${next} mode.`);
      return;
    }

    // Switch model first (before tools) so the next prompt is on the right model
    await switchModel(next, ctx);

    if (next === "plan") {
      previousActiveTools = pi.getActiveTools?.();
      mode = "plan";
      const tools = selectTools(PLAN_TOOLS);
      if (tools.length) pi.setActiveTools?.(tools);
      notify(ctx, `Plan mode · model: ${modelLabel("plan")}`);
    } else if (next === "review") {
      previousActiveTools = pi.getActiveTools?.();
      mode = "review";
      const tools = selectTools(REVIEW_TOOLS);
      if (tools.length) pi.setActiveTools?.(tools);
      pi.setThinkingLevel?.("xhigh");
      notify(
        ctx,
        `Review mode · model: ${modelLabel("review")} · thinking: xhigh`,
      );
    } else {
      mode = "build";
      const tools = previousActiveTools?.length
        ? selectTools(previousActiveTools)
        : selectTools(BUILD_TOOLS);
      if (tools.length) pi.setActiveTools?.(tools);
      previousActiveTools = undefined;
      notify(ctx, `Build mode · model: ${modelLabel("build")}`);
    }

    status(ctx);
    persist();
  };

  const toggle = async (ctx: any) => {
    await ctx?.waitForIdle?.();
    setMode(mode === "plan" ? "build" : "plan", ctx);
  };

  pi.registerCommand?.("mode", {
    description:
      "Show or switch agent mode: /mode plan, /mode build, /mode review, /mode toggle, /mode plan/provider/id, /mode build/provider/id, /mode review/provider/id",
    handler: async (args: string, ctx: any) => {
      await ctx?.waitForIdle?.();
      const trimmed = args.trim();
      if (!trimmed || trimmed === "status") {
        status(ctx);
        return notify(
          ctx,
          `Mode: ${mode} · plan: ${modelLabel("plan")} · build: ${modelLabel("build")} · review: ${modelLabel("review")}`,
        );
      }

      // /mode plan provider/id or /mode build provider/id or /mode review provider/id – set per-mode model
      const match = trimmed.match(
        /^(plan|build|review)\s+(?:model:\/\/)?([\w.-]+)\/([\w.-]+)$/i,
      );
      if (match) {
        const targetMode = match[1].toLowerCase() as AgentMode;
        const provider = match[2];
        const id = match[3];
        modelConfigs[targetMode] = { provider, id };
        notify(ctx, `Set ${targetMode} mode model to ${provider}/${id}`);
        persist();
        // Also switch now if already in that mode
        if (mode === targetMode) {
          await switchModel(targetMode, ctx);
        }
        return;
      }

      if (trimmed === "plan" || trimmed === "build" || trimmed === "review")
        return setMode(trimmed as AgentMode, ctx);
      if (trimmed === "toggle")
        return setMode(mode === "plan" ? "build" : "plan", ctx);

      notify(
        ctx,
        "Usage: /mode plan | /mode build | /mode review | /mode toggle | /mode plan provider/id | /mode build provider/id | /mode review provider/id",
        "warning",
      );
    },
  });
  pi.registerCommand?.("plan", {
    description: "Switch to plan mode (read-only analysis and planning)",
    handler: async (_args: string, ctx: any) => {
      await ctx?.waitForIdle?.();
      setMode("plan", ctx);
    },
  });
  pi.registerCommand?.("build", {
    description: "Switch to build mode (normal implementation mode)",
    handler: async (_args: string, ctx: any) => {
      await ctx?.waitForIdle?.();
      setMode("build", ctx);
    },
  });
  pi.registerCommand?.("review", {
    description:
      "Switch to review mode (read-only PR review with high-thinking model)",
    handler: async (_args: string, ctx: any) => {
      await ctx?.waitForIdle?.();
      setMode("review", ctx);
    },
  });
  pi.registerCommand?.("agent-mode-shortcuts", {
    description: "Show agent-mode shortcuts",
    handler: (_args: string, ctx: any) =>
      notify(ctx, `Agent mode shortcuts: ${SHORTCUTS.join(", ")}`),
  });

  for (const shortcut of SHORTCUTS) {
    pi.registerShortcut?.(shortcut, {
      description: "Toggle agent mode between plan and build",
      handler: toggle,
    });
  }

  pi.on("session_start", async (_event: any, ctx: any) => {
    const entries = ctx?.sessionManager?.getEntries?.() ?? [];
    const state = [...entries]
      .reverse()
      .find(
        (entry: any) =>
          entry.type === "custom" && entry.customType === STATE_ENTRY,
      )?.data;
    if (
      state?.mode === "plan" ||
      state?.mode === "build" ||
      state?.mode === "review"
    ) {
      mode = state.mode;
      previousActiveTools = Array.isArray(state.previousActiveTools)
        ? state.previousActiveTools
        : undefined;
    }
    if (state?.modelConfigVersion === MODEL_CONFIG_VERSION) {
      if (state?.modelConfigs?.plan)
        modelConfigs.plan = { ...state.modelConfigs.plan };
      if (state?.modelConfigs?.build)
        modelConfigs.build = { ...state.modelConfigs.build };
      if (state?.modelConfigs?.review)
        modelConfigs.review = { ...state.modelConfigs.review };
    }

    // Switch to persisted model for current mode
    await switchModel(mode, ctx);

    if (mode === "plan") {
      const tools = selectTools(PLAN_TOOLS);
      if (tools.length) pi.setActiveTools?.(tools);
    } else if (mode === "review") {
      const tools = selectTools(REVIEW_TOOLS);
      if (tools.length) pi.setActiveTools?.(tools);
      pi.setThinkingLevel?.("xhigh");
    }
    status(ctx);
  });

  pi.on("before_agent_start", async (event: any, ctx: any) => {
    status(ctx);
    if (mode === "plan") {
      const tools = selectTools(PLAN_TOOLS);
      if (tools.length) pi.setActiveTools?.(tools);
    } else if (mode === "review") {
      const tools = selectTools(REVIEW_TOOLS);
      if (tools.length) pi.setActiveTools?.(tools);
      pi.setThinkingLevel?.("xhigh");
    }
    if (typeof event?.systemPrompt !== "string") return;
    const modePrompt =
      mode === "plan"
        ? "Read-only planning only. Do not modify files. Do not call edit, write, StrReplace, Write, Delete, EditNotebook, cursor_edit, cursor_write. Tell the user to switch to /build before implementation."
        : mode === "review"
          ? "Read-only PR review mode. Focus on correctness, security, regression risk, and edge cases. Do not modify files. Do not call edit, write, StrReplace, Write, Delete, EditNotebook, cursor_edit, cursor_write. Final output in Korean. Use zereight-review mindset: RED team approach, verification discipline, full-diff coverage. If implementation is needed, tell the user to switch to /build."
          : "Implementation/build mode. You may modify files when appropriate.";
    return {
      systemPrompt: `${event.systemPrompt}\n\n[AGENT MODE: ${mode.toUpperCase()} — model: ${modelLabel(mode)}]\n${modePrompt}`,
    };
  });

  pi.on("tool_call", async (event: any) => {
    if (mode === "build") return;

    const blockedTools = [
      "edit",
      "write",
      "StrReplace",
      "Write",
      "Delete",
      "EditNotebook",
      "cursor_edit",
      "cursor_write",
    ];
    const toolName = event?.toolName;
    if (toolName && blockedTools.some(blocked => blocked.toLowerCase() === toolName.toLowerCase())) {
      return {
        block: true,
        reason: `${mode === "plan" ? "Plan" : "Review"} mode blocked ${toolName}. Switch to /build before modifying files.`,
      };
    }

    if (event?.toolName === "bash") {
      const rawCommand = String(event.input?.command ?? "");
      const result = classifyBashCommand(rawCommand, mode);

      if (result === "allowed") return;

      if (result === "compound") {
        return {
          block: true,
          reason: `${mode === "plan" ? "Plan" : "Review"} mode blocked a compound bash command. Switch to /build first.\nCommand: ${rawCommand}`,
        };
      }

      if (result === "write") {
        return {
          block: true,
          reason: `${mode === "plan" ? "Plan" : "Review"} mode blocked a write command. Switch to /build first.\nCommand: ${rawCommand}`,
        };
      }

      return {
        block: true,
        reason: `${mode === "plan" ? "Plan" : "Review"} mode blocked a non-read-only bash command. Switch to /build first.\nCommand: ${rawCommand}`,
      };
    }
  });
}
