import type { SupportedLanguage } from "./operator-language";

type OpenClawDialogResolution =
  | {
      kind: "command";
      command: string;
    }
  | {
      kind: "message";
      message: string;
      level: "info" | "warning";
    };

const CHANNEL_ALIASES = new Map<string, string>([
  ["telegram", "telegram"],
  ["телеграм", "telegram"],
  ["tg", "telegram"],
  ["discord", "discord"],
  ["дискорд", "discord"],
  ["slack", "slack"],
  ["слак", "slack"],
  ["whatsapp", "whatsapp"],
  ["ватсап", "whatsapp"],
  ["вацап", "whatsapp"],
  ["signal", "signal"],
  ["сигнал", "signal"],
  ["matrix", "matrix"],
  ["матрикс", "matrix"],
  ["teams", "msteams"],
  ["ms teams", "msteams"],
  ["microsoft teams", "msteams"],
  ["google chat", "googlechat"],
  ["googlechat", "googlechat"],
  ["nostr", "nostr"],
  ["ностр", "nostr"],
  ["imessage", "imessage"],
  ["i message", "imessage"],
  ["аймесседж", "imessage"],
]);

function inLanguage(language: SupportedLanguage, english: string, russian: string) {
  return language === "ru" ? russian : english;
}

function clip(value: string, maxLength = 48) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

function normalizeChannel(raw: string) {
  return CHANNEL_ALIASES.get(raw.trim().toLowerCase()) ?? null;
}

function containsShellChaining(args: string) {
  return /(?:&&|\|\||[|;><`])|\r|\n/.test(args);
}

function quoteShellArg(value: string, platform = process.platform) {
  if (platform === "win32") {
    return `'${value.replace(/'/g, "''")}'`;
  }

  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function buildOpenClawHelp(language: SupportedLanguage) {
  return inLanguage(
    language,
    [
      "You can control OpenClaw directly from chat.",
      "",
      "Fast examples:",
      "- `/openclaw status --deep`",
      "- `/openclaw gateway start --json`",
      "- `every day at 07:00 summarize overnight updates`",
      "- `/openclaw cron add --name \"Morning brief\" --cron \"0 7 * * *\" --message \"Summarize overnight updates.\"`",
      "- `/openclaw channels status`",
      "- `/openclaw channels capabilities --channel discord`",
      "- `connect telegram`",
      "- `update openclaw beta dry-run`",
      "",
      "Anything upstream OpenClaw adds later can still be used here through `/openclaw ...` pass-through.",
    ].join("\n"),
    [
      "OpenClaw можно управлять прямо из чата.",
      "",
      "Быстрые примеры:",
      "- `/openclaw status --deep`",
      "- `/openclaw gateway start --json`",
      "- `каждый день в 07:00 сделай сводку ночных обновлений`",
      "- `/openclaw cron add --name \"Morning brief\" --cron \"0 7 * * *\" --message \"Summarize overnight updates.\"`",
      "- `/openclaw channels status`",
      "- `/openclaw channels capabilities --channel discord`",
      "- `подключи telegram`",
      "- `обнови openclaw beta dry-run`",
      "",
      "Любые новые возможности upstream OpenClaw тоже доступны здесь через прямой pass-through `/openclaw ...`.",
    ].join("\n"),
  );
}

function buildChannelConnectGuide(channel: string, language: SupportedLanguage) {
  const channelFlag = `--channel ${channel}`;

  if (channel === "telegram") {
    return inLanguage(
      language,
      [
        "Telegram setup needs either a bot token or the interactive OpenClaw UI.",
        "",
        "Use one of these chat commands:",
        `- \`/openclaw channels add ${channelFlag} --token <BOT_TOKEN>\``,
        "- `/openclaw dashboard` and finish the Telegram setup in the Control UI",
        "- `/openclaw channels status` to verify the account afterwards",
      ].join("\n"),
      [
        "Для Telegram нужен либо bot token, либо интерактивная настройка через OpenClaw UI.",
        "",
        "Используйте одну из команд в чате:",
        `- \`/openclaw channels add ${channelFlag} --token <BOT_TOKEN>\``,
        "- `/openclaw dashboard` и завершите настройку Telegram в Control UI",
        "- `/openclaw channels status`, чтобы проверить подключение после этого",
      ].join("\n"),
    );
  }

  if (channel === "whatsapp") {
    return inLanguage(
      language,
      [
        "WhatsApp setup is interactive because it usually needs a QR/login flow.",
        "",
        "Recommended dialog flow:",
        "- `/openclaw dashboard`",
        "- complete the WhatsApp login in Control UI",
        "- `/openclaw channels status` to verify the account",
      ].join("\n"),
      [
        "Настройка WhatsApp интерактивная, потому что обычно требует QR/login flow.",
        "",
        "Рекомендуемый сценарий через диалог:",
        "- `/openclaw dashboard`",
        "- завершите вход в WhatsApp в Control UI",
        "- `/openclaw channels status`, чтобы проверить подключение",
      ].join("\n"),
    );
  }

  return inLanguage(
    language,
    [
      `${channel} setup usually needs provider-specific credentials or an interactive UI flow.`,
      "",
      "Use one of these chat commands:",
      `- \`/openclaw channels add ${channelFlag} ...\``,
      `- \`/openclaw channels add ${channelFlag} --help\``,
      "- `/openclaw dashboard` to finish the setup in Control UI",
      "- `/openclaw channels status` to verify the account afterwards",
    ].join("\n"),
    [
      `Для ${channel} обычно нужны provider-specific credentials или интерактивная настройка через UI.`,
      "",
      "Используйте одну из команд в чате:",
      `- \`/openclaw channels add ${channelFlag} ...\``,
      `- \`/openclaw channels add ${channelFlag} --help\``,
      "- `/openclaw dashboard`, чтобы завершить настройку в Control UI",
      "- `/openclaw channels status`, чтобы проверить подключение после этого",
    ].join("\n"),
  );
}

function buildCronJobName(message: string, language: SupportedLanguage) {
  const prefix = language === "ru" ? "Автотриггер" : "Automation trigger";
  return clip(`${prefix}: ${message}`, 60);
}

function buildDailyCronCommand(hour: number, minute: number, message: string, language: SupportedLanguage) {
  const cron = `${minute} ${hour} * * *`;
  const name = buildCronJobName(message, language);
  return [
    "openclaw cron add",
    "--name",
    quoteShellArg(name),
    "--cron",
    quoteShellArg(cron),
    "--message",
    quoteShellArg(message.trim()),
  ].join(" ");
}

function buildUpdateCommand(channel: string | null, dryRun: boolean) {
  const parts = ["openclaw update"];
  if (channel) {
    parts.push(`--channel ${channel}`);
  }
  if (dryRun) {
    parts.push("--dry-run");
  }
  parts.push("--json");
  return parts.join(" ");
}

function resolvePassThrough(raw: string, language: SupportedLanguage): OpenClawDialogResolution {
  const args = raw.replace(/^\/openclaw\b/i, "").trim();
  if (!args || /^help$/i.test(args)) {
    return {
      kind: "message",
      level: "info",
      message: buildOpenClawHelp(language),
    };
  }

  if (containsShellChaining(args)) {
    return {
      kind: "message",
      level: "warning",
      message: inLanguage(
        language,
        "OpenClaw pass-through blocks shell chaining. Send a single upstream OpenClaw command only.",
        "OpenClaw pass-through блокирует shell chaining. Пришлите только одну upstream-команду OpenClaw.",
      ),
    };
  }

  return {
    kind: "command",
    command: `openclaw ${args}`,
  };
}

export function resolveOpenClawDialog(raw: string, language: SupportedLanguage): OpenClawDialogResolution | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\/openclaw\b/i.test(trimmed)) {
    return resolvePassThrough(trimmed, language);
  }

  if (/^(?:openclaw help|help openclaw|как пользоваться openclaw|помощь openclaw)$/i.test(trimmed)) {
    return {
      kind: "message",
      level: "info",
      message: buildOpenClawHelp(language),
    };
  }

  if (/^(?:статус|проверь|покажи)\s+openclaw$/i.test(trimmed) || /^(?:openclaw status|status openclaw)$/i.test(trimmed)) {
    return {
      kind: "command",
      command: "openclaw status --deep",
    };
  }

  if (/^(?:запусти|включи|start)\s+(?:gateway\s+)?openclaw$/i.test(trimmed)) {
    return {
      kind: "command",
      command: "openclaw gateway start --json",
    };
  }

  if (/^(?:останови|выключи|stop)\s+(?:gateway\s+)?openclaw$/i.test(trimmed)) {
    return {
      kind: "command",
      command: "openclaw gateway stop --json",
    };
  }

  if (/^(?:открой|покажи|open)\s+(?:control ui|dashboard|панель)\s+openclaw$/i.test(trimmed)) {
    return {
      kind: "command",
      command: "openclaw dashboard",
    };
  }

  const updateMatch =
    trimmed.match(/^(?:обнови|апдейтни|update)\s+openclaw(?:\s+(stable|beta|dev))?(?:\s+(dry-run|preview|предпросмотр))?$/i) ??
    trimmed.match(/^openclaw update(?:\s+(stable|beta|dev))?(?:\s+(dry-run|preview|предпросмотр))?$/i);
  if (updateMatch) {
    return {
      kind: "command",
      command: buildUpdateCommand(updateMatch[1]?.toLowerCase() ?? null, Boolean(updateMatch[2])),
    };
  }

  const channelsStatusMatch = trimmed.match(/^(?:статус|покажи|проверь)\s+(?:каналы|channels|соцсети)\s+openclaw$/i);
  if (channelsStatusMatch) {
    return {
      kind: "command",
      command: "openclaw channels status",
    };
  }

  const capabilitiesMatch = trimmed.match(
    /^(?:покажи|проверь|check|show)\s+(?:возможности|capabilities)\s+(telegram|discord|slack|whatsapp|signal|matrix|teams|ms teams|google chat|googlechat|nostr|imessage|телеграм|дискорд|слак|ватсап|сигнал|матрикс|ностр|аймесседж)$/i,
  );
  if (capabilitiesMatch) {
    const channel = normalizeChannel(capabilitiesMatch[1] ?? "");
    if (channel) {
      return {
        kind: "command",
        command: `openclaw channels capabilities --channel ${channel}`,
      };
    }
  }

  const connectMatch = trimmed.match(
    /^(?:подключи|добавь|настрой|connect|setup)\s+(telegram|discord|slack|whatsapp|signal|matrix|teams|ms teams|google chat|googlechat|nostr|imessage|телеграм|дискорд|слак|ватсап|сигнал|матрикс|ностр|аймесседж)$/i,
  );
  if (connectMatch) {
    const channel = normalizeChannel(connectMatch[1] ?? "");
    if (channel) {
      return {
        kind: "message",
        level: "info",
        message: buildChannelConnectGuide(channel, language),
      };
    }
  }

  const gmailSetupMatch =
    trimmed.match(/^(?:настрой|подключи|setup)\s+gmail\s+(?:webhook|pubsub|trigger)(?:\s+for\s+|\s+для\s+)?([^\s]+@[^\s]+)?$/i);
  if (gmailSetupMatch) {
    const account = gmailSetupMatch[1]?.trim();
    if (account) {
      return {
        kind: "command",
        command: `openclaw webhooks gmail setup --account ${quoteShellArg(account)}`,
      };
    }

    return {
      kind: "message",
      level: "info",
      message: inLanguage(
        language,
        "Gmail trigger setup needs the mailbox address. Example: `setup gmail webhook you@example.com` or `/openclaw webhooks gmail setup --account you@example.com`.",
        "Для настройки Gmail trigger нужен адрес ящика. Пример: `настрой gmail webhook you@example.com` или `/openclaw webhooks gmail setup --account you@example.com`.",
      ),
    };
  }

  if (/^(?:покажи|list|список)\s+(?:cron|крон|расписание)\s+openclaw$/i.test(trimmed)) {
    return {
      kind: "command",
      command: "openclaw cron list",
    };
  }

  const dailyCronMatch =
    trimmed.match(/^каждый\s+день\s+в\s+(\d{1,2}):(\d{2})\s*(?:[-:]\s*|\s+)(.+)$/i) ??
    trimmed.match(/^every\s+day\s+at\s+(\d{1,2}):(\d{2})\s*(?:[-:]\s*|\s+)(.+)$/i);
  if (dailyCronMatch) {
    const hour = Number(dailyCronMatch[1]);
    const minute = Number(dailyCronMatch[2]);
    const message = dailyCronMatch[3]?.trim() ?? "";

    if (Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && message.length >= 3) {
      return {
        kind: "command",
        command: buildDailyCronCommand(hour, minute, message, language),
      };
    }

    return {
      kind: "message",
      level: "warning",
      message: inLanguage(
        language,
        "I could not parse the daily trigger. Use `every day at 07:00 summarize overnight updates` or pass the exact OpenClaw command via `/openclaw cron add ...`.",
        "Не удалось разобрать ежедневный trigger. Используйте `каждый день в 07:00 сделай сводку ночных обновлений` или передайте точную команду OpenClaw через `/openclaw cron add ...`.",
      ),
    };
  }

  return null;
}
