import { runEval, writeResults } from "../eval/runEval.js";
import { formatScoreboard } from "../eval/report.js";

/**
 * Thin command-line front door for the retrieval eval:
 *   npm run eval -- --repo <name> [--golden <path>] [--topK <n>] [--minScore <x>]
 * All real work lives in runEval / report; this only parses input and prints output.
 */
interface Args {
  repo?: string;
  goldenPath?: string;
  topK?: number;
  minScore?: number;
}

function parseArgs(rest: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--repo") args.repo = rest[++i];
    else if (a === "--golden") args.goldenPath = rest[++i];
    else if (a === "--topK") args.topK = Number(rest[++i]);
    else if (a === "--minScore") args.minScore = Number(rest[++i]);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repo) {
    console.error("Usage: npm run eval -- --repo <name> [--golden <path>] [--topK <n>] [--minScore <x>]");
    process.exit(1);
  }
  const goldenPath = args.goldenPath ?? `eval/${args.repo}.golden.json`;
  const run = await runEval(args.repo, goldenPath, { topK: args.topK, minScore: args.minScore });
  console.log(
    "\n" +
      formatScoreboard(run.results, run.summary, {
        repo: run.repo,
        topK: run.topK,
        minScore: run.minScore,
      }) +
      "\n"
  );
  const out = writeResults(run);
  console.log(`Full results written to ${out}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
