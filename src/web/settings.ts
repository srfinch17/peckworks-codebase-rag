import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { config } from "../config.js";

/**
 * Per-repo tuning knobs, persisted server-side so they carry across browsers on this machine.
 * The store is a single small JSON file; the path comes from SETTINGS_PATH (default
 * data/settings.json), read at call time so tests can redirect it to a temp file.
 */
export type RepoKnobs = { topK: number; minScore: number };

const KnobsSchema = z.object({ topK: z.number(), minScore: z.number() });
const FileSchema = z.object({
  lastRepo: z.string().nullable(),
  repos: z.record(z.string(), KnobsSchema),
});
type SettingsFile = z.infer<typeof FileSchema>;

/** A fresh empty settings object. Must be a factory, not a shared constant: callers mutate it. */
function empty(): SettingsFile {
  return { lastRepo: null, repos: {} };
}

function settingsPath(): string {
  return process.env.SETTINGS_PATH ?? "data/settings.json";
}

/**
 * Read and validate the settings file. A missing or malformed file (including a bad hand-edit)
 * is treated as empty so reads never throw. Same defensive posture as tryParseAnswer.
 */
function read(): SettingsFile {
  try {
    return FileSchema.parse(JSON.parse(readFileSync(settingsPath(), "utf8")));
  } catch {
    return empty();
  }
}

function write(data: SettingsFile): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/** Saved knobs for a repo, or the config defaults if it has never been tuned. */
export function getSettings(repo: string): RepoKnobs {
  const saved = read().repos[repo];
  return {
    topK: saved?.topK ?? config.topK,
    minScore: saved?.minScore ?? config.minScore,
  };
}

/** Persist a repo's knobs and record it as the most recently used repo. */
export function saveSettings(repo: string, knobs: RepoKnobs): void {
  const data = read();
  data.repos[repo] = knobs;
  data.lastRepo = repo;
  write(data);
}

/** The repo most recently saved, or null if nothing has been saved yet. */
export function getLastRepo(): string | null {
  return read().lastRepo;
}
