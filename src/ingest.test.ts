import { describe, it, expect } from "vitest";
import { classify } from "./ingest.js";

describe("classify", () => {
  it("treats source extensions as code", () => {
    expect(classify("src/Mp4/Mp4Parser.cs")).toBe("code");
    expect(classify("src/cli/index.ts")).toBe("code");
    expect(classify("a/b/script.py")).toBe("code");
  });

  it("treats markdown/text as doc", () => {
    expect(classify("README.md")).toBe("doc");
    expect(classify("docs/PITFALLS.markdown")).toBe("doc");
    expect(classify("notes.txt")).toBe("doc");
  });

  it("returns null for unknown/binary extensions", () => {
    expect(classify("clip.mp4")).toBeNull();
    expect(classify("logo.png")).toBeNull();
    expect(classify("lib.dll")).toBeNull();
    expect(classify("Makefile")).toBeNull();
  });
});
