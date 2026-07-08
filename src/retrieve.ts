import { getEmbedder } from "./embed.js";
import { search } from "./store.js";
import { collectionFor } from "./repo.js";
import { config } from "./config.js";
import { logEvent } from "./log.js";
import type { ChunkType, RetrievedChunk } from "./types.js";

/**
 * STEP 4 - RETRIEVE. Embed the question with the SAME embedder used for chunks, then find
 * the closest chunks by cosine similarity in this repo's collection.
 */
export async function retrieve(
  repo: string,
  question: string,
  typeFilter?: ChunkType
): Promise<RetrievedChunk[]> {
  const embedder = getEmbedder();
  const [queryVector] = await embedder.embed([question]);
  const hits = await search(collectionFor(repo), queryVector!, config.topK, typeFilter);
  logEvent("retrieve", {
    repo,
    question,
    topScore: hits[0]?.score ?? null,
    hits: hits.map((h) => ({ path: h.path, startLine: h.startLine, score: h.score })),
  });
  return hits;
}
