import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TaskDetail } from "@klava/contracts";
import type { RuntimeLogger } from "./logging";
import type { SupportedLanguage } from "./operator-language";

type RetrievalHitSource = "memory" | "message" | "terminal" | "tool_call" | "workspace_file" | "journal";

export type RetrievalHit = {
  id: string;
  source: RetrievalHitSource;
  title: string;
  excerpt: string;
  location: string | null;
  score: number;
  createdAt: string;
};

export type RetrievalBundle = {
  query: string;
  generatedAt: string;
  hits: RetrievalHit[];
  usedWorkspace: boolean;
};

type RetrievalOptions = {
  maxHits?: number;
  includeWorkspace?: boolean;
  maxWorkspaceFileHits?: number;
};

type RankedCandidate = RetrievalHit & {
  score: number;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "from",
  "into",
  "about",
  "what",
  "when",
  "where",
  "which",
  "need",
  "want",
  "make",
  "have",
  "your",
  "you",
  "are",
  "как",
  "что",
  "это",
  "для",
  "надо",
  "мне",
  "или",
  "так",
  "все",
  "всё",
  "над",
  "под",
  "без",
  "она",
  "они",
  "его",
  "еще",
  "ещё",
  "тут",
  "там",
  "при",
  "про",
  "если",
  "нужно",
  "сделай",
]);

const workspaceFileCache = new Map<string, { expiresAt: number; files: string[] }>();

function nowIso() {
  return new Date().toISOString();
}

function clip(value: string, maxChars = 420) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  return normalized.length > maxChars ? `${normalized.slice(0, Math.max(1, maxChars - 1))}...` : normalized;
}

function tokenize(value: string) {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}._/-]+/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token)),
  )];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreText(text: string, tokens: string[], exactQuery: string) {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) {
    return 0;
  }

  let score = 0;
  let matched = 0;
  if (exactQuery.length >= 4 && normalized.includes(exactQuery)) {
    score += 9;
  }

  for (const token of tokens) {
    if (!normalized.includes(token)) {
      continue;
    }

    matched += 1;
    score += token.length >= 6 ? 3.4 : token.length >= 4 ? 2.5 : 1.7;
  }

  if (matched > 0) {
    score += matched / Math.max(1, tokens.length);
  }

  if (tokens.length > 1 && matched === tokens.length) {
    score += 5;
  }

  return score;
}

function parseRipgrepLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (!match) {
        return null;
      }

      const file = match[1] ?? "";
      const lineNumber = match[2] ?? "0";
      const text = match[3] ?? "";
      return {
        file,
        line: Number.parseInt(lineNumber, 10),
        text: text.trim(),
      };
    })
    .filter((entry): entry is { file: string; line: number; text: string } => Boolean(entry));
}

function buildWorkspacePattern(tokens: string[], rawQuery: string) {
  const candidateTokens = tokens.filter((token) => token.length >= 3).slice(0, 6);
  if (candidateTokens.length) {
    return candidateTokens.map(escapeRegex).join("|");
  }

  const fallback = rawQuery.trim();
  return fallback.length >= 2 ? escapeRegex(fallback) : null;
}

function runProcess(file: string, args: string[], timeoutMs = 15_000) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const child = spawn(file, args, {
      cwd: process.cwd(),
      windowsHide: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      resolve({
        stdout,
        stderr: `${stderr}\nCommand timed out after ${timeoutMs}ms.`.trim(),
        exitCode: 124,
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        exitCode: 1,
      });
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}

async function listWorkspaceFiles(cwd: string, logger?: RuntimeLogger) {
  const cached = workspaceFileCache.get(cwd);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.files;
  }

  const result = await runProcess(
    "rg",
    [
      "--files",
      cwd,
      "-g",
      "!**/node_modules/**",
      "-g",
      "!**/.git/**",
      "-g",
      "!**/dist/**",
      "-g",
      "!**/release/**",
      "-g",
      "!**/coverage/**",
    ],
    12_000,
  );

  if (result.exitCode !== 0) {
    await logger?.log(`Semantic retrieval could not enumerate workspace files with rg. ${result.stderr || result.stdout}`.trim());
    return [];
  }

  const files = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => path.isAbsolute(file) ? file : path.resolve(cwd, file));
  workspaceFileCache.set(cwd, {
    files,
    expiresAt: Date.now() + 10_000,
  });
  return files;
}

async function selectWorkspaceHits(
  query: string,
  tokens: string[],
  cwd: string,
  maxHits: number,
  logger?: RuntimeLogger,
) {
  const exactQuery = query.trim().toLowerCase();
  const files = await listWorkspaceFiles(cwd, logger);
  const rankedPathHits = files
    .map((file) => {
      const relative = path.relative(cwd, file) || path.basename(file);
      const score = scoreText(relative, tokens, exactQuery) + (relative.toLowerCase().includes(exactQuery) ? 4 : 0);
      return { file, relative, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(2, maxHits));

  const pathHits: RankedCandidate[] = [];
  for (const entry of rankedPathHits) {
    try {
      const raw = await readFile(entry.file, "utf8");
      if (raw.includes("\u0000")) {
        continue;
      }

      const excerpt = clip(raw.split(/\r?\n/).slice(0, 24).join("\n"), 420);
      pathHits.push({
        id: crypto.randomUUID(),
        source: "workspace_file",
        title: `Workspace file ${entry.relative}`,
        excerpt,
        location: entry.file,
        createdAt: nowIso(),
        score: Number((entry.score + 0.6).toFixed(2)),
      });
    } catch {
      // Ignore unreadable files inside retrieval.
    }
  }

  const pattern = buildWorkspacePattern(tokens, query);
  if (!pattern) {
    return pathHits;
  }

  const result = await runProcess(
    "rg",
    [
      "-n",
      "--no-heading",
      "--smart-case",
      "--max-count",
      "80",
      "-g",
      "!**/node_modules/**",
      "-g",
      "!**/.git/**",
      "-g",
      "!**/dist/**",
      "-g",
      "!**/release/**",
      "-g",
      "!**/coverage/**",
      pattern,
      cwd,
    ],
    15_000,
  );

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    await logger?.log(`Semantic retrieval workspace search failed. ${result.stderr || result.stdout}`.trim());
    return pathHits;
  }

  const grouped = new Map<string, { lines: string[]; score: number; firstLine: number }>();
  for (const match of parseRipgrepLines(result.stdout)) {
    const relative = path.relative(cwd, match.file) || match.file;
    const lineScore = scoreText(`${relative} ${match.text}`, tokens, exactQuery);
    if (lineScore <= 0) {
      continue;
    }

    const existing = grouped.get(match.file) ?? {
      lines: [],
      score: 0,
      firstLine: match.line,
    };
    existing.lines.push(`${match.line}: ${match.text}`);
    existing.score = Math.max(existing.score, lineScore + 1.4);
    existing.firstLine = Math.min(existing.firstLine, match.line);
    grouped.set(match.file, existing);
  }

  const contentHits = [...grouped.entries()]
    .map(([file, entry]) => {
      const relative = path.relative(cwd, file) || file;
      return {
        id: crypto.randomUUID(),
        source: "workspace_file" as const,
        title: `Workspace search hit in ${relative}`,
        excerpt: clip(entry.lines.slice(0, 4).join("\n"), 420),
        location: `${file}:${entry.firstLine}`,
        createdAt: nowIso(),
        score: Number(entry.score.toFixed(2)),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, maxHits);

  const merged = new Map<string, RankedCandidate>();
  for (const hit of [...contentHits, ...pathHits]) {
    const key = `${hit.source}:${hit.location ?? hit.title}`;
    const existing = merged.get(key);
    if (!existing || hit.score > existing.score) {
      merged.set(key, hit);
    }
  }

  return [...merged.values()].sort((left, right) => right.score - left.score).slice(0, maxHits);
}

function makeCandidate(
  source: RetrievalHitSource,
  title: string,
  excerpt: string,
  location: string | null,
  createdAt: string,
  score: number,
): RankedCandidate | null {
  const clippedExcerpt = clip(excerpt);
  const clippedTitle = clip(title, 160);
  if (!clippedTitle || !clippedExcerpt || score <= 0) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    source,
    title: clippedTitle,
    excerpt: clippedExcerpt,
    location,
    createdAt,
    score: Number(score.toFixed(2)),
  };
}

function collectStructuredHits(task: TaskDetail, query: string, tokens: string[]) {
  const exactQuery = query.trim().toLowerCase();
  const hits: RankedCandidate[] = [];

  for (const entry of task.memory.entries) {
    const score = 6.5 + scoreText(entry.content, tokens, exactQuery) + entry.score / 10;
    const candidate = makeCandidate(
      "memory",
      `Memory ${entry.kind}`,
      entry.content,
      entry.sourceMessageId ?? entry.sourceRunId ?? null,
      entry.updatedAt,
      score,
    );
    if (candidate) {
      hits.push(candidate);
    }
  }

  const visibleMessages = task.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => message.meta.presentation !== "status" && message.meta.presentation !== "artifact")
    .slice(-14);
  visibleMessages.forEach((message, index) => {
    const recencyBoost = 1 + index / Math.max(1, visibleMessages.length);
    const score = scoreText(message.content, tokens, exactQuery) + recencyBoost;
    const candidate = makeCandidate(
      "message",
      message.role === "user" ? "User message" : "Assistant message",
      message.content,
      null,
      message.createdAt,
      score,
    );
    if (candidate) {
      hits.push(candidate);
    }
  });

  task.terminalEntries.slice(-10).forEach((entry, index, items) => {
    const recencyBoost = 1 + index / Math.max(1, items.length);
    const score = scoreText(`${entry.command}\n${entry.output}`, tokens, exactQuery) + 2 + recencyBoost;
    const candidate = makeCandidate(
      "terminal",
      `Terminal ${entry.status}`,
      `${entry.command}\n${entry.output}`,
      entry.id,
      entry.createdAt,
      score,
    );
    if (candidate) {
      hits.push(candidate);
    }
  });

  task.agentRuns.slice(0, 5).forEach((run, runIndex) => {
    run.toolCalls.slice(0, 8).forEach((toolCall, toolIndex) => {
      const recencyBoost = 1 + (runIndex + toolIndex) / 10;
      const score = scoreText(
        [toolCall.summary, toolCall.input ?? "", toolCall.command ?? "", toolCall.outputPreview ?? ""].join("\n"),
        tokens,
        exactQuery,
      ) + 2.8 + recencyBoost;
      const candidate = makeCandidate(
        "tool_call",
        `${toolCall.kind} ${toolCall.status}`,
        [toolCall.summary, toolCall.outputPreview ?? "", toolCall.command ?? ""].filter(Boolean).join("\n"),
        toolCall.terminalEntryId ?? toolCall.approvalId ?? run.id,
        toolCall.finishedAt ?? toolCall.startedAt,
        score,
      );
      if (candidate) {
        hits.push(candidate);
      }
    });
  });

  task.journal.events.slice(-14).forEach((event, index, items) => {
    const recencyBoost = 1 + index / Math.max(1, items.length);
    const score = scoreText(`${event.title}\n${event.detail ?? ""}`, tokens, exactQuery) + 2.2 + recencyBoost;
    const candidate = makeCandidate(
      "journal",
      event.title,
      event.detail ?? event.title,
      event.agentRunId ?? event.operationId ?? event.approvalId ?? event.terminalEntryId ?? null,
      event.createdAt,
      score,
    );
    if (candidate) {
      hits.push(candidate);
    }
  });

  return hits;
}

export async function retrieveTaskContext(
  task: TaskDetail,
  query: string,
  cwd: string,
  logger?: RuntimeLogger,
  options: RetrievalOptions = {},
): Promise<RetrievalBundle> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      query,
      generatedAt: nowIso(),
      hits: [],
      usedWorkspace: false,
    };
  }

  const tokens = tokenize(normalizedQuery);
  const hits = collectStructuredHits(task, normalizedQuery, tokens);
  let usedWorkspace = false;

  if (options.includeWorkspace !== false) {
    const workspaceHits = await selectWorkspaceHits(
      normalizedQuery,
      tokens,
      cwd,
      options.maxWorkspaceFileHits ?? 4,
      logger,
    );
    if (workspaceHits.length) {
      usedWorkspace = true;
      hits.push(...workspaceHits);
    }
  }

  const maxHits = options.maxHits ?? 6;
  const deduped = new Map<string, RankedCandidate>();
  for (const hit of hits) {
    const key = `${hit.source}:${hit.title}:${hit.location ?? ""}:${hit.excerpt}`;
    const existing = deduped.get(key);
    if (!existing || hit.score > existing.score) {
      deduped.set(key, hit);
    }
  }

  const ranked = [...deduped.values()]
    .sort((left, right) => right.score - left.score || right.createdAt.localeCompare(left.createdAt))
    .slice(0, Math.max(1, maxHits));

  await logger?.log(
    `Semantic retrieval produced ${ranked.length} hit(s) for query="${clip(normalizedQuery, 120)}" on task ${task.id}.${usedWorkspace ? " Workspace search included." : ""}`,
  );

  return {
    query: normalizedQuery,
    generatedAt: nowIso(),
    hits: ranked,
    usedWorkspace,
  };
}

function sourceLabel(source: RetrievalHitSource, language: SupportedLanguage) {
  if (language === "ru") {
    switch (source) {
      case "memory":
        return "Память";
      case "message":
        return "Диалог";
      case "terminal":
        return "Терминал";
      case "tool_call":
        return "Tool output";
      case "workspace_file":
        return "Workspace";
      case "journal":
      default:
        return "Журнал";
    }
  }

  switch (source) {
    case "memory":
      return "Memory";
    case "message":
      return "Dialog";
    case "terminal":
      return "Terminal";
    case "tool_call":
      return "Tool output";
    case "workspace_file":
      return "Workspace";
    case "journal":
    default:
      return "Journal";
  }
}

export function buildRetrievedContextPrompt(bundle: RetrievalBundle, language: SupportedLanguage) {
  if (!bundle.hits.length) {
    return null;
  }

  const lines: string[] = [
    language === "ru"
      ? `Семантически отобранный релевантный контекст по запросу: ${bundle.query}`
      : `Semantically ranked relevant context for the current request: ${bundle.query}`,
  ];

  for (const hit of bundle.hits) {
    const prefix = `[${sourceLabel(hit.source, language)} | score ${hit.score.toFixed(2)}]`;
    const location = hit.location ? ` (${hit.location})` : "";
    lines.push("", `${prefix} ${hit.title}${location}`, hit.excerpt);
  }

  return lines.join("\n");
}
