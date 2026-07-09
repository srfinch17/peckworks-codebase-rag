/**
 * Turns per-question eval results into the headline numbers and a printable scoreboard. Pure:
 * no I/O, no retrieval, so the aggregation math is unit-tested directly.
 */

/** The graded outcome for one golden question. */
export type QuestionResult = {
  id: string;
  question: string;
  kind: "answerable" | "refuse";
  /** answerable: was the expected file retrieved? refuse: did the guardrail correctly refuse? */
  pass: boolean;
  /** answerable: 1-based rank of the first expected file (null if it missed); refuse: null. */
  rank: number | null;
  /** answerable: 1/rank or 0; unused (0) for refuse. */
  reciprocalRank: number;
  /** best retrieval score, shown in the table. */
  topScore: number;
  /** answerable whose top score fell under minScore, so the guardrail would wrongly refuse it. */
  falseRefusal: boolean;
};

export type EvalSummary = {
  answerable: number;
  refuse: number;
  hits: number;
  hitRate: number;
  mrr: number;
  correctRefusals: number;
  refusalAccuracy: number;
  falseRefusals: number;
};

/** Aggregate per-question results into the headline numbers. */
export function summarize(results: QuestionResult[]): EvalSummary {
  const answerable = results.filter((r) => r.kind === "answerable");
  const refuse = results.filter((r) => r.kind === "refuse");

  const hits = answerable.filter((r) => r.pass).length;
  const falseRefusals = answerable.filter((r) => r.falseRefusal).length;
  const correctRefusals = refuse.filter((r) => r.pass).length;

  let rrSum = 0;
  for (const r of answerable) rrSum += r.reciprocalRank;

  return {
    answerable: answerable.length,
    refuse: refuse.length,
    hits,
    hitRate: answerable.length > 0 ? hits / answerable.length : 0,
    mrr: answerable.length > 0 ? rrSum / answerable.length : 0,
    correctRefusals,
    refusalAccuracy: refuse.length > 0 ? correctRefusals / refuse.length : 0,
    falseRefusals,
  };
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

/** Build a human-readable scoreboard string: a summary block plus a per-question table. */
export function formatScoreboard(
  results: QuestionResult[],
  summary: EvalSummary,
  meta: { repo: string; topK: number; minScore: number }
): string {
  const lines: string[] = [];
  lines.push(`Retrieval eval - repo "${meta.repo}" (topK=${meta.topK}, minScore=${meta.minScore})`);
  lines.push("");
  lines.push(
    `  hit-rate@${meta.topK}: ${pct(summary.hitRate)}  (${summary.hits}/${summary.answerable} answerable questions retrieved the right file)`
  );
  lines.push(`  MRR:          ${summary.mrr.toFixed(3)}  (1.0 = the right file was always ranked #1)`);
  lines.push(
    `  refusals:     ${pct(summary.refusalAccuracy)}  (${summary.correctRefusals}/${summary.refuse} should-refuse questions correctly refused)`
  );
  if (summary.falseRefusals > 0) {
    lines.push(`  ! false-refusals: ${summary.falseRefusals} answerable question(s) would be wrongly refused (minScore too high)`);
  }
  lines.push("");
  lines.push("  result  kind        rank  score  question");
  lines.push("  " + "-".repeat(78));
  for (const r of results) {
    const mark = r.pass ? "PASS" : "FAIL";
    const rank = r.kind === "refuse" ? "-" : r.rank === null ? "miss" : `#${r.rank}`;
    const q = r.question.length > 44 ? r.question.slice(0, 41) + "..." : r.question;
    lines.push(
      `  ${mark.padEnd(6)}  ${r.kind.padEnd(10)}  ${rank.padEnd(4)}  ${r.topScore.toFixed(2)}   ${q}`
    );
  }
  return lines.join("\n");
}
