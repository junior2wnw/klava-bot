import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { HDKey } from "@scure/bip32";
import { bech32, hex } from "@scure/base";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";
import type { ProviderBalance, TaskMessage } from "@klava/contracts";
import {
  DEFAULT_MODEL,
  GONKA_BALANCE_REFRESH_INTERVAL_MS,
  GONKA_DISCOVERY_URLS,
  GONKA_MNEMONIC_HD_PATH,
  GONKA_MOCK_API_KEY,
  GONKA_NETWORK_REFRESH_INTERVAL_MS,
} from "./constants";

type GonkaEndpoint = {
  url: string;
  transferAddress: string;
  address?: string;
};

type ModelDescriptor = {
  id?: string | null;
  units_of_compute_per_token?: number | null;
  v_ram?: number | null;
  throughput_per_nonce?: number | null;
};

type ModelsEnvelope = {
  data?: ModelDescriptor[];
  models?: ModelDescriptor[];
};

type RankedModel = {
  id: string;
  unitsOfComputePerToken: number;
  parameterCount: number;
  vram: number;
  throughput: number;
  reasoningScore: number;
  familyScore: number;
  recencyScore: number;
};

type PreparedGonkaSecret = {
  privateKey: string;
  requesterAddress: string;
  inputKind: "mnemonic" | "private_key";
  derivationPath: string | null;
};

type GonkaSecretOptions = {
  expectedAddress?: string | null;
  mnemonicPassphrase?: string | null;
};

type ResolvedGonkaNetwork = {
  sourceUrl: string;
  endpoints: GonkaEndpoint[];
  selectedEndpoint: GonkaEndpoint;
  models: string[];
};

type CachedNetworkResolution = {
  resolvedAt: number;
  network: ResolvedGonkaNetwork;
};

type CachedBalanceResolution = {
  resolvedAt: number;
  balance: ProviderBalance;
};

type SignatureComponents = {
  payload: string | Uint8Array | Buffer | object;
  timestamp: bigint;
  transferAddress: string;
};

type ResolvedTransferAgent = {
  baseUrl: string;
  endpoint: GonkaEndpoint;
  models: Array<string | ModelDescriptor>;
};

type ChainBalanceCoin = {
  denom?: string | null;
  amount?: string | null;
};

type ChainBalancesEnvelope = {
  balances?: ChainBalanceCoin[];
};

export type ResolvedGonkaModel = {
  model: string;
  candidates: string[];
  requesterAddress: string;
  resolvedSecret: string;
};

const VALID_MNEMONIC_WORD_COUNTS = new Set([12, 15, 18, 21, 24]);
const GONKA_MNEMONIC_PROBE_SCAN_LIMIT = 10;
const GONKA_MNEMONIC_ADDRESS_MATCH_SCAN_DEPTH = 9;
const PROBE_PROMPT = "Reply with exactly OK.";

function toOpenAiMessages(messages: TaskMessage[]) {
  return messages.map<ChatCompletionMessageParam>((message) => {
    if (message.role === "assistant") {
      return { role: "assistant", content: message.content };
    }

    if (message.role === "user") {
      return { role: "user", content: message.content };
    }

    return { role: "system", content: message.content };
  });
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function shuffle<T>(values: T[]) {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex] as T;
    shuffled[swapIndex] = current as T;
  }

  return shuffled;
}

function ensureV1(url: string) {
  const normalized = url.trim().replace(/\/+$/, "");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

function compareRankedModels(left: RankedModel, right: RankedModel) {
  const computeComparison = right.unitsOfComputePerToken - left.unitsOfComputePerToken;
  if (computeComparison !== 0) {
    return computeComparison;
  }

  const parameterComparison = right.parameterCount - left.parameterCount;
  if (parameterComparison !== 0) {
    return parameterComparison;
  }

  const vramComparison = right.vram - left.vram;
  if (vramComparison !== 0) {
    return vramComparison;
  }

  const reasoningComparison = right.reasoningScore - left.reasoningScore;
  if (reasoningComparison !== 0) {
    return reasoningComparison;
  }

  const recencyComparison = right.recencyScore - left.recencyScore;
  if (recencyComparison !== 0) {
    return recencyComparison;
  }

  const familyComparison = right.familyScore - left.familyScore;
  if (familyComparison !== 0) {
    return familyComparison;
  }

  const throughputComparison = right.throughput - left.throughput;
  if (throughputComparison !== 0) {
    return throughputComparison;
  }

  return left.id.localeCompare(right.id);
}

function toRankedModel(input: string | ModelDescriptor): RankedModel | null {
  const id = (typeof input === "string" ? input : input.id ?? "").trim();
  if (!id) {
    return null;
  }

  const lowered = id.toLowerCase();
  const parameterMatches = [...lowered.matchAll(/(\d+(?:\.\d+)?)b/g)].map((match) => Number(match[1]));
  const releaseMatch = lowered.match(/(?:^|[-_/])(\d{4})(?:[-_/]|$)/);
  const descriptor = typeof input === "string" ? null : input;

  return {
    id,
    unitsOfComputePerToken:
      typeof descriptor?.units_of_compute_per_token === "number" ? descriptor.units_of_compute_per_token : 0,
    parameterCount: parameterMatches.length ? Math.max(...parameterMatches) : 0,
    vram: typeof descriptor?.v_ram === "number" ? descriptor.v_ram : 0,
    throughput: typeof descriptor?.throughput_per_nonce === "number" ? descriptor.throughput_per_nonce : 0,
    reasoningScore: ["reason", "reasoning", "r1", "think", "thinking", "qwq"].reduce(
      (score, token) => score + (lowered.includes(token) ? 1 : 0),
      0,
    ),
    familyScore: ["instruct", "chat"].reduce((score, token) => score + (lowered.includes(token) ? 1 : 0), 0),
    recencyScore: releaseMatch ? Number(releaseMatch[1]) : 0,
  };
}

function rankModelIds(inputs: Array<string | ModelDescriptor>) {
  const byId = new Map<string, RankedModel>();

  for (const input of inputs) {
    const ranked = toRankedModel(input);
    if (!ranked) {
      continue;
    }

    const existing = byId.get(ranked.id);
    if (!existing) {
      byId.set(ranked.id, ranked);
      continue;
    }

    byId.set(ranked.id, {
      ...existing,
      unitsOfComputePerToken: Math.max(existing.unitsOfComputePerToken, ranked.unitsOfComputePerToken),
      parameterCount: Math.max(existing.parameterCount, ranked.parameterCount),
      vram: Math.max(existing.vram, ranked.vram),
      throughput: Math.max(existing.throughput, ranked.throughput),
      reasoningScore: Math.max(existing.reasoningScore, ranked.reasoningScore),
      familyScore: Math.max(existing.familyScore, ranked.familyScore),
      recencyScore: Math.max(existing.recencyScore, ranked.recencyScore),
    });
  }

  return [...byId.values()].sort(compareRankedModels).map((model) => model.id);
}

function normalizeHexPrivateKey(rawSecret: string) {
  const normalized = rawSecret.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Invalid Gonka private key format. Use a 64-character hex key or a recovery phrase.");
  }
  return `0x${normalized}`;
}

function hexPrivateKeyToBytes(privateKeyHex: string) {
  return hex.decode(privateKeyHex.trim().toLowerCase().replace(/^0x/, ""));
}

function looksLikeMnemonic(rawSecret: string) {
  const words = rawSecret
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  return VALID_MNEMONIC_WORD_COUNTS.has(words.length);
}

function deriveMnemonicRoot(mnemonic: string, passphrase = "") {
  if (!validateMnemonic(mnemonic, englishWordlist)) {
    throw new Error("Invalid Gonka recovery phrase. Check the words and try again.");
  }

  return HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic, passphrase));
}

function derivePrivateKeyFromRoot(root: HDKey, derivationPath: string) {
  const key = root.derive(derivationPath).privateKey;

  if (!key) {
    throw new Error("Failed to derive a Gonka private key from the recovery phrase.");
  }

  return `0x${Buffer.from(key).toString("hex")}`;
}

function buildMnemonicPathCandidates() {
  const paths: string[] = [];
  const seen = new Set<string>();

  const push = (accountIndex: number, addressIndex: number) => {
    const path = `m/44'/118'/${accountIndex}'/0/${addressIndex}`;
    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  };

  // Expand outward from the default Cosmos path before trying less common account/index combinations.
  for (let depth = 0; depth <= GONKA_MNEMONIC_ADDRESS_MATCH_SCAN_DEPTH; depth += 1) {
    push(0, depth);

    if (depth > 0) {
      push(depth, 0);
    }

    for (let inner = 1; inner < depth; inner += 1) {
      push(inner, depth);
      push(depth, inner);
    }

    if (depth > 0) {
      push(depth, depth);
    }
  }

  return paths;
}

const COMMON_GONKA_MNEMONIC_PATHS = buildMnemonicPathCandidates();

function normalizeGonkaAddress(rawAddress?: string | null) {
  const normalized = rawAddress?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }

  if (!normalized.includes("1")) {
    throw new Error("Invalid Gonka wallet address format. Use the gonka1... address shown by your wallet.");
  }

  try {
    const decoded = bech32.decode(normalized as `${string}1${string}`);
    if (decoded.prefix !== "gonka") {
      throw new Error("wrong prefix");
    }
  } catch {
    throw new Error("Invalid Gonka wallet address format. Use the gonka1... address shown by your wallet.");
  }

  return normalized;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.?0+$/, "");
}

function formatAtomicAmount(amount: string, decimals: number) {
  if (!/^\d+$/.test(amount)) {
    return amount;
  }

  const normalized = amount.replace(/^0+(?=\d)/, "");
  if (normalized === "0") {
    return "0";
  }

  if (decimals === 0) {
    return normalized;
  }

  const integerPart =
    normalized.length > decimals ? normalized.slice(0, normalized.length - decimals) : "0";
  const fractionalRaw =
    normalized.length > decimals
      ? normalized.slice(normalized.length - decimals)
      : normalized.padStart(decimals, "0");
  const fractionalPart = trimTrailingZeros(fractionalRaw);

  return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
}

function formatProviderBalance(coin: ChainBalanceCoin, sourceUrl: string): ProviderBalance {
  const denom = typeof coin.denom === "string" && coin.denom.trim().length > 0 ? coin.denom.trim() : "ngonka";
  const amount = typeof coin.amount === "string" && /^\d+$/.test(coin.amount) ? coin.amount : "0";
  const isNativeGonka = denom === "ngonka";

  return {
    denom,
    amount,
    displayAmount: isNativeGonka ? formatAtomicAmount(amount, 9) : amount,
    displayDenom: isNativeGonka ? "GONKA" : denom,
    asOf: new Date().toISOString(),
    sourceUrl,
  };
}

function createPreparedSecret(privateKey: string, inputKind: PreparedGonkaSecret["inputKind"], derivationPath: string | null) {
  return {
    privateKey,
    requesterAddress: gonkaAddress(privateKey),
    inputKind,
    derivationPath,
  };
}

function deriveMnemonicCandidates(mnemonic: string, options: GonkaSecretOptions = {}) {
  const normalizedExpectedAddress = normalizeGonkaAddress(options.expectedAddress);
  const root = deriveMnemonicRoot(mnemonic, options.mnemonicPassphrase ?? "");
  const derived = COMMON_GONKA_MNEMONIC_PATHS.map((derivationPath) =>
    createPreparedSecret(derivePrivateKeyFromRoot(root, derivationPath), "mnemonic", derivationPath),
  );

  if (normalizedExpectedAddress) {
    const exactMatch = derived.find((candidate) => candidate.requesterAddress === normalizedExpectedAddress);

    if (!exactMatch) {
      throw new Error(
        `The recovery phrase did not derive ${normalizedExpectedAddress} across the common Gonka/Cosmos account paths checked. If Keplr still shows that Gonka address, it is likely an additional Gonka account imported by raw private key rather than derived from this recovery phrase, or the wallet uses a mnemonic passphrase. Enter the mnemonic passphrase or paste the raw private key instead.`,
      );
    }

    return [exactMatch];
  }

  return derived.slice(0, GONKA_MNEMONIC_PROBE_SCAN_LIMIT);
}

function getSigBytes(components: SignatureComponents) {
  let payloadBytes: Uint8Array;

  if (typeof components.payload === "string") {
    payloadBytes = Buffer.from(components.payload);
  } else if (Buffer.isBuffer(components.payload)) {
    payloadBytes = components.payload;
  } else if (components.payload instanceof Uint8Array) {
    payloadBytes = components.payload;
  } else {
    payloadBytes = Buffer.from(JSON.stringify(components.payload));
  }

  const payloadHashHex = hex.encode(sha256(payloadBytes)).toLowerCase();
  return Buffer.from(`${payloadHashHex}${components.timestamp.toString()}${components.transferAddress}`);
}

function getNanoTimestamp() {
  const millisSinceEpoch = BigInt(Date.now()) * 1_000_000n;
  const subMillisecondNanos = process.hrtime.bigint() % 1_000_000n;
  return millisSinceEpoch + subMillisecondNanos;
}

function gonkaSignature(components: SignatureComponents, privateKeyHex: string) {
  const privateKey = hexPrivateKeyToBytes(privateKeyHex);
  const messageHash = sha256(getSigBytes(components));
  const signature = secp256k1.sign(messageHash, privateKey, { lowS: true, format: "compact" }) as
    | Uint8Array
    | { toCompactRawBytes: () => Uint8Array };
  const compactBytes = signature instanceof Uint8Array ? signature : signature.toCompactRawBytes();
  return Buffer.from(compactBytes).toString("base64");
}

function gonkaAddress(privateKeyHex: string) {
  const privateKey = hexPrivateKeyToBytes(privateKeyHex);
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  const addressBytes = ripemd160(sha256(publicKey));
  return bech32.encode("gonka", bech32.toWords(addressBytes));
}

function createSignedFetch({
  gonkaPrivateKey,
  requesterAddress,
  selectedEndpoint,
}: {
  gonkaPrivateKey: string;
  requesterAddress: string;
  selectedEndpoint: GonkaEndpoint;
}) {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    const requestInit: RequestInit = init ? { ...init } : {};
    const headers = new Headers(requestInit.headers || {});
    headers.set("X-Requester-Address", requesterAddress);

    const timestamp = getNanoTimestamp();
    headers.set("X-Timestamp", timestamp.toString());

    const body = requestInit.body;
    if (body) {
      headers.set(
        "Authorization",
        gonkaSignature(
          {
            payload:
              typeof body === "string" || body instanceof Uint8Array || Buffer.isBuffer(body) ? body : String(body),
            timestamp,
            transferAddress: selectedEndpoint.transferAddress || selectedEndpoint.address || "",
          },
          gonkaPrivateKey,
        ),
      );
    } else {
      headers.set(
        "Authorization",
        `ECDSA_SIG_EMPTY_${Buffer.from(gonkaPrivateKey.substring(0, 16)).toString("base64")}`,
      );
    }

    requestInit.headers = headers;
    return fetch(url, requestInit);
  };
}

function createClient(privateKey: string, endpoint: GonkaEndpoint) {
  const requesterAddress = gonkaAddress(privateKey);
  return new OpenAI({
    apiKey: GONKA_MOCK_API_KEY,
    baseURL: endpoint.url,
    fetch: createSignedFetch({
      gonkaPrivateKey: privateKey,
      requesterAddress,
      selectedEndpoint: endpoint,
    }) as typeof fetch,
  });
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getErrorMessageLower(error: unknown) {
  return getErrorMessage(error).toLowerCase();
}

function isAccountMissingError(error: unknown) {
  const message = getErrorMessageLower(error);
  return message.includes("account not found") || message.includes("key not found");
}

function isInsufficientFundsError(error: unknown) {
  const message = getErrorMessageLower(error);
  return (
    message.includes("insufficient") &&
    ["fund", "balance", "credit", "payment", "fee"].some((token) => message.includes(token))
  );
}

function isSignatureRejectedError(error: unknown) {
  const message = getErrorMessageLower(error);
  return (
    ["signature", "authorization", "requester", "ecdsa", "timestamp"].some((token) => message.includes(token)) &&
    ["invalid", "mismatch", "reject", "unauthorized", "forbidden"].some((token) => message.includes(token))
  );
}

function isModelUnavailableError(error: unknown) {
  const status = getErrorStatus(error);
  const message = getErrorMessageLower(error);

  if (status === 404) {
    return true;
  }

  if ((status === 400 || status === 403) && (message.includes("model") || message.includes("chat completions"))) {
    return true;
  }

  return (
    (message.includes("model") || message.includes("chat completions")) &&
    ["access", "does not exist", "not found", "not support", "permission", "unsupported", "unavailable"].some(
      (token) => message.includes(token),
    )
  );
}

function isProviderPanicError(error: unknown) {
  const message = getErrorMessageLower(error);
  return message.includes("nil pointer dereference") || (message.includes("runtime error") && message.includes("panic"));
}

function isTransientRequestError(error: unknown) {
  const status = getErrorStatus(error);
  const message = getErrorMessageLower(error);

  if (isAccountMissingError(error) || isInsufficientFundsError(error) || isSignatureRejectedError(error)) {
    return false;
  }

  if (status !== null && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  return [
    "econnreset",
    "econnrefused",
    "fetch failed",
    "gateway",
    "timeout",
    "timed out",
    "temporarily unavailable",
    "socket hang up",
    "network error",
  ].some((token) => message.includes(token));
}

function shouldTryNextMnemonicCandidate(error: unknown) {
  const message = getErrorMessageLower(error);
  return message.includes("not found on mainnet") || message.includes("cannot pay for inference right now");
}

function toMnemonicExhaustedError(candidates: PreparedGonkaSecret[]) {
  const samples = candidates
    .slice(0, 3)
    .map((candidate) => `${candidate.derivationPath} -> ${candidate.requesterAddress}`)
    .join("; ");

  return new Error(
    `Klava tried ${candidates.length} common Gonka/Cosmos derivation paths from this recovery phrase and none produced a usable mainnet account. Sample derived addresses: ${samples}. If your wallet shows a specific gonka1... address, enter it in the optional wallet address field, or paste the raw private key instead.`,
  );
}

function toUserFacingError(error: unknown, prepared: Pick<PreparedGonkaSecret, "requesterAddress" | "inputKind" | "derivationPath">) {
  if (isAccountMissingError(error)) {
    if (prepared.inputKind === "mnemonic") {
      const pathLabel =
        prepared.derivationPath && prepared.derivationPath !== GONKA_MNEMONIC_HD_PATH
          ? `the path ${prepared.derivationPath}`
          : `the standard path ${prepared.derivationPath ?? GONKA_MNEMONIC_HD_PATH}`;

      return new Error(
        `The recovery phrase was derived with ${pathLabel}, which produced ${prepared.requesterAddress}. That account was not found on mainnet. If your wallet shows a different Gonka address, it likely uses another account index, derivation path, or mnemonic passphrase. Paste the raw private key from your Gonka wallet instead.`,
      );
    }

    return new Error(
      `The derived Gonka account ${prepared.requesterAddress} was not found on mainnet. Use a funded Gonka account or paste its raw private key.`,
    );
  }

  if (isInsufficientFundsError(error)) {
    return new Error("This Gonka account cannot pay for inference right now. Top up the account and try again.");
  }

  if (isSignatureRejectedError(error)) {
    return new Error("GONKA rejected the signed request. Recheck the private phrase or private key and try again.");
  }

  if (isModelUnavailableError(error)) {
    return new Error("The selected Gonka model is unavailable on the active transfer agents right now.");
  }

  if (isProviderPanicError(error)) {
    return new Error(
      "GONKA mainnet accepted the signed request but the transfer agent crashed internally. This is a provider-side failure; try again later.",
    );
  }

  const status = getErrorStatus(error);
  if (status === 429) {
    return new Error("GONKA is rate-limiting requests right now. Try again in a moment.");
  }

  if (status !== null && status >= 500) {
    return new Error(`GONKA mainnet returned ${status}. Try again in a moment.`);
  }

  return error instanceof Error ? error : new Error("Unknown Gonka provider error");
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
  const raw = await response.text();

  if (!response.ok) {
    const suffix = raw ? ` ${raw.slice(0, 180)}` : "";
    throw new Error(`Request failed for ${url}: ${response.status}${suffix}`);
  }

  if (!raw) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
}

export class GonkaService {
  private networkCache: CachedNetworkResolution | null = null;
  private balanceCache = new Map<string, CachedBalanceResolution>();

  private prepareSecrets(rawSecret: string, options: GonkaSecretOptions = {}): PreparedGonkaSecret[] {
    const trimmed = rawSecret.trim();
    if (!trimmed) {
      throw new Error("Enter your Gonka private key or recovery phrase.");
    }

    const mnemonicInput = looksLikeMnemonic(trimmed);
    if (mnemonicInput) {
      return deriveMnemonicCandidates(trimmed, options);
    }

    const privateKey = normalizeHexPrivateKey(trimmed);
    const prepared = createPreparedSecret(privateKey, "private_key", null);
    const normalizedExpectedAddress = normalizeGonkaAddress(options.expectedAddress);

    if (normalizedExpectedAddress && prepared.requesterAddress !== normalizedExpectedAddress) {
      throw new Error(
        `The supplied private key derives ${prepared.requesterAddress}, not ${normalizedExpectedAddress}. Check the wallet address or paste the matching raw private key.`,
      );
    }

    return [prepared];
  }

  prepareSecret(rawSecret: string): PreparedGonkaSecret {
    return this.prepareSecrets(rawSecret)[0] as PreparedGonkaSecret;
  }

  private async fetchParticipantsModels(sourceUrl: string) {
    const payload = await fetchJson<{
      active_participants?: {
        participants?: Array<{
          models?: string[];
        }>;
      };
    }>(joinUrl(sourceUrl, "/v1/epochs/current/participants"));

    return unique(payload.active_participants?.participants?.flatMap((participant) => participant.models ?? []) ?? []);
  }

  private async fetchEndpointModels(endpointUrl: string) {
    const payload = await fetchJson<ModelsEnvelope>(joinUrl(endpointUrl, "/models"));
    return [...(payload.data ?? []), ...(payload.models ?? [])];
  }

  private async resolveTransferAgent(baseUrl: string): Promise<ResolvedTransferAgent> {
    const identity = await fetchJson<{
      data?: {
        address?: string | null;
      };
    }>(joinUrl(baseUrl, "/v1/identity"));

    const transferAddress = identity.data?.address?.trim();
    if (!transferAddress) {
      throw new Error(`Missing transfer address for ${baseUrl}`);
    }

    const endpoint: GonkaEndpoint = {
      url: ensureV1(baseUrl),
      transferAddress,
      address: transferAddress,
    };

    const models = await this.fetchEndpointModels(endpoint.url);
    return {
      baseUrl,
      endpoint,
      models,
    };
  }

  private orderedEndpoints(network: ResolvedGonkaNetwork) {
    const selectedKey = `${network.selectedEndpoint.url}|${network.selectedEndpoint.transferAddress}`;
    const remaining = shuffle(
      network.endpoints.filter(
        (endpoint) => `${endpoint.url}|${endpoint.transferAddress}` !== selectedKey,
      ),
    );
    return [network.selectedEndpoint, ...remaining];
  }

  private async resolveNetwork(force = false): Promise<ResolvedGonkaNetwork> {
    if (
      !force &&
      this.networkCache &&
      Date.now() - this.networkCache.resolvedAt < GONKA_NETWORK_REFRESH_INTERVAL_MS
    ) {
      return this.networkCache.network;
    }

    let lastError: unknown = null;
    const activeEndpoints: ResolvedTransferAgent[] = [];

    for (const sourceUrl of GONKA_DISCOVERY_URLS) {
      try {
        activeEndpoints.push(await this.resolveTransferAgent(sourceUrl));
      } catch (error) {
        lastError = error;
      }
    }

    if (!activeEndpoints.length) {
      throw lastError instanceof Error
        ? lastError
        : new Error("Unable to resolve Gonka mainnet endpoints right now.");
    }

    const primaryEndpoint = activeEndpoints[0];
    if (!primaryEndpoint) {
      throw new Error("Unable to resolve Gonka mainnet endpoints right now.");
    }

    const endpoints = activeEndpoints.map((entry) => entry.endpoint);
    const selectedEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)] ?? primaryEndpoint.endpoint;

    const publicParticipantsModels = await this.fetchParticipantsModels(primaryEndpoint.baseUrl).catch(() => []);
    const models = rankModelIds([
      ...publicParticipantsModels,
      ...activeEndpoints.flatMap((entry) => entry.models),
    ]);

    const network: ResolvedGonkaNetwork = {
      sourceUrl: primaryEndpoint.baseUrl,
      endpoints,
      selectedEndpoint,
      models: models.length ? models : [DEFAULT_MODEL],
    };

    this.networkCache = {
      resolvedAt: Date.now(),
      network,
    };

    return network;
  }

  private async probeConnection(prepared: PreparedGonkaSecret, model: string) {
    let lastError: unknown = null;

    for (const forceRefresh of [false, true]) {
      const network = await this.resolveNetwork(forceRefresh);

      for (const endpoint of this.orderedEndpoints(network)) {
        try {
          const client = createClient(prepared.privateKey, endpoint);
          await client.chat.completions.create({
            model,
            max_tokens: 1,
            temperature: 0,
            messages: [{ role: "user", content: PROBE_PROMPT }],
          });
          return;
        } catch (error) {
          lastError = error;

          if (isAccountMissingError(error) || isInsufficientFundsError(error) || isSignatureRejectedError(error)) {
            throw toUserFacingError(error, prepared);
          }

          if (isModelUnavailableError(error) || isTransientRequestError(error)) {
            continue;
          }

          throw toUserFacingError(error, prepared);
        }
      }
    }

    throw toUserFacingError(lastError, prepared);
  }

  private async completeWithPrepared(prepared: PreparedGonkaSecret, model: string, messages: TaskMessage[]) {
    let lastError: unknown = null;

    for (const forceRefresh of [false, true]) {
      const network = await this.resolveNetwork(forceRefresh);

      for (const endpoint of this.orderedEndpoints(network)) {
        try {
          const client = createClient(prepared.privateKey, endpoint);
          const response = await client.chat.completions.create({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are Klava, a calm desktop AI operator. Be concise, practical, and explicit when an action needs approval or safer workflow routing.",
              },
              ...toOpenAiMessages(messages),
            ],
          });

          return response.choices[0]?.message?.content?.trim() || "I could not produce a response for that request.";
        } catch (error) {
          lastError = error;

          if (isAccountMissingError(error) || isInsufficientFundsError(error) || isSignatureRejectedError(error)) {
            throw toUserFacingError(error, prepared);
          }

          if (isModelUnavailableError(error) || isTransientRequestError(error)) {
            continue;
          }

          throw toUserFacingError(error, prepared);
        }
      }
    }

    throw toUserFacingError(lastError, prepared);
  }

  async resolveBestModel() {
    const network = await this.resolveNetwork();
    return {
      model: network.models[0] ?? DEFAULT_MODEL,
      candidates: network.models.length ? network.models : [DEFAULT_MODEL],
    };
  }

  async getBalance(address: string): Promise<ProviderBalance> {
    const normalizedAddress = normalizeGonkaAddress(address);
    if (!normalizedAddress) {
      throw new Error("Enter a Gonka wallet address to check its balance.");
    }

    const cached = this.balanceCache.get(normalizedAddress);
    if (
      cached &&
      Date.now() - cached.resolvedAt < GONKA_BALANCE_REFRESH_INTERVAL_MS
    ) {
      return cached.balance;
    }

    let lastError: unknown = null;

    for (const sourceUrl of GONKA_DISCOVERY_URLS) {
      try {
        const payload = await fetchJson<ChainBalancesEnvelope>(
          joinUrl(sourceUrl, `/chain-api/cosmos/bank/v1beta1/balances/${normalizedAddress}`),
        );
        const balances = (payload.balances ?? []).filter(
          (coin): coin is ChainBalanceCoin =>
            typeof coin?.denom === "string" && typeof coin?.amount === "string",
        );
        const primary = balances.find((coin) => coin.denom === "ngonka") ?? balances[0] ?? { denom: "ngonka", amount: "0" };
        const balance = formatProviderBalance(primary, sourceUrl);

        this.balanceCache.set(normalizedAddress, {
          resolvedAt: Date.now(),
          balance,
        });

        return balance;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Unable to read the Gonka balance right now.");
  }

  async validate(secret: string, options: GonkaSecretOptions = {}): Promise<ResolvedGonkaModel> {
    const preparedCandidates = this.prepareSecrets(secret, options);
    const selection = await this.resolveBestModel();
    const candidates = unique([selection.model, ...selection.candidates, DEFAULT_MODEL]);
    let lastError: unknown = null;

    for (const prepared of preparedCandidates) {
      for (const candidate of candidates) {
        try {
          await this.probeConnection(prepared, candidate);
          return {
            model: candidate,
            candidates,
            requesterAddress: prepared.requesterAddress,
            resolvedSecret: prepared.privateKey,
          };
        } catch (error) {
          lastError = error;
          if (!this.shouldRetryModelSelection(error)) {
            break;
          }
        }
      }

      if (prepared.inputKind === "mnemonic" && preparedCandidates.length > 1 && shouldTryNextMnemonicCandidate(lastError)) {
        continue;
      }

      throw toUserFacingError(lastError, prepared);
    }

    throw toMnemonicExhaustedError(preparedCandidates);
  }

  async complete({
    secret,
    model,
    messages,
  }: {
    secret: string;
    model: string;
    messages: TaskMessage[];
  }) {
    const preparedCandidates = this.prepareSecrets(secret);
    let lastError: unknown = null;

    for (const prepared of preparedCandidates) {
      try {
        return await this.completeWithPrepared(prepared, model, messages);
      } catch (error) {
        lastError = error;
      }

      if (prepared.inputKind === "mnemonic" && preparedCandidates.length > 1 && shouldTryNextMnemonicCandidate(lastError)) {
        continue;
      }

      throw toUserFacingError(lastError, prepared);
    }

    throw toMnemonicExhaustedError(preparedCandidates);
  }

  shouldRetryModelSelection(error: unknown) {
    return isModelUnavailableError(error);
  }
}
