import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { Chunk } from "./types.js";

/**
 * STEP 1 (docs) - character-window chunking for prose/markdown. Adds 1-based startLine/endLine
 * computed from character offsets so doc citations match code citations (path:line).
 */
export function chunkText(repo: string, path: string, text: string): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n");
  // Precompute the line number (1-based) at each character offset, cheaply.
  const lineAtOffset = buildLineIndex(clean);
  const { textChunkSize, textChunkOverlap } = config;
  const step = Math.max(1, textChunkSize - textChunkOverlap);

  const chunks: Chunk[] = [];
  let position = 0;
  for (let start = 0; start < clean.length; start += step) {
    const end = Math.min(start + textChunkSize, clean.length);
    const slice = clean.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push({
        id: randomUUID(),
        repo,
        path,
        type: "doc",
        position,
        startLine: lineAtOffset(start),
        endLine: lineAtOffset(Math.max(start, end - 1)),
        text: slice,
      });
      position += 1;
    }
    if (end >= clean.length) break;
  }
  return chunks;
}

/** Returns a function mapping a character offset to its 1-based line number. */
function buildLineIndex(text: string): (offset: number) => number {
  const newlineOffsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") newlineOffsets.push(i);
  }
  return (offset: number) => {
    // line = 1 + (number of newlines strictly before offset), found by binary search.
    let lo = 0;
    let hi = newlineOffsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlineOffsets[mid]! < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
}
