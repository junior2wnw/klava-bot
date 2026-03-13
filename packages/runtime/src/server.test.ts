import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ProviderBalance } from "@klava/contracts";
import { ComputerOperator } from "./computer-operator";
import { GeminiService } from "./gemini-service";
import { createKlavaRuntime } from "./server";
import { GonkaService } from "./gonka-service";
import { GroqService } from "./groq-service";
import { LocalAiService } from "./local-ai-service";
import { OpenAIService } from "./openai-service";
import { OpenRouterService } from "./openrouter-service";
import type { AppPaths } from "./storage";

const TEST_ADDRESS = "gonka1glph4syjlx347ptv2n7qfz67sryrhk983j5f8a";
const TEST_BALANCE: ProviderBalance = {
  denom: "ngonka",
  amount: "10000000000",
  displayAmount: "10",
  displayDenom: "GONKA",
  asOf: "2026-03-10T00:00:00.000Z",
  sourceUrl: "https://node3.gonka.ai",
};

async function withTempAppPaths(run: (paths: AppPaths) => Promise<void>) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "klava-runtime-test-"));
  const paths: AppPaths = {
    rootDir: tempRoot,
    statePath: path.join(tempRoot, "state.json"),
    secretsPath: path.join(tempRoot, "secrets.json"),
    keyPath: path.join(tempRoot, "vault.key"),
  };

  try {
    await run(paths);
  } finally {
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
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

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

test("openai onboarding stores the selected model and live model list in provider settings", async () => {
  const originalValidate = OpenAIService.prototype.validate;

  OpenAIService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "sk-test-openai");
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2", "gpt-5.2-mini", "gpt-4o-mini"],
    };
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const response = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-test-openai",
          },
        });

        assert.equal(response.statusCode, 200);

        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });

        assert.equal(workspace.statusCode, 200);
        const snapshot = workspace.json();
        assert.equal(snapshot.provider.provider, "openai");
        assert.equal(snapshot.provider.secretConfigured, true);
        assert.equal(snapshot.provider.model, "gpt-5.2");
        assert.deepEqual(snapshot.provider.availableModels, ["gpt-5.2", "gpt-5.2-mini", "gpt-4o-mini"]);
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
  }
});

test("gemini onboarding stores the selected model and provider endpoint", async () => {
  const originalValidate = GeminiService.prototype.validate;

  GeminiService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "gemini-test-key");
    return {
      model: "gemini-2.5-flash",
      models: ["gemini-2.5-flash", "gemini-2.0-flash"],
    };
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const response = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "gemini",
            secret: "gemini-test-key",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        assert.equal(snapshot.provider, "gemini");
        assert.equal(snapshot.model, "gemini-2.5-flash");

        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });

        const provider = workspace.json().provider;
        assert.equal(provider.provider, "gemini");
        assert.equal(provider.apiBaseUrl, "https://generativelanguage.googleapis.com/v1beta");
        assert.equal(provider.secretConfigured, true);
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    GeminiService.prototype.validate = originalValidate;
  }
});

test("gonka onboarding is intentionally paused and returns a provider-side status message", async () => {
  await withTempAppPaths(async (paths) => {
    const runtime = await createKlavaRuntime({ paths });

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

      assert.equal(response.statusCode, 400);
      assert.match(response.json().message, /paused/i);
    } finally {
      await runtime.stop();
    }
  });
});

test("chat messages go through the configured openai provider", async () => {
  const originalValidate = OpenAIService.prototype.validate;
  const originalComplete = OpenAIService.prototype.complete;

  OpenAIService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "sk-chat-path");
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2", "gpt-5.2-mini"],
    };
  };
  OpenAIService.prototype.complete = async function complete({ model, messages }) {
    assert.equal(model, "gpt-5.2");
    assert.equal(messages.at(-1)?.content, "Say hi");
    return "OpenAI path is working.";
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-chat-path",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const taskId = workspace.json().selectedTask.id as string;

        const response = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "Say hi",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        assert.equal(snapshot.selectedTask.messages.at(-1).content, "OpenAI path is working.");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.complete = originalComplete;
  }
});

test("chat messages go through the configured groq provider", async () => {
  const originalValidate = GroqService.prototype.validate;
  const originalComplete = GroqService.prototype.complete;

  GroqService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "gsk-test-groq");
    return {
      model: "llama-3.1-8b-instant",
      models: ["llama-3.1-8b-instant", "openai/gpt-oss-20b"],
    };
  };
  GroqService.prototype.complete = async function complete({ secret, model, messages }) {
    assert.equal(secret, "gsk-test-groq");
    assert.equal(model, "llama-3.1-8b-instant");
    assert.equal(messages.at(-1)?.content, "Say hi from Groq");
    return "Groq path is working.";
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "groq",
            secret: "gsk-test-groq",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const taskId = workspace.json().selectedTask.id as string;

        const response = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "Say hi from Groq",
          },
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.json().selectedTask.messages.at(-1).content, "Groq path is working.");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    GroqService.prototype.validate = originalValidate;
    GroqService.prototype.complete = originalComplete;
  }
});

test("manual provider model selection switches openai into manual mode", async () => {
  const originalValidate = OpenAIService.prototype.validate;
  const originalValidateModel = OpenAIService.prototype.validateModel;

  OpenAIService.prototype.validate = async function validate() {
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2", "gpt-5.2-mini"],
    };
  };
  OpenAIService.prototype.validateModel = async function validateModel(secret: string, model: string) {
    assert.equal(secret, "sk-model-select");
    assert.equal(model, "gpt-5.2-mini");
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-model-select",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const response = await runtime.server.inject({
          method: "POST",
          url: "/api/provider/model",
          payload: {
            model: "gpt-5.2-mini",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        assert.equal(snapshot.provider.selectionMode, "manual");
        assert.equal(snapshot.provider.model, "gpt-5.2-mini");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.validateModel = originalValidateModel;
  }
});

test("manual provider model selection works for openrouter free-model routes", async () => {
  const originalValidate = OpenRouterService.prototype.validate;
  const originalValidateModel = OpenRouterService.prototype.validateModel;

  OpenRouterService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "sk-or-test");
    return {
      model: "openrouter/free",
      models: ["openrouter/free", "meta-llama/llama-3.1-8b-instruct:free"],
    };
  };
  OpenRouterService.prototype.validateModel = async function validateModel(secret: string, model: string) {
    assert.equal(secret, "sk-or-test");
    assert.equal(model, "meta-llama/llama-3.1-8b-instruct:free");
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openrouter",
            secret: "sk-or-test",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const response = await runtime.server.inject({
          method: "POST",
          url: "/api/provider/model",
          payload: {
            model: "meta-llama/llama-3.1-8b-instruct:free",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        assert.equal(snapshot.provider.provider, "openrouter");
        assert.equal(snapshot.provider.selectionMode, "manual");
        assert.equal(snapshot.provider.model, "meta-llama/llama-3.1-8b-instruct:free");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenRouterService.prototype.validate = originalValidate;
    OpenRouterService.prototype.validateModel = originalValidateModel;
  }
});

test("invalid manual model selection is rejected before the provider state is changed", async () => {
  const originalValidate = OpenAIService.prototype.validate;
  const originalValidateModel = OpenAIService.prototype.validateModel;

  OpenAIService.prototype.validate = async function validate() {
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2", "gpt-broken-preview"],
    };
  };
  OpenAIService.prototype.validateModel = async function validateModel(_secret: string, model: string) {
    assert.equal(model, "gpt-broken-preview");
    throw new Error("The selected OpenAI model does not support Klava's current chat path for this API key.");
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-broken-model",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const response = await runtime.server.inject({
          method: "POST",
          url: "/api/provider/model",
          payload: {
            model: "gpt-broken-preview",
          },
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.json().message, /does not support/i);

        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const snapshot = workspace.json();
        assert.equal(snapshot.provider.selectionMode, "auto");
        assert.equal(snapshot.provider.model, "gpt-5.2");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.validateModel = originalValidateModel;
  }
});

test("automatic provider selection can be restored after a manual pin", async () => {
  const originalValidate = OpenAIService.prototype.validate;
  const originalValidateModel = OpenAIService.prototype.validateModel;
  const originalListModels = OpenAIService.prototype.listModels;

  OpenAIService.prototype.validate = async function validate() {
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2", "gpt-5.2-mini"],
    };
  };
  OpenAIService.prototype.validateModel = async function validateModel() {};
  OpenAIService.prototype.listModels = async function listModels(secret: string) {
    assert.equal(secret, "sk-auto-model");
    return ["gpt-4o-mini", "gpt-5.2-mini"];
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-auto-model",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const manual = await runtime.server.inject({
          method: "POST",
          url: "/api/provider/model",
          payload: {
            model: "gpt-5.2-mini",
          },
        });

        assert.equal(manual.statusCode, 200);
        assert.equal(manual.json().provider.selectionMode, "manual");

        const automatic = await runtime.server.inject({
          method: "POST",
          url: "/api/provider/model/auto",
        });

        assert.equal(automatic.statusCode, 200);
        const snapshot = automatic.json();
        assert.equal(snapshot.provider.selectionMode, "auto");
        assert.equal(snapshot.provider.model, "gpt-4o-mini");
        assert.deepEqual(snapshot.provider.availableModels, ["gpt-4o-mini", "gpt-5.2-mini"]);
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.validateModel = originalValidateModel;
    OpenAIService.prototype.listModels = originalListModels;
  }
});

test("provider reset clears the saved openai configuration and returns the runtime to onboarding state", async () => {
  const originalValidate = OpenAIService.prototype.validate;

  OpenAIService.prototype.validate = async function validate() {
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2", "gpt-5.2-mini"],
    };
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-reset-provider",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const reset = await runtime.server.inject({
          method: "POST",
          url: "/api/provider/reset",
        });

        assert.equal(reset.statusCode, 200);
        const snapshot = reset.json();
        assert.equal(snapshot.provider.provider, "openai");
        assert.equal(snapshot.provider.secretConfigured, false);
        assert.equal(snapshot.provider.selectionMode, "auto");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
  }
});

test("local ollama onboarding works without an API key and chat requests use the local endpoint", async () => {
  const originalValidate = LocalAiService.prototype.validate;
  const originalComplete = LocalAiService.prototype.complete;

  LocalAiService.prototype.validate = async function validate(config) {
    assert.equal(config.localRuntime, "ollama");
    assert.equal(config.secret, null);
    assert.equal(config.apiBaseUrl, "http://127.0.0.1:11434/v1");
    return {
      model: "qwen2.5:7b",
      models: ["qwen2.5:7b", "llama3.2:3b"],
    };
  };
  LocalAiService.prototype.complete = async function complete(config) {
    assert.equal(config.localRuntime, "ollama");
    assert.equal(config.apiBaseUrl, "http://127.0.0.1:11434/v1");
    assert.equal(config.model, "qwen2.5:7b");
    assert.equal(config.messages.at(-1)?.content, "Local hello");
    return "Local provider path is working.";
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "local",
            localRuntime: "ollama",
            apiBaseUrl: "http://127.0.0.1:11434/v1",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const provider = workspace.json().provider;
        const taskId = workspace.json().selectedTask.id as string;

        assert.equal(provider.provider, "local");
        assert.equal(provider.localRuntime, "ollama");
        assert.equal(provider.apiBaseUrl, "http://127.0.0.1:11434/v1");
        assert.equal(provider.secretConfigured, true);

        const response = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "Local hello",
          },
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.json().selectedTask.messages.at(-1).content, "Local provider path is working.");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    LocalAiService.prototype.validate = originalValidate;
    LocalAiService.prototype.complete = originalComplete;
  }
});

test("natural-language computer diagnostics bypass provider chat and use the local operator path", async () => {
  const originalHandle = ComputerOperator.prototype.handle;
  const originalValidate = OpenAIService.prototype.validate;
  const originalComplete = OpenAIService.prototype.complete;

  ComputerOperator.prototype.handle = async function handle(input: string) {
    assert.equal(input, "check my mouse driver");
    return {
      kind: "answer",
      status: "succeeded",
      skill: "driver_inspection",
      intent: "inspect_driver",
      toolMessage: "Local driver inspection matched.",
      assistantMessage: "Mouse driver version 1.2.3 is installed locally.",
    };
  };
  OpenAIService.prototype.validate = async function validate() {
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2"],
    };
  };
  OpenAIService.prototype.complete = async function complete() {
    throw new Error("provider chat should not have been called for a local computer skill");
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboarding = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-local-skill",
          },
        });

        assert.equal(onboarding.statusCode, 200);

        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const taskId = workspace.json().selectedTask.id as string;

        const response = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "check my mouse driver",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        const messages = snapshot.selectedTask.messages;
        assert.equal(messages.at(-2).role, "tool");
        assert.equal(messages.at(-2).meta.computerSkill, "driver_inspection");
        assert.equal(messages.at(-2).meta.computerIntent, "inspect_driver");
        assert.equal(messages.at(-1).content, "Mouse driver version 1.2.3 is installed locally.");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    ComputerOperator.prototype.handle = originalHandle;
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.complete = originalComplete;
  }
});

test("natural-language package installs route into guarded terminal approvals", async () => {
  const originalHandle = ComputerOperator.prototype.handle;

  ComputerOperator.prototype.handle = async function handle(input: string) {
    assert.equal(input, "install git");
    return {
      kind: "command",
      skill: "package_management",
      intent: "package_action",
      toolMessage: "Matched a package-management request for Git.",
      assistantMessage: "Git install command is ready and will be guarded.",
      command:
        "winget install --id Git.Git --exact --accept-package-agreements --accept-source-agreements --disable-interactivity",
    };
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const workspace = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const taskId = workspace.json().selectedTask.id as string;

        const response = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "install git",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        assert.equal(snapshot.selectedTask.status, "awaiting_approval");
        assert.equal(snapshot.selectedTask.approvals.length, 1);
        assert.equal(snapshot.selectedTask.approvals[0].status, "pending");
        assert.equal(
          snapshot.selectedTask.approvals[0].command,
          "winget install --id Git.Git --exact --accept-package-agreements --accept-source-agreements --disable-interactivity",
        );
        assert.equal(snapshot.selectedTask.messages.at(-3).meta.computerSkill, "package_management");
        assert.equal(snapshot.selectedTask.messages.at(-3).meta.computerIntent, "package_action");
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    ComputerOperator.prototype.handle = originalHandle;
  }
});

test("support bundle includes the runtime log tail for diagnostics", async () => {
  await withTempAppPaths(async (paths) => {
    const runtime = await createKlavaRuntime({ paths });

    try {
      const response = await runtime.server.inject({
        method: "GET",
        url: "/api/support-bundle",
      });

      assert.equal(response.statusCode, 200);
      const bundle = response.json();
      assert.match(bundle.logs.path, /runtime\.log$/i);
      assert.ok(Array.isArray(bundle.logs.recentEvents));
      assert.ok(bundle.logs.recentEvents.length >= 1);
      assert.equal(typeof bundle.machineProfile.platform, "string");
      assert.equal(typeof bundle.localRuntimeAdvice.summary, "string");
    } finally {
      await runtime.stop();
    }
  });
});

test("guarded terminal commands create approvals and rejection returns the task to idle", async () => {
  await withTempAppPaths(async (paths) => {
    const runtime = await createKlavaRuntime({ paths });

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

test("chat confirmation shortcuts approve the latest pending guarded command", async () => {
  await withTempAppPaths(async (paths) => {
    const runtime = await createKlavaRuntime({ paths });

    try {
      const createTaskResponse = await runtime.server.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Approval shortcut approve",
        },
      });

      assert.equal(createTaskResponse.statusCode, 200);
      const taskId = createTaskResponse.json().selectedTask.id as string;

      const guardedResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/terminal`,
        payload: {
          command: "Move-Item .\\definitely-missing-file .\\still-missing-file",
        },
      });

      assert.equal(guardedResponse.statusCode, 200);
      assert.equal(guardedResponse.json().selectedTask.approvals[0].status, "pending");

      const confirmResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/messages`,
        payload: {
          content: "yes",
        },
      });

      assert.equal(confirmResponse.statusCode, 200);
      const snapshot = confirmResponse.json();
      assert.equal(snapshot.selectedTask.approvals[0].status, "approved");
      assert.equal(snapshot.selectedTask.pendingApprovalCount, 0);
      assert.match(
        snapshot.selectedTask.messages.map((message: { content: string }) => message.content).join("\n"),
        /approval granted/i,
      );
    } finally {
      await runtime.stop();
    }
  });
});

test("chat messages do not loop back into the provider while a guarded approval is pending", async () => {
  await withTempAppPaths(async (paths) => {
    const runtime = await createKlavaRuntime({ paths });

    try {
      const createTaskResponse = await runtime.server.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Approval shortcut hold",
        },
      });

      assert.equal(createTaskResponse.statusCode, 200);
      const taskId = createTaskResponse.json().selectedTask.id as string;

      const guardedResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/terminal`,
        payload: {
          command: "winget install example-package",
        },
      });

      assert.equal(guardedResponse.statusCode, 200);

      const followUpResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/messages`,
        payload: {
          content: "what now?",
        },
      });

      assert.equal(followUpResponse.statusCode, 200);
      const snapshot = followUpResponse.json();
      assert.equal(snapshot.selectedTask.approvals[0].status, "pending");
      assert.match(snapshot.selectedTask.messages.at(-1).content, /waiting for approval|reply with.*yes.*no/i);
    } finally {
      await runtime.stop();
    }
  });
});

test("operations can execute note and terminal steps across multiple advances", async () => {
  await withTempAppPaths(async (paths) => {
    const runtime = await createKlavaRuntime({ paths });

    try {
      const createTaskResponse = await runtime.server.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Operation flow",
        },
      });

      assert.equal(createTaskResponse.statusCode, 200);
      const createdSnapshot = createTaskResponse.json();
      const taskId = createdSnapshot.selectedTask.id as string;

      const createOperationResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/operations`,
        payload: {
          title: "Repo audit runbook",
          goal: "Prove that Klava can keep a multi-step local workflow in one task.",
          steps: [
            {
              title: "Write the operator note",
              detail: "Document the intention before the terminal work starts.",
              command: null,
            },
            {
              title: "Run a terminal step",
              detail: "Execute a safe local command and attach the output to the task.",
              command: "node -e \"console.log('operation ok')\"",
            },
          ],
        },
      });

      assert.equal(createOperationResponse.statusCode, 200);
      const operationSnapshot = createOperationResponse.json();
      const operationId = operationSnapshot.selectedTask.operations[0].id as string;

      const noteAdvanceResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/operations/${operationId}/advance`,
      });

      assert.equal(noteAdvanceResponse.statusCode, 200);
      const noteAdvanceSnapshot = noteAdvanceResponse.json();
      assert.equal(noteAdvanceSnapshot.selectedTask.operations[0].steps[0].status, "succeeded");
      assert.equal(noteAdvanceSnapshot.selectedTask.operations[0].status, "running");

      const commandAdvanceResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/operations/${operationId}/advance`,
      });

      assert.equal(commandAdvanceResponse.statusCode, 200);
      const commandAdvanceSnapshot = commandAdvanceResponse.json();
      assert.equal(commandAdvanceSnapshot.selectedTask.operations[0].steps[1].status, "succeeded");
      assert.equal(commandAdvanceSnapshot.selectedTask.operations[0].status, "succeeded");
      assert.equal(commandAdvanceSnapshot.selectedTask.terminalEntries.length, 1);
    } finally {
      await runtime.stop();
    }
  });
});

test("operation guarded steps stay linked to approval rejection", async () => {
  await withTempAppPaths(async (paths) => {
    const runtime = await createKlavaRuntime({ paths });

    try {
      const createTaskResponse = await runtime.server.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Operation guard flow",
        },
      });

      assert.equal(createTaskResponse.statusCode, 200);
      const createdSnapshot = createTaskResponse.json();
      const taskId = createdSnapshot.selectedTask.id as string;

      const createOperationResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/operations`,
        payload: {
          title: "Guarded install proof",
          goal: "Show that risky machine changes stop in approvals even inside a multi-step operation.",
          steps: [
            {
              title: "Attempt package install",
              detail: "This should stop behind a pending approval.",
              command: "winget install example-package",
            },
          ],
        },
      });

      assert.equal(createOperationResponse.statusCode, 200);
      const operationSnapshot = createOperationResponse.json();
      const operationId = operationSnapshot.selectedTask.operations[0].id as string;

      const advanceResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/tasks/${taskId}/operations/${operationId}/advance`,
      });

      assert.equal(advanceResponse.statusCode, 200);
      const awaitingSnapshot = advanceResponse.json();
      assert.equal(awaitingSnapshot.selectedTask.operations[0].status, "awaiting_approval");
      assert.equal(awaitingSnapshot.selectedTask.operations[0].steps[0].status, "awaiting_approval");

      const approvalId = awaitingSnapshot.selectedTask.approvals[0].id as string;
      const rejectResponse = await runtime.server.inject({
        method: "POST",
        url: `/api/approvals/${approvalId}/reject`,
      });

      assert.equal(rejectResponse.statusCode, 200);
      const rejectedSnapshot = rejectResponse.json();
      assert.equal(rejectedSnapshot.selectedTask.operations[0].status, "failed");
      assert.equal(rejectedSnapshot.selectedTask.operations[0].steps[0].status, "failed");
    } finally {
      await runtime.stop();
    }
  });
});

test("chat messages can drive an autonomous agent pass with filesystem tools", async () => {
  const originalValidate = OpenAIService.prototype.validate;
  const originalComplete = OpenAIService.prototype.complete;
  let callCount = 0;

  OpenAIService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "sk-agent-files");
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2"],
    };
  };

  OpenAIService.prototype.complete = async function complete({ messages }) {
    const joined = messages.map((message) => `${message.role}:${message.content}`).join("\n");
    assert.match(joined, /Klava Agent mode/i);
    callCount += 1;

    if (callCount === 1) {
      return JSON.stringify({
        kind: "tool",
        summary: "Read the package manifest",
        message: "Checking package.json before I answer.",
        plan: [
          { title: "Read package manifest", status: "running" },
          { title: "Report the package name", status: "pending" },
        ],
        tool: {
          name: "filesystem.read",
          path: "package.json",
          maxLines: 40,
        },
      });
    }

    return JSON.stringify({
      kind: "final",
      summary: "Package manifest verified",
      message: "The package name is `@klava/runtime`.",
      plan: [
        { title: "Read package manifest", status: "completed" },
        { title: "Report the package name", status: "completed" },
      ],
    });
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboardingResponse = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-agent-files",
          },
        });

        assert.equal(onboardingResponse.statusCode, 200);
        const workspaceResponse = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const taskId = workspaceResponse.json().selectedTask.id as string;

        const response = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "inspect package.json and tell me the package name",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        assert.equal(snapshot.selectedTask.agentRuns[0].status, "succeeded");
        assert.equal(snapshot.selectedTask.agentRuns[0].toolCalls[0].kind, "filesystem.read");
        assert.match(snapshot.selectedTask.agentRuns[0].toolCalls[0].outputPreview, /\"name\":\s*\"@klava\/runtime\"/i);
        assert.match(snapshot.selectedTask.messages.at(-1).content, /@klava\/runtime/i);
        assert.equal(callCount, 2);
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.complete = originalComplete;
  }
});

test("agent runs auto-resume after approval and keep the tool call linked to the approval", async () => {
  const originalValidate = OpenAIService.prototype.validate;
  const originalComplete = OpenAIService.prototype.complete;
  let callCount = 0;

  OpenAIService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "sk-agent-approve");
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2"],
    };
  };

  OpenAIService.prototype.complete = async function complete({ messages }) {
    const joined = messages.map((message) => `${message.role}:${message.content}`).join("\n");
    assert.match(joined, /Klava Agent mode/i);
    callCount += 1;

    if (callCount === 1) {
      return JSON.stringify({
        kind: "tool",
        summary: "Run a guarded shell probe",
        message: "Preparing a guarded command to verify approval and continuation.",
        plan: [
          { title: "Run guarded shell probe", status: "running" },
          { title: "Summarize the result", status: "pending" },
        ],
        tool: {
          name: "shell.command",
          command: "sudo echo hi",
          reason: "Use a harmless guarded command to exercise approval routing.",
        },
      });
    }

    assert.match(joined, /sudo echo hi/i);
    return JSON.stringify({
      kind: "final",
      summary: "Approval path exercised",
      message: "The guarded command was approved, executed, and the agent resumed automatically.",
      plan: [
        { title: "Run guarded shell probe", status: "completed" },
        { title: "Summarize the result", status: "completed" },
      ],
    });
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboardingResponse = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-agent-approve",
          },
        });

        assert.equal(onboardingResponse.statusCode, 200);
        const workspaceResponse = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const taskId = workspaceResponse.json().selectedTask.id as string;

        const requestResponse = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "exercise a guarded shell action and continue automatically",
          },
        });

        assert.equal(requestResponse.statusCode, 200);
        const awaitingSnapshot = requestResponse.json();
        assert.equal(awaitingSnapshot.selectedTask.agentRuns[0].status, "awaiting_approval");
        const approvalId = awaitingSnapshot.selectedTask.approvals[0].id as string;

        const approveResponse = await runtime.server.inject({
          method: "POST",
          url: `/api/approvals/${approvalId}/approve`,
        });

        assert.equal(approveResponse.statusCode, 200);
        const approvedSnapshot = approveResponse.json();
        assert.equal(approvedSnapshot.selectedTask.approvals[0].status, "approved");
        assert.equal(approvedSnapshot.selectedTask.agentRuns[0].status, "succeeded");
        assert.equal(approvedSnapshot.selectedTask.agentRuns[0].toolCalls[0].approvalId, approvalId);
        assert.match(approvedSnapshot.selectedTask.messages.at(-1).content, /resumed automatically/i);
        assert.equal(callCount, 2);
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.complete = originalComplete;
  }
});

test("unsafe piracy goals are blocked before the provider can execute an agent pass", async () => {
  const originalValidate = OpenAIService.prototype.validate;
  const originalComplete = OpenAIService.prototype.complete;
  let providerCalled = false;

  OpenAIService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "sk-agent-safety");
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2"],
    };
  };
  OpenAIService.prototype.complete = async function complete() {
    providerCalled = true;
    return "should not be called";
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboardingResponse = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-agent-safety",
          },
        });

        assert.equal(onboardingResponse.statusCode, 200);
        const workspaceResponse = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const taskId = workspaceResponse.json().selectedTask.id as string;

        const response = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "find a torrent for this movie and download it",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        assert.equal(snapshot.selectedTask.agentRuns[0].status, "blocked");
        assert.match(snapshot.selectedTask.messages.at(-1).content, /will not help/i);
        assert.equal(providerCalled, false);
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.complete = originalComplete;
  }
});

test("agent protocol failures fall back to plain provider chat", async () => {
  const originalValidate = OpenAIService.prototype.validate;
  const originalComplete = OpenAIService.prototype.complete;

  OpenAIService.prototype.validate = async function validate(secret: string) {
    assert.equal(secret, "sk-agent-fallback");
    return {
      model: "gpt-5.2",
      models: ["gpt-5.2"],
    };
  };
  OpenAIService.prototype.complete = async function complete({ messages }) {
    const joined = messages.map((message) => `${message.role}:${message.content}`).join("\n");
    if (/Klava Agent mode/i.test(joined)) {
      return "not valid agent json";
    }

    return "Plain provider fallback works.";
  };

  try {
    await withTempAppPaths(async (paths) => {
      const runtime = await createKlavaRuntime({ paths });

      try {
        const onboardingResponse = await runtime.server.inject({
          method: "POST",
          url: "/api/onboarding/validate",
          payload: {
            provider: "openai",
            secret: "sk-agent-fallback",
          },
        });

        assert.equal(onboardingResponse.statusCode, 200);
        const workspaceResponse = await runtime.server.inject({
          method: "GET",
          url: "/api/workspace",
        });
        const taskId = workspaceResponse.json().selectedTask.id as string;

        const response = await runtime.server.inject({
          method: "POST",
          url: `/api/tasks/${taskId}/messages`,
          payload: {
            content: "say hi in plain chat",
          },
        });

        assert.equal(response.statusCode, 200);
        const snapshot = response.json();
        assert.equal(snapshot.selectedTask.agentRuns[0].status, "failed");
        assert.match(snapshot.selectedTask.messages.at(-1).content, /plain provider fallback works/i);
      } finally {
        await runtime.stop();
      }
    });
  } finally {
    OpenAIService.prototype.validate = originalValidate;
    OpenAIService.prototype.complete = originalComplete;
  }
});

const TEST_MNEMONIC_PLACEHOLDER = "test recovery phrase";
