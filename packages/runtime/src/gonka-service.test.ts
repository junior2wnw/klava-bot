import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODEL } from "./constants";
import { GonkaService } from "./gonka-service";

const TEST_MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const NON_DEFAULT_PATH = "m/44'/118'/1'/0/0";
const NON_DEFAULT_ADDRESS = "gonka1tehv5km5e9y706rc2gzk9yyun9dljjjnu3v0md";
const NON_DEFAULT_PRIVATE_KEY = "0x3992639e9c460fa71cde7fba107fb9d344ee312293a307fbf9d086e1d535742c";

type PreparedCandidate = {
  privateKey: string;
  requesterAddress: string;
  inputKind: "mnemonic" | "private_key";
  derivationPath: string | null;
};

type ServiceInternals = {
  resolveBestModel: () => Promise<{ model: string; candidates: string[] }>;
  probeConnection: (prepared: PreparedCandidate, model: string) => Promise<void>;
};

test("validate matches a requested Gonka wallet address on a non-default mnemonic path", async () => {
  const service = new GonkaService();
  const serviceInternals = service as unknown as ServiceInternals;
  let probeCalls = 0;

  serviceInternals.resolveBestModel = async () => ({
    model: "mock/model",
    candidates: ["mock/model"],
  });
  serviceInternals.probeConnection = async (prepared: PreparedCandidate, model: string) => {
    probeCalls += 1;
    assert.equal(model, "mock/model");
    assert.equal(prepared.derivationPath, NON_DEFAULT_PATH);
    assert.equal(prepared.requesterAddress, NON_DEFAULT_ADDRESS);
    assert.equal(prepared.privateKey, NON_DEFAULT_PRIVATE_KEY);
  };

  const result = await service.validate(TEST_MNEMONIC, {
    expectedAddress: NON_DEFAULT_ADDRESS,
  });

  assert.equal(probeCalls, 1);
  assert.equal(result.model, "mock/model");
  assert.deepEqual(result.candidates, ["mock/model", DEFAULT_MODEL]);
  assert.equal(result.requesterAddress, NON_DEFAULT_ADDRESS);
  assert.equal(result.resolvedSecret, NON_DEFAULT_PRIVATE_KEY);
});

test("validate scans nearby mnemonic paths until a funded account succeeds", async () => {
  const service = new GonkaService();
  const serviceInternals = service as unknown as ServiceInternals;
  const attemptedPaths: string[] = [];

  serviceInternals.resolveBestModel = async () => ({
    model: "mock/model",
    candidates: ["mock/model"],
  });
  serviceInternals.probeConnection = async (prepared: PreparedCandidate) => {
    attemptedPaths.push(prepared.derivationPath ?? "private-key");

    if (prepared.derivationPath === NON_DEFAULT_PATH) {
      return;
    }

    throw new Error(`The derived Gonka account ${prepared.requesterAddress} was not found on mainnet.`);
  };

  const result = await service.validate(TEST_MNEMONIC);

  assert.deepEqual(attemptedPaths.slice(0, 3), [
    "m/44'/118'/0'/0/0",
    "m/44'/118'/0'/0/1",
    NON_DEFAULT_PATH,
  ]);
  assert.equal(result.requesterAddress, NON_DEFAULT_ADDRESS);
  assert.equal(result.resolvedSecret, NON_DEFAULT_PRIVATE_KEY);
});

test("getBalance formats native Gonka balances and caches repeated lookups", async () => {
  const service = new GonkaService();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls += 1;
    assert.match(String(input), /chain-api\/cosmos\/bank\/v1beta1\/balances\//);

    return new Response(JSON.stringify({
      balances: [
        {
          denom: "ngonka",
          amount: "10000000000",
        },
      ],
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as typeof fetch;

  try {
    const first = await service.getBalance(NON_DEFAULT_ADDRESS);
    const second = await service.getBalance(NON_DEFAULT_ADDRESS);

    assert.equal(fetchCalls, 1);
    assert.equal(first.amount, "10000000000");
    assert.equal(first.denom, "ngonka");
    assert.equal(first.displayAmount, "10");
    assert.equal(first.displayDenom, "GONKA");
    assert.deepEqual(second, first);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validate surfaces a provider panic as a provider-side Gonka failure", async () => {
  const service = new GonkaService();
  const serviceInternals = service as unknown as ServiceInternals;

  serviceInternals.resolveBestModel = async () => ({
    model: "mock/model",
    candidates: ["mock/model"],
  });
  serviceInternals.probeConnection = async () => {
    const error = Object.assign(
      new Error(
        'Request failed for http://node2.gonka.ai:8000/v1/chat/completions: 500 {"error":"rpc error: code = Unknown desc = runtime error: invalid memory address or nil pointer dereference: panic"}',
      ),
      { status: 500 },
    );

    throw error;
  };

  await assert.rejects(
    service.validate(TEST_MNEMONIC),
    /accepted the signed request but the transfer agent crashed internally/i,
  );
});
