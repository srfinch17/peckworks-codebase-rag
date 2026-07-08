import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "./config.js";
import type { Chunk, ChunkType, RetrievedChunk } from "./types.js";

/**
 * STEP 3 - STORE, and the search half of STEP 4 - RETRIEVE.
 * Qdrant stores each chunk's vector plus its payload and does fast cosine nearest-neighbour
 * search. The collection name is a PARAMETER: one collection per repo, so indexes never mix.
 */
const client = new QdrantClient({ url: config.qdrantUrl });

/** Create the collection if it doesn't exist. Vector size must match the embedder. */
export async function ensureCollection(collection: string): Promise<void> {
  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === collection);
  if (!exists) {
    await client.createCollection(collection, {
      vectors: { size: config.embeddingDim, distance: "Cosine" },
    });
  }
}

/** Upsert chunks plus their vectors into a repo's collection. vectors[i] matches chunks[i]. */
export async function upsertChunks(
  collection: string,
  chunks: Chunk[],
  vectors: number[][]
): Promise<void> {
  if (chunks.length === 0) return;
  await client.upsert(collection, {
    wait: true,
    points: chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: vectors[i]!,
      payload: {
        repo: chunk.repo,
        path: chunk.path,
        type: chunk.type,
        position: chunk.position,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        text: chunk.text,
      },
    })),
  });
}

/** Cosine nearest-neighbour search in a repo's collection, optionally filtered by type. */
export async function search(
  collection: string,
  queryVector: number[],
  limit: number,
  typeFilter?: ChunkType
): Promise<RetrievedChunk[]> {
  const results = await client.search(collection, {
    vector: queryVector,
    limit,
    with_payload: true,
    filter: typeFilter
      ? { must: [{ key: "type", match: { value: typeFilter } }] }
      : undefined,
  });
  return results.map((r) => ({
    id: String(r.id),
    repo: String(r.payload?.repo ?? "unknown"),
    path: String(r.payload?.path ?? "unknown"),
    type: (r.payload?.type as ChunkType) ?? "doc",
    position: Number(r.payload?.position ?? -1),
    startLine: Number(r.payload?.startLine ?? -1),
    endLine: Number(r.payload?.endLine ?? -1),
    text: String(r.payload?.text ?? ""),
    score: r.score,
  }));
}
