import { describe, it, expect } from "vitest";
import { parseGoldenSet } from "./goldenSet.js";

describe("parseGoldenSet", () => {
  it("parses a valid answerable entry", () => {
    const data = [
      {
        id: "mdat-writer",
        repo: "clipmeta",
        question: "Where is the mdat box written to the output file?",
        kind: "answerable",
        expectFiles: ["src/Mp4/Mp4Writer.cs"],
      },
    ];
    const parsed = parseGoldenSet(data);
    expect(parsed[0]?.id).toBe("mdat-writer");
    expect(parsed[0]?.expectFiles).toEqual(["src/Mp4/Mp4Writer.cs"]);
  });

  it("parses a refuse entry that lists no expected files", () => {
    const data = [
      {
        id: "capital-of-france",
        repo: "clipmeta",
        question: "What is the capital of France?",
        kind: "refuse",
      },
    ];
    const parsed = parseGoldenSet(data);
    expect(parsed[0]?.kind).toBe("refuse");
    expect(parsed[0]?.expectFiles).toEqual([]);
  });

  it("rejects an answerable entry with no expected files", () => {
    const data = [
      {
        id: "oops",
        repo: "clipmeta",
        question: "Answerable but missing its answer key",
        kind: "answerable",
        expectFiles: [],
      },
    ];
    expect(() => parseGoldenSet(data)).toThrow();
  });

  it("rejects an entry with an invalid kind", () => {
    const data = [{ id: "bad", repo: "clipmeta", question: "?", kind: "maybe" }];
    expect(() => parseGoldenSet(data)).toThrow();
  });
});
