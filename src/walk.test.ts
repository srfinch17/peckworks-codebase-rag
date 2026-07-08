import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { walkRepo } from "./walk.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "walk-"));
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
  mkdirSync(join(root, "bin"), { recursive: true });
  mkdirSync(join(root, "logs"), { recursive: true });
  writeFileSync(join(root, "src", "A.cs"), "class A {}");
  writeFileSync(join(root, "README.md"), "# hi");
  writeFileSync(join(root, "node_modules", "pkg", "x.js"), "x");
  writeFileSync(join(root, "bin", "out.dll"), "binary");
  writeFileSync(join(root, "logs", "run.log"), "noisy");
  writeFileSync(join(root, "secret.env"), "KEY=1");
  writeFileSync(join(root, ".gitignore"), "logs/\n*.env\n");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("walkRepo", () => {
  it("includes normal files with forward-slash relPaths", () => {
    const rels = walkRepo(root).map((f) => f.relPath).sort();
    expect(rels).toContain("src/A.cs");
    expect(rels).toContain("README.md");
  });

  it("skips the built-in ignore dirs (node_modules, bin)", () => {
    const rels = walkRepo(root).map((f) => f.relPath);
    expect(rels.some((r) => r.startsWith("node_modules/"))).toBe(false);
    expect(rels.some((r) => r.startsWith("bin/"))).toBe(false);
  });

  it("honors simple .gitignore rules (dir entry + *.ext glob)", () => {
    const rels = walkRepo(root).map((f) => f.relPath);
    expect(rels.some((r) => r.startsWith("logs/"))).toBe(false); // logs/ dir entry
    expect(rels).not.toContain("secret.env"); // *.env glob
  });
});
