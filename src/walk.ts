import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface WalkedFile {
  absPath: string;
  relPath: string; // forward-slash, repo-relative
}

/** Directory names we always skip (build output, vendored deps, tool state, VCS). */
export const DEFAULT_IGNORE_DIRS: ReadonlySet<string> = new Set([
  ".git", "node_modules", "bin", "obj", "dist", "build", "out",
  ".vs", ".vscode", ".idea", "packages", "TestResults",
  ".qdrant_storage", ".cache", "logs",
]);

/**
 * A deliberately simple .gitignore matcher. Supports: comments/blank lines, plain names
 * (match basename), trailing-slash directory entries, and `*.ext` suffix globs. NOT supported
 * (documented in PITFALLS): negation (!), **, path anchoring, nested .gitignore files.
 */
function loadIgnoreRules(root: string): {
  dirNames: Set<string>;
  baseNames: Set<string>;
  extGlobs: string[]; // e.g. ".env" for "*.env"
} {
  const dirNames = new Set<string>();
  const baseNames = new Set<string>();
  const extGlobs: string[] = [];
  const gitignore = join(root, ".gitignore");
  if (!existsSync(gitignore)) return { dirNames, baseNames, extGlobs };

  for (const raw of readFileSync(gitignore, "utf8").split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#") || line.startsWith("!")) continue;
    const noLead = line.replace(/^\//, ""); // strip a leading anchor; treat as basename
    if (noLead.endsWith("/")) {
      dirNames.add(noLead.slice(0, -1));
    } else if (noLead.startsWith("*.")) {
      extGlobs.push(noLead.slice(1)); // "*.env" -> ".env"
    } else if (!noLead.includes("/")) {
      baseNames.add(noLead);
    }
    // patterns containing a slash (other than trailing) are ignored - see PITFALLS.
  }
  return { dirNames, baseNames, extGlobs };
}

/** Recursively list files under root, applying the built-in + .gitignore skips. */
export function walkRepo(root: string): WalkedFile[] {
  const rules = loadIgnoreRules(root);
  const out: WalkedFile[] = [];

  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      const abs = join(dir, name);
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(name) || rules.dirNames.has(name)) continue;
        visit(abs);
      } else if (entry.isFile()) {
        if (rules.baseNames.has(name)) continue;
        if (rules.extGlobs.some((ext) => name.endsWith(ext))) continue;
        out.push({ absPath: abs, relPath: relative(root, abs).split(sep).join("/") });
      }
    }
  };

  visit(root);
  return out;
}
