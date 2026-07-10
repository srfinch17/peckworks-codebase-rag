import { ingestRepo } from "../ingest.js";
import { answerQuestion } from "../answer.js";

/**
 * Thin command-line front door. Parses args and hands off to the pipeline modules:
 *   npm run ingest -- --repo <name> --dir <path>
 *   npm run ask -- --repo <name> "<question>"
 * All real work lives in the modules; this only parses input and formats output.
 */
interface Args {
  repo?: string;
  dir?: string;
  recreate: boolean;
  positional: string[];
}

function parseArgs(rest: string[]): Args {
  const positional: string[] = [];
  let repo: string | undefined;
  let dir: string | undefined;
  let recreate = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--repo") repo = rest[++i];
    else if (a === "--dir") dir = rest[++i];
    else if (a === "--recreate") recreate = true;
    else positional.push(a);
  }
  return { repo, dir, recreate, positional };
}

async function runIngest(args: Args): Promise<void> {
  const dir = args.dir ?? args.positional[0];
  if (!args.repo || !dir) {
    console.error("Usage: npm run ingest -- --repo <name> --dir <path>");
    process.exit(1);
  }
  const { files, chunks } = await ingestRepo(args.repo, dir, { recreate: args.recreate });
  console.log(`Ingested ${chunks} chunks from ${files} files into repo "${args.repo}".`);
}

async function runAsk(args: Args): Promise<void> {
  const question = args.positional.join(" ").trim();
  if (!args.repo || question.length === 0) {
    console.error('Usage: npm run ask -- --repo <name> "<question>"');
    process.exit(1);
  }
  const { answer, refused } = await answerQuestion(args.repo, question);
  console.log(`\n${answer.answer}\n`);
  if (answer.citations.length > 0) {
    console.log("Citations:");
    for (const c of answer.citations) console.log(`  ${c.path}:${c.startLine}`);
    console.log("");
  }
  console.log(`[confidence: ${answer.confidence}${refused ? ", refused" : ""}]`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (command) {
    case "ingest":
      await runIngest(args);
      break;
    case "ask":
      await runAsk(args);
      break;
    default:
      console.error(`Unknown command "${command ?? ""}". Use "ingest" or "ask".`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
