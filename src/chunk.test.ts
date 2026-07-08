import { describe, it, expect } from "vitest";
import { chunkText } from "./chunk.js";
import { config } from "./config.js";

describe("chunkText", () => {
  it("returns a single doc chunk for short text, starting at line 1", () => {
    const chunks = chunkText("r", "README.md", "hello\nworld");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.type).toBe("doc");
    expect(chunks[0]!.path).toBe("README.md");
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.endLine).toBe(2);
    expect(chunks[0]!.position).toBe(0);
  });

  it("splits long text into overlapping windows with sequential positions", () => {
    const text = "x".repeat(config.textChunkSize * 3);
    const chunks = chunkText("r", "d.md", text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.position).toBe(i));
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });

  it("computes line numbers from offsets for multi-line docs", () => {
    // 10 lines of 200 chars each = 2000 chars; with size 800 the first window covers
    // roughly the first few lines starting at line 1.
    const text = Array.from({ length: 10 }, () => "y".repeat(200)).join("\n");
    const chunks = chunkText("r", "big.md", text);
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.endLine).toBeGreaterThanOrEqual(1);
  });

  it("ignores empty input", () => {
    expect(chunkText("r", "e.md", "   \n  ")).toHaveLength(0);
  });
});
