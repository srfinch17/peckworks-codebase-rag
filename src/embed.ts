import { pipeline } from "@xenova/transformers";
import { config } from "./config.js";

/**
 * STEP 2 - EMBED. Turn text into a meaning-vector so we can compare meaning by distance.
 * Default: local all-MiniLM-L6-v2 (384 dims) via Transformers.js. No API key, runs offline,
 * downloads the model weights once on first use. The Embedder interface is the swap point for
 * a different model later (change config.embeddingDim and re-create the collection).
 */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

class LocalEmbedder implements Embedder {
  private extractor: any = null;

  private async init() {
    this.extractor ??= await pipeline("feature-extraction", config.localModelId);
    return this.extractor;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const extractor = await this.init();
    const out: number[][] = [];
    for (const text of texts) {
      // pooling "mean": average the per-token vectors into one vector for the whole text.
      // normalize true: rescale to unit length so cosine similarity is clean.
      const result = await extractor(text, { pooling: "mean", normalize: true });
      out.push(Array.from(result.data as Float32Array));
    }
    return out;
  }
}

export function getEmbedder(): Embedder {
  switch (config.embedder) {
    case "local":
      return new LocalEmbedder();
    default:
      throw new Error(`Unknown embedder: ${config.embedder}`);
  }
}
