import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { walkRepo } from "./walk.js";
import { chunkCode } from "./chunkCode.js";
import { chunkText } from "./chunk.js";
import { getEmbedder } from "./embed.js";
import { ensureCollection, recreateCollection, upsertChunks } from "./store.js";
import { collectionFor } from "./repo.js";
import { logEvent } from "./log.js";
import type { Chunk, ChunkType } from "./types.js";

const CODE_EXTENSIONS = new Set([
  ".cs", ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java",
  ".rb", ".rs", ".c", ".h", ".cpp", ".hpp", ".cc",
]);
const DOC_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

/** Decide how to chunk a file by extension. null => skip (also excludes binaries). */
export function classify(relPath: string): ChunkType | null {
  const ext = extname(relPath).toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return "code";
  if (DOC_EXTENSIONS.has(ext)) return "doc";
  return null;
}

/**
 * The ingest pipeline for ONE repo: walk -> classify -> chunk (code|doc) -> embed -> store.
 * Everything lands in this repo's own Qdrant collection. Re-run whenever the repo changes.
 */
export async function ingestRepo(
  repo: string,
  dir: string,
  options: { recreate?: boolean } = {}
): Promise<{ files: number; chunks: number }> {
  const collection = collectionFor(repo);
  const walked = walkRepo(dir);

  const allChunks: Chunk[] = [];
  let indexedFiles = 0;
  for (const file of walked) {
    const kind = classify(file.relPath);
    if (kind === null) continue;
    const text = readFileSync(file.absPath, "utf8");
    const fileChunks =
      kind === "code"
        ? chunkCode(repo, file.relPath, text)
        : chunkText(repo, file.relPath, text);
    if (fileChunks.length > 0) {
      allChunks.push(...fileChunks);
      indexedFiles += 1;
    }
  }

  if (allChunks.length === 0) {
    throw new Error(`No indexable code/doc files found under ${dir}.`);
  }

  if (options.recreate) {
    await recreateCollection(collection);
  } else {
    await ensureCollection(collection);
  }
  const embedder = getEmbedder();
  const vectors = await embedder.embed(allChunks.map((c) => c.text));
  await upsertChunks(collection, allChunks, vectors);

  logEvent("ingest", { repo, collection, dir, files: indexedFiles, chunks: allChunks.length });
  return { files: indexedFiles, chunks: allChunks.length };
}
