export type AgentSafetyDecision =
  | { kind: "allowed" }
  | {
      kind: "blocked";
      category: "copyright" | "credential_theft" | "malware" | "unauthorized_access" | "destructive";
      reason: string;
    };

type SafetyRule = {
  category: Exclude<AgentSafetyDecision, { kind: "allowed" }>["category"];
  reason: string;
  patterns: RegExp[];
};

const rules: SafetyRule[] = [
  {
    category: "copyright",
    reason: "copyright-infringing downloads, torrents, cracks, and paid-media piracy are blocked",
    patterns: [
      /\b(torrent|magnet|pirate|warez|rutracker|seedbox|crack|keygen)\b.*\b(movie|film|series|show|album|song|game|steam|adobe|paid software)\b/i,
      /\b(movie|film|series|show|album|song|game|steam|adobe|paid software)\b.*\b(torrent|magnet|crack|keygen|warez)\b/i,
    ],
  },
  {
    category: "credential_theft",
    reason: "credential theft, token theft, cookie theft, and password dumping are blocked",
    patterns: [/\b(password dump|dump passwords|steal cookies|steal token|session hijack|browser credentials|extract passwords|lsass|mimikatz|token theft)\b/i],
  },
  {
    category: "malware",
    reason: "malware, ransomware, keyloggers, botnets, and persistence tooling are blocked",
    patterns: [/\b(ransomware|keylogger|botnet|rat\b|stealer|dropper|worm|backdoor|persistence malware|encrypt files for ransom)\b/i],
  },
  {
    category: "unauthorized_access",
    reason: "unauthorized access, auth bypass, exploitation, and hacking requests are blocked",
    patterns: [/\b(bypass auth|bypass authentication|exploit target|hack into|gain unauthorized access|privilege escalation against|sql injection against|phishing)\b/i],
  },
  {
    category: "destructive",
    reason: "destructive sabotage, wiping, and harmful disablement are blocked",
    patterns: [/\b(wipe the disk|destroy data|delete logs to hide|disable defender|sabotage|brick the machine|destroy the system)\b/i],
  },
];

export function assessAgentObjective(text: string): AgentSafetyDecision {
  const normalized = text.trim();
  if (!normalized) {
    return { kind: "allowed" };
  }

  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        kind: "blocked",
        category: rule.category,
        reason: rule.reason,
      };
    }
  }

  return { kind: "allowed" };
}

export function buildBlockedObjectiveMessage(decision: Exclude<AgentSafetyDecision, { kind: "allowed" }>) {
  return `I will not help with that objective because ${decision.reason}.`;
}
