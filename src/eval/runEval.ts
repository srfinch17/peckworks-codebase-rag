import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { retrieve } from "../retrieve.js";
import { config } from "../config.js";
import type { ChunkType } from "../types.js";
import { loadGoldenSet } from "./goldenSet.js";
import { isHit, reciprocalRank, wouldRefuse } from "./score.js";
import { summarize, type QuestionResult, type EvalSummary } from "./report.js";

/**
 * STEP: RUN the retrieval eval. A fourth front door over the pipeline, reusing retrieve() and
 * mirroring the answer.ts refusal rule. Never calls the model: every number comes from
 * retrieve() output plus the minScore threshold, so a run is free, offline, and deterministic.
 */
export type EvalRun = {
  repo: string;
  topK: number;
  minScore: number;
  typeFilter: ChunkType | null;
  timestamp: string;
  summary: EvalSummary;
  results: QuestionResult[];
};

export async function runEval(
  repo: string,
  goldenPath: string,
  opts: { topK?: number; minScore?: number; typeFilter?: ChunkType } = {}
): Promise<EvalRun> {
  const topK = opts.topK ?? config.topK;
  const minScore = opts.minScore ?? config.minScore;
  const typeFilter = opts.typeFilter ?? null;
  const golden = loadGoldenSet(goldenPath).filter((e) => e.repo === repo);

  const results: QuestionResult[] = [];
  for (const entry of golden) {
    const retrieved = await retrieve(repo, entry.question, {
      topK,
      ...(typeFilter ? { typeFilter } : {}),
    });
    const paths = retrieved.map((r) => r.path);
    const topScore = retrieved[0]?.score ?? 0;

    if (entry.kind === "answerable") {
      const rr = reciprocalRank(paths, entry.expectFiles);
      results.push({
        id: entry.id,
        question: entry.question,
        kind: "answerable",
        pass: isHit(paths, entry.expectFiles),
        rank: rr > 0 ? Math.round(1 / rr) : null,
        reciprocalRank: rr,
        topScore,
        falseRefusal: wouldRefuse(topScore, minScore),
      });
    } else {
      results.push({
        id: entry.id,
        question: entry.question,
        kind: "refuse",
        pass: wouldRefuse(topScore, minScore),
        rank: null,
        reciprocalRank: 0,
        topScore,
        falseRefusal: false,
      });
    }
  }

  return {
    repo,
    topK,
    minScore,
    typeFilter,
    timestamp: new Date().toISOString(),
    summary: summarize(results),
    results,
  };
}

/** Persist a run to eval/results/<repo>-latest.json (gitignored), creating the folder if needed. */
export function writeResults(run: EvalRun): string {
  const path = `eval/results/${run.repo}-latest.json`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(run, null, 2));
  return path;
}
