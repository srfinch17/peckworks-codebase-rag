import { describe, it, expect } from "vitest";
import { tryParseAnswer } from "./answer.js";

const valid = JSON.stringify({
  answer: "hi",
  citations: [{ path: "a.cs", startLine: 1, quote: "x" }],
  confidence: "high",
});

describe("tryParseAnswer", () => {
  it("parses a valid answer JSON string", () => {
    const parsed = tryParseAnswer(valid);
    expect(parsed).not.toBeNull();
    expect(parsed!.answer).toBe("hi");
    expect(parsed!.confidence).toBe("high");
  });

  it("tolerates markdown code fences around the JSON", () => {
    const fenced = "```json\n" + valid + "\n```";
    expect(tryParseAnswer(fenced)?.answer).toBe("hi");
  });

  it("returns null for malformed JSON (does not throw)", () => {
    expect(tryParseAnswer("not json at all")).toBeNull();
  });

  it("returns null when a required field is missing", () => {
    const missing = JSON.stringify({ answer: "hi", citations: [] }); // no confidence
    expect(tryParseAnswer(missing)).toBeNull();
  });
});
