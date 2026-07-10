import "dotenv/config";

/**
 * Central configuration and the tunable parameters of the pipeline.
 * Each value is a deliberate tradeoff, gathered in one place so the behavior of
 * every stage can be adjusted and reasoned about from a single file.
 */
export const config = {
  // --- STEP 1: chunking ---
  // Docs/prose are split into character windows.
  textChunkSize: 800,
  textChunkOverlap: 150,
  // Code is split into LINE windows. Lines are the natural unit of code and let
  // citations point at path:line. ~60 lines with ~15 lines of overlap keeps most
  // short functions whole while overlapping the boundary between windows.
  // Known limitation: a window can still split a long function mid-body; symbol-aware
  // chunking (tree-sitter) addresses that in a later phase.
  codeChunkLines: 60,
  codeChunkOverlapLines: 15,

  // --- STEP 2: embeddings ---
  embedder: (process.env.EMBEDDER ?? "local") as "local",
  // Local embedding model id (HuggingFace, ONNX/Transformers.js). Code-tuned: trained on
  // docstring-to-source-code pairs, so English questions rank code above the prose that
  // describes it. Swap back to "Xenova/all-MiniLM-L6-v2" (with embeddingDim 384) to compare.
  localModelId: process.env.LOCAL_MODEL_ID ?? "jinaai/jina-embeddings-v2-base-code",
  // Vector size. MUST match the model above (jina-code = 768, MiniLM = 384). Changing this
  // requires re-creating the collection (see the --recreate ingest flag).
  embeddingDim: 768,

  // --- STEP 3: vector store (Qdrant) ---
  qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
  // One collection per repo: `${collectionPrefix}${sanitizedRepoName}` (see repo.ts).
  collectionPrefix: "codebase_",

  // --- STEP 4: retrieval ---
  // Number of nearest chunks to retrieve. Slightly higher than a prose-only setup
  // because code answers often need a few neighboring chunks for context.
  topK: 8,
  // Refusal guardrail: if the best match scores below this, return an honest "not found"
  // instead of a possibly-hallucinated answer. Tuned against eval/clipmeta.golden.json: the
  // text-tuned embedder scores answerable and unanswerable questions in the same 0.56-0.65
  // band, so no floor cleanly separates them. 0.57 is the best point on that tradeoff curve
  // (catches the 2 weakest false-premise questions for 1 false refusal); higher floors reject
  // real answers faster than they catch fakes. See docs/DECISIONS.md.
  minScore: 0.57,

  // --- STEP 5: answer ---
  answerModel: process.env.ANSWER_MODEL ?? "claude-opus-4-8",
  answerMaxTokens: 1024,
} as const;

export function requireAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in. " +
        "(Needed for the answer step only; ingest/embedding run offline.)"
    );
  }
  return key;
}
