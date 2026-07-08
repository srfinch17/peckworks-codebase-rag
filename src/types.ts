import { z } from "zod";

/** Whether a chunk came from source code or from prose/markdown docs. */
export type ChunkType = "code" | "doc";

/** A piece of a source file or doc, after chunking. */
export interface Chunk {
  id: string; // uuid; becomes the Qdrant point id
  repo: string; // logical repo name (e.g. "clipmeta")
  path: string; // repo-relative path, forward slashes (e.g. "src/Mp4/Mp4Parser.cs")
  type: ChunkType;
  position: number; // chunk index within its file
  startLine: number; // 1-based, inclusive
  endLine: number; // 1-based, inclusive
  text: string;
}

/** A chunk plus its similarity score, returned from retrieval. */
export interface RetrievedChunk extends Chunk {
  score: number; // cosine similarity (higher = closer in meaning)
}

/**
 * The shape the answer step must produce. The model fills in this structure instead of
 * writing free-form text, and we validate it with Zod before trusting it. Citations point
 * at path:line.
 */
export const RagAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      path: z.string(),
      startLine: z.number(),
      quote: z.string(), // the supporting snippet the model used
    })
  ),
  confidence: z.enum(["high", "medium", "low"]),
});

export type RagAnswer = z.infer<typeof RagAnswerSchema>;
