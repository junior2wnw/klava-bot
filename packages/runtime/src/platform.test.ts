import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveAppRootDir } from "./storage";
import { assessCommand } from "./terminal";

test("resolveAppRootDir uses Application Support on macOS", () => {
  const rootDir = resolveAppRootDir({
    platform: "darwin",
    homeDir: "/Users/klava",
  });

  assert.equal(rootDir, path.join("/Users/klava", "Library", "Application Support", "Klava Bot"));
});

test("resolveAppRootDir uses XDG data home on Linux", () => {
  const rootDir = resolveAppRootDir({
    platform: "linux",
    homeDir: "/home/klava",
    xdgDataHome: "/home/klava/.xdg-data",
  });

  assert.equal(rootDir, path.join("/home/klava/.xdg-data", "Klava Bot"));
});

test("assessCommand guards macOS package management and elevated shell execution", () => {
  assert.deepEqual(assessCommand("brew install ffmpeg"), {
    kind: "guarded",
    reason: "package management changes the system state",
  });

  assert.deepEqual(assessCommand("sudo launchctl kickstart -k system/com.example.service"), {
    kind: "guarded",
    reason: "elevated shell execution is guarded",
  });
});
