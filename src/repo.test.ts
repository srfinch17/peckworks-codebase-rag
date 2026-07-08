import { describe, it, expect } from "vitest";
import { collectionFor, repoNameFromCollection } from "./repo.js";

describe("collectionFor", () => {
  it("prefixes and lowercases a simple name", () => {
    expect(collectionFor("clipmeta")).toBe("codebase_clipmeta");
  });

  it("replaces runs of non-alphanumeric chars with a single underscore", () => {
    expect(collectionFor("peckworks-clip.meta")).toBe("codebase_peckworks_clip_meta");
  });

  it("trims leading/trailing separators", () => {
    expect(collectionFor("  -Clip-  ")).toBe("codebase_clip");
  });

  it("throws on an empty/sanitizes-to-nothing name", () => {
    expect(() => collectionFor("---")).toThrow();
  });
});

describe("repoNameFromCollection", () => {
  it("strips the codebase_ prefix", () => {
    expect(repoNameFromCollection("codebase_clipmeta")).toBe("clipmeta");
  });

  it("returns the name unchanged when the prefix is absent", () => {
    expect(repoNameFromCollection("clipmeta")).toBe("clipmeta");
  });
});
