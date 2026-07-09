import { describe, it, expect } from "vitest";
import { summarize, type QuestionResult } from "./report.js";

function answerable(pass: boolean, reciprocalRank: number, falseRefusal = false): QuestionResult {
  return { id: "a", question: "q", kind: "answerable", pass, rank: null, reciprocalRank, topScore: 0.5, falseRefusal };
}
function refuse(pass: boolean): QuestionResult {
  return { id: "r", question: "q", kind: "refuse", pass, rank: null, reciprocalRank: 0, topScore: 0.1, falseRefusal: false };
}

describe("summarize", () => {
  it("computes hit-rate, MRR, and refusal-accuracy over a mixed set", () => {
    const results = [
      answerable(true, 1), // a hit at rank 1
      answerable(false, 0, true), // a miss, and the guardrail would wrongly refuse it
      refuse(true), // correctly refused
      refuse(false), // wrongly answered
    ];
    const s = summarize(results);
    expect(s.answerable).toBe(2);
    expect(s.refuse).toBe(2);
    expect(s.hits).toBe(1);
    expect(s.hitRate).toBe(0.5);
    expect(s.mrr).toBe(0.5); // (1 + 0) / 2
    expect(s.correctRefusals).toBe(1);
    expect(s.refusalAccuracy).toBe(0.5);
    expect(s.falseRefusals).toBe(1);
  });

  it("does not divide by zero when there are no questions of a kind", () => {
    const s = summarize([answerable(true, 1)]);
    expect(s.hitRate).toBe(1);
    expect(s.refusalAccuracy).toBe(0); // no refuse questions at all
  });
});
