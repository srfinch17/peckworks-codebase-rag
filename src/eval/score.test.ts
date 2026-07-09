import { describe, it, expect } from "vitest";
import { pathMatches, isHit, reciprocalRank, wouldRefuse } from "./score.js";

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

describe("reciprocalRank", () => {
  it("scores 1 when the expected file is first in the list", () => {
    expect(reciprocalRank(["src/Mp4/Mp4Writer.cs", "README.md"], ["Mp4Writer.cs"])).toBe(1);
  });

  it("scores 1/4 when the expected file is fourth", () => {
    const retrieved = ["a.cs", "b.cs", "c.cs", "src/Mp4/Mp4Writer.cs"];
    expect(reciprocalRank(retrieved, ["Mp4Writer.cs"])).toBe(0.25);
  });

  it("scores 0 when the expected file is absent", () => {
    expect(reciprocalRank(["a.cs", "b.cs"], ["Mp4Writer.cs"])).toBe(0);
  });
});

describe("wouldRefuse", () => {
  it("refuses when the top score is below the floor", () => {
    expect(wouldRefuse(0.3, 0.5)).toBe(true);
  });

  it("answers when the top score is above the floor", () => {
    expect(wouldRefuse(0.7, 0.5)).toBe(false);
  });

  it("answers when the top score sits exactly on the floor", () => {
    expect(wouldRefuse(0.5, 0.5)).toBe(false);
  });

  it("refuses when nothing came back (score 0)", () => {
    expect(wouldRefuse(0, 0.5)).toBe(true);
  });
});
