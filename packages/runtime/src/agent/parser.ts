import { ZodError } from "zod";
import { agentDecisionSchema, type AgentDecision } from "./types";

function stripCodeFence(raw: string) {
  const match = raw.trim().match(/^```(?:json)?\s*([\s\S]+?)\s*```$/i);
  return match?.[1]?.trim() ?? raw.trim();
}

function extractBalancedObject(raw: string) {
  const source = raw.trim();
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) {
        continue;
      }
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return source;
}

function normalizeJsonCandidate(raw: string) {
  return extractBalancedObject(stripCodeFence(raw));
}

function buildValidationError(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function parseAgentDecision(raw: string): AgentDecision {
  const candidate = normalizeJsonCandidate(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    throw new Error(`Agent response was not valid JSON. ${buildValidationError(error)}`);
  }

  try {
    return agentDecisionSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Agent response did not match the decision schema. ${buildValidationError(error)}`);
  }
}
