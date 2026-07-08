import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSettings, saveSettings, getLastRepo } from "./settings.js";

/**
 * The settings module reads its file path from SETTINGS_PATH at call time, so each test points
 * it at a throwaway temp file. This keeps the pure logic (defaulting, per-repo isolation, bad-file
 * fallback) unit-testable without touching the real data/settings.json.
 */
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rag-settings-"));
  process.env.SETTINGS_PATH = join(dir, "settings.json");
});

afterEach(() => {
  delete process.env.SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("settings", () => {
  it("returns config defaults for an unknown repo", () => {
    expect(getSettings("clipmeta")).toEqual({ topK: 8, minScore: 0.25 });
  });

  it("round-trips saved knobs per repo", () => {
    saveSettings("clipmeta", { topK: 5, minScore: 0.4 });
    expect(getSettings("clipmeta")).toEqual({ topK: 5, minScore: 0.4 });
  });

  it("keeps repos isolated", () => {
    saveSettings("clipmeta", { topK: 5, minScore: 0.4 });
    expect(getSettings("other")).toEqual({ topK: 8, minScore: 0.25 });
  });

  it("records lastRepo on save", () => {
    saveSettings("clipmeta", { topK: 5, minScore: 0.4 });
    expect(getLastRepo()).toBe("clipmeta");
  });

  it("falls back to defaults on a corrupted file", () => {
    writeFileSync(process.env.SETTINGS_PATH!, "{ not json");
    expect(getSettings("clipmeta")).toEqual({ topK: 8, minScore: 0.25 });
    expect(getLastRepo()).toBe(null);
  });
});
