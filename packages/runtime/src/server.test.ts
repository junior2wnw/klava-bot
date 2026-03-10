import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ProviderBalance } from "@klava/contracts";
import { createKlavaRuntime } from "./server";
import { GonkaService } from "./gonka-service";

const TEST_ADDRESS = "gonka1glph4syjlx347ptv2n7qfz67sryrhk983j5f8a";
const TEST_BALANCE: ProviderBalance = {
  denom: "ngonka",
  amount: "10000000000",
  displayAmount: "10",
  displayDenom: "GONKA",
  asOf: "2026-03-10T00:00:00.000Z",
  sourceUrl: "https://node3.gonka.ai",
};

async function withTempAppData(run: () => Promise<void>) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "klava-runtime-test-"));
  const originalAppData = process.env.APPDATA;
  process.env.APPDATA = tempRoot;

  try {
    await run();
  } finally {
    process.env.APPDATA = originalAppData;
    await rm(tempRoot, { recursive: true, force: true });
  }
}

test("runtime exposes public Gonka balance lookup without onboarding", async () => {
  const originalGetBalance = GonkaService.prototype.getBalance;
  GonkaService.prototype.getBalance = async function getBalance(address: string) {
    assert.equal(address, TEST_ADDRESS);
    return TEST_BALANCE;
  };

  try {
    await withTempAppData(async () => {
      const runtime = await createKlavaRuntime();

      try {
        const response = await runtime.server.inject({
          method: "GET",
          url: `/api/gonka/balance?address=${TEST_ADDRESS}`,
        });

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.json(), {
          ok: true,
          address: TEST_ADDRESS,
          balance: TEST_BALANCE,
        });
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    GonkaService.prototype.getBalance = originalGetBalance;
  }
});

test("successful onboarding stores requester address and fetched balance in provider settings", async () => {
  const originalValidate = GonkaService.prototype.validate;
  const originalGetBalance = GonkaService.prototype.getBalance;

  GonkaService.prototype.validate = async function validate(secret: string, options = {}) {
    assert.equal(secret, TEST_MNEMONIC_PLACEHOLDER);
    assert.equal(options.expectedAddress, TEST_ADDRESS);
    return {
      model: "mock/model",
      candidates: ["mock/model"],
      requesterAddress: TEST_ADDRESS,
      resolvedSecret: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    };
  };
  GonkaService.prototype.getBalance = async function getBalance(address: string) {
    assert.equal(address, TEST_ADDRESS);
    return TEST_BALANCE;
  };

  try {
    await withTempAppData(async () => {
      const runtime = await createKlavaRuntime();

      try {
        const response = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "gonka",
            secret: TEST_MNEMONIC_PLACEHOLDER,
            walletAddress: TEST_ADDRESS,
          },
        });

        assert.equal(response.statusCode, 200);

        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });

        assert.equal(workspace.statusCode, 200);
        const snapshot = workspace.json();
        assert.equal(snapshot.provider.secretConfigured, true);
        assert.equal(snapshot.provider.requesterAddress, TEST_ADDRESS);
        assert.deepEqual(snapshot.provider.balance, TEST_BALANCE);
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    GonkaService.prototype.validate = originalValidate;
    GonkaService.prototype.getBalance = originalGetBalance;
  }
});

test("guarded terminal commands create approvals and rejection returns the task to idle", async () => {
  await withTempAppData(async () => {
    const runtime = await createKlavaRuntime();

    try {
      const createTaskResponse = await runtime.server.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Guard flow",
        },
      });

      assert.equal(createTaskResponse.statusCode, 200);
      const createdSnapshot = createTaskResponse.json();
      const taskId = createdSnapshot.selectedTask.id as string;

      const guardedResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/terminal`,
        payload: {
          command: "winget install example-package",
        },
      });

      assert.equal(guardedResponse.statusCode, 200);
      const guardedSnapshot = guardedResponse.json();
      assert.equal(guardedSnapshot.selectedTask.status, "awaiting_approval");
      assert.equal(guardedSnapshot.selectedTask.approvals.length, 1);
      assert.equal(guardedSnapshot.selectedTask.approvals[0].status, "pending");

      const approvalId = guardedSnapshot.selectedTask.approvals[0].id as string;
      const rejectResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/approvals/${approvalId}/reject`,
      });

      assert.equal(rejectResponse.statusCode, 200);
      const rejectedSnapshot = rejectResponse.json();
      assert.equal(rejectedSnapshot.selectedTask.status, "idle");
      assert.equal(rejectedSnapshot.selectedTask.approvals[0].status, "rejected");
    } finally {
      await runtime.stop();
    }
  });
});

const TEST_MNEMONIC_PLACEHOLDER = "test recovery phrase";
