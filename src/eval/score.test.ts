import { describe, it, expect } from "vitest";
import { pathMatches, isHit } from "./score.js";

describe("pathMatches", () => {
  it("matches an exact repo-relative path", () => {
    expect(pathMatches("src/Mp4/Mp4Writer.cs", "src/Mp4/Mp4Writer.cs")).toBe(true);
  });

  it("matches when the expected path is just a filename", () => {
    expect(pathMatches("src/Mp4/Mp4Writer.cs", "Mp4Writer.cs")).toBe(true);
  });

  it("does not match a different file that only shares a suffix", () => {
    expect(pathMatches("src/Mp4/NotMp4Writer.cs", "Mp4Writer.cs")).toBe(false);
  });

  it("normalizes backslashes in the expected path", () => {
    expect(pathMatches("src/Mp4/Mp4Writer.cs", "src\\Mp4\\Mp4Writer.cs")).toBe(true);
  });

  it("does not match an unrelated path", () => {
    expect(pathMatches("src/Cli/Program.cs", "Mp4Writer.cs")).toBe(false);
  });
});

describe("isHit", () => {
  it("is true when an expected file is among the retrieved paths", () => {
    const retrieved = ["src/Cli/Program.cs", "src/Mp4/Mp4Writer.cs", "README.md"];
    expect(isHit(retrieved, ["src/Mp4/Mp4Writer.cs"])).toBe(true);
  });

  it("is false when no retrieved path matches", () => {
    const retrieved = ["src/Cli/Program.cs", "README.md"];
    expect(isHit(retrieved, ["src/Mp4/Mp4Writer.cs"])).toBe(false);
  });

  it("matches on a filename-only expected entry", () => {
    expect(isHit(["src/Mp4/Mp4Writer.cs"], ["Mp4Writer.cs"])).toBe(true);
  });

  it("is true if any one of several expected files is present", () => {
    expect(isHit(["src/Mp4/Mp4Writer.cs"], ["src/Foo.cs", "Mp4Writer.cs"])).toBe(true);
  });
});
