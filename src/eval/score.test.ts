import { describe, it, expect } from "vitest";
import { pathMatches } from "./score.js";

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
