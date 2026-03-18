import type { AgentToolRequest } from "./agent/types";
import type { SupportedLanguage } from "./language";

function inLanguage(language: SupportedLanguage, english: string, russian: string) {
  return language === "ru" ? russian : english;
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function clip(value: string, maxLength = 96) {
  const normalized = normalizeWhitespace(value);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function backtick(value: string) {
  return `\`${value}\``;
}

function extractWingetPackageId(command: string) {
  const explicitId = command.match(/--id\s+([^\s]+)/i)?.[1]?.trim();
  if (explicitId) {
    return explicitId;
  }

  const fallback = command.match(/\bwinget\s+(?:install|upgrade|uninstall)\s+([^\s-][^\s]*)/i)?.[1]?.trim();
  return fallback || null;
}

function extractFilesystemTarget(command: string) {
  const quoted = command.match(/["']([^"']+\.[A-Za-z0-9._-]+)["']/)?.[1]?.trim();
  if (quoted) {
    return quoted;
  }

  const plain = command.match(/\s([A-Za-z]:\\[^\s]+|\.?[\\/][^\s]+|\S+\.[A-Za-z0-9._-]+)(?:\s|$)/)?.[1]?.trim();
  return plain || null;
}

export function describeTerminalAction(command: string, language: SupportedLanguage) {
  const normalized = normalizeWhitespace(command);
  const lowered = normalized.toLowerCase();
  const wingetId = extractWingetPackageId(normalized);

  if (/\bwinget\s+install\b/i.test(lowered)) {
    return wingetId
      ? inLanguage(language, `Installing ${backtick(wingetId)} via winget.`, `Устанавливаю ${backtick(wingetId)} через winget.`)
      : inLanguage(language, "Installing a package via winget.", "Устанавливаю пакет через winget.");
  }

  if (/\bwinget\s+upgrade\b/i.test(lowered)) {
    return wingetId
      ? inLanguage(language, `Updating ${backtick(wingetId)} via winget.`, `Обновляю ${backtick(wingetId)} через winget.`)
      : inLanguage(language, "Updating a package via winget.", "Обновляю пакет через winget.");
  }

  if (/\bwinget\s+uninstall\b/i.test(lowered)) {
    return wingetId
      ? inLanguage(language, `Removing ${backtick(wingetId)} via winget.`, `Удаляю ${backtick(wingetId)} через winget.`)
      : inLanguage(language, "Removing a package via winget.", "Удаляю пакет через winget.");
  }

  if (/\b(choco|chocolatey)\s+install\b/i.test(lowered)) {
    return inLanguage(language, "Installing a package via Chocolatey.", "Устанавливаю пакет через Chocolatey.");
  }

  if (/\b(?:npm|pnpm|yarn)\s+(?:install|add)\b/i.test(lowered)) {
    return inLanguage(language, "Installing project dependencies.", "Устанавливаю зависимости проекта.");
  }

  if (/\b(?:npm|pnpm|yarn)\s+(?:test|run test)\b/i.test(lowered) || /\b(?:vitest|jest|pytest|playwright)\b/i.test(lowered)) {
    return inLanguage(language, "Running test checks.", "Запускаю проверку тестами.");
  }

  if (/\bgit\s+status\b/i.test(lowered)) {
    return inLanguage(language, "Checking the git status.", "Проверяю состояние git.");
  }

  if (/\bgit\s+diff\b/i.test(lowered)) {
    return inLanguage(language, "Inspecting git changes.", "Смотрю изменения в git.");
  }

  if (/\bgit\s+(?:pull|fetch)\b/i.test(lowered)) {
    return inLanguage(language, "Pulling the latest git changes.", "Подтягиваю последние изменения из git.");
  }

  if (/\bgit\s+clone\b/i.test(lowered)) {
    return inLanguage(language, "Cloning a repository.", "Клонирую репозиторий.");
  }

  if (/\b(?:rg|ripgrep)\b/i.test(lowered) || /\bselect-string\b/i.test(lowered) || /\bgrep\b/i.test(lowered)) {
    return inLanguage(language, "Searching through files.", "Ищу по файлам.");
  }

  if (/\bget-childitem\b/i.test(lowered) || /\bls\b/i.test(lowered) || /\bdir\b/i.test(lowered)) {
    const target = extractFilesystemTarget(normalized);
    return target
      ? inLanguage(language, `Listing files in ${backtick(target)}.`, `Просматриваю файлы в ${backtick(target)}.`)
      : inLanguage(language, "Inspecting files in the workspace.", "Просматриваю файлы в рабочей папке.");
  }

  if (/\bnode\b/i.test(lowered)) {
    return inLanguage(language, "Running a local Node.js command.", "Запускаю локальную команду Node.js.");
  }

  if (/\bpython(?:3)?\b/i.test(lowered)) {
    return inLanguage(language, "Running a local Python command.", "Запускаю локальную команду Python.");
  }

  if (/\bstart-process\b/i.test(lowered) || /\bstart\s+/i.test(lowered)) {
    return inLanguage(language, "Launching a local application.", "Запускаю локальное приложение.");
  }

  return inLanguage(language, "Running a local command.", "Выполняю локальную команду.");
}

export function buildAgentPlanningStatus(language: SupportedLanguage) {
  return inLanguage(language, "Building the plan and choosing the next step.", "Составляю план и выбираю следующий шаг.");
}

export function buildAgentToolStartStatus(tool: AgentToolRequest, language: SupportedLanguage) {
  switch (tool.name) {
    case "computer.inspect":
      return inLanguage(
        language,
        `Inspecting the local computer: ${clip(tool.instruction, 140)}`,
        `Проверяю локальный компьютер: ${clip(tool.instruction, 140)}`,
      );
    case "filesystem.read":
      return inLanguage(language, `Reading ${backtick(tool.path)}.`, `Читаю файл ${backtick(tool.path)}.`);
    case "filesystem.search":
      return tool.path?.trim()
        ? inLanguage(
            language,
            `Searching for ${backtick(tool.pattern)} in ${backtick(tool.path)}.`,
            `Ищу ${backtick(tool.pattern)} в ${backtick(tool.path)}.`,
          )
        : inLanguage(
            language,
            `Searching the workspace for ${backtick(tool.pattern)}.`,
            `Ищу ${backtick(tool.pattern)} по рабочей папке.`,
          );
    case "context.retrieve":
      return tool.scope === "history"
        ? inLanguage(
            language,
            `Retrieving relevant task history for ${backtick(tool.query)}.`,
            `Подбираю релевантную историю задачи по запросу ${backtick(tool.query)}.`,
          )
        : inLanguage(
            language,
            `Retrieving relevant context for ${backtick(tool.query)}.`,
            `Подбираю релевантный контекст по запросу ${backtick(tool.query)}.`,
          );
    case "shell.command":
    default:
      return describeTerminalAction(tool.command, language);
  }
}

export function buildAwaitingApprovalStatus(command: string, impact: string, language: SupportedLanguage) {
  return inLanguage(
    language,
    `${describeTerminalAction(command, language)} Waiting for approval because ${impact}.`,
    `${describeTerminalAction(command, language)} Нужна проверка и подтверждение, потому что ${impact}.`,
  );
}

export function buildBlockedCommandStatus(reason: string, language: SupportedLanguage) {
  return inLanguage(
    language,
    `I blocked that command: ${reason}.`,
    `Я заблокировала эту команду: ${reason}.`,
  );
}

export function buildCommandFinishedStatus(command: string, succeeded: boolean, language: SupportedLanguage) {
  return succeeded
    ? inLanguage(
        language,
        `${describeTerminalAction(command, language)} Done. The full output is available in Terminal.`,
        `${describeTerminalAction(command, language)} Готово. Полный вывод сохранила во вкладке Terminal.`,
      )
    : inLanguage(
        language,
        `${describeTerminalAction(command, language)} The command failed. The full output is available in Terminal.`,
        `${describeTerminalAction(command, language)} Команда завершилась с ошибкой. Полный вывод сохранила во вкладке Terminal.`,
      );
}

export function buildApprovalResolvedStatus(command: string, approved: boolean, language: SupportedLanguage) {
  return approved
    ? inLanguage(
        language,
        `Approval granted. ${describeTerminalAction(command, language)}`,
        `Подтверждение получено. ${describeTerminalAction(command, language)}`,
      )
    : inLanguage(
        language,
        `Approval rejected. I will not run ${backtick(command)}.`,
        `Подтверждение отклонено. Команду ${backtick(command)} запускать не буду.`,
      );
}
