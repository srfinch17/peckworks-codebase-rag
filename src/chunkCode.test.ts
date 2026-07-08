import { describe, it, expect } from "vitest";
import { chunkCode } from "./chunkCode.js";
import { config } from "./config.js";

const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

describe("chunkCode", () => {
  it("returns a single chunk for a short file", () => {
    const chunks = chunkCode("clipmeta", "src/A.cs", lines(10));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.type).toBe("code");
    expect(chunks[0]!.repo).toBe("clipmeta");
    expect(chunks[0]!.path).toBe("src/A.cs");
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.endLine).toBe(10);
    expect(chunks[0]!.position).toBe(0);
  });

  it("splits long files into overlapping line windows with correct line numbers", () => {
    const total = config.codeChunkLines * 2 + 5;
    const chunks = chunkCode("r", "f.cs", lines(total));
    expect(chunks.length).toBeGreaterThan(1);
    // first window starts at line 1
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.endLine).toBe(config.codeChunkLines);
    // second window starts step lines later (1-based)
    const step = config.codeChunkLines - config.codeChunkOverlapLines;
    expect(chunks[1]!.startLine).toBe(1 + step);
    // positions sequential from 0
    chunks.forEach((c, i) => expect(c.position).toBe(i));
    // last chunk ends at the last line
    expect(chunks[chunks.length - 1]!.endLine).toBe(total);
    // unique ids
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });

  it("ignores whitespace-only input", () => {
    expect(chunkCode("r", "f.cs", "   \n  \n")).toHaveLength(0);
  });
});
