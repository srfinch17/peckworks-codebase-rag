import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { Chunk } from "./types.js";

/**
 * STEP 1 (code) - line-window chunking. Split a source file into overlapping windows of N
 * lines. Lines are the natural unit of code and let citations point at path:line.
 *
 * Known limitation (Phase 1): a window can split a long function mid-body. Phase 2 replaces
 * this with tree-sitter symbol-aware chunking and measures the improvement against this baseline.
 */
export function chunkCode(repo: string, path: string, text: string): Chunk[] {
  const allLines = text.replace(/\r\n/g, "\n").split("\n");
  const { codeChunkLines, codeChunkOverlapLines } = config;
  const step = Math.max(1, codeChunkLines - codeChunkOverlapLines);

  const chunks: Chunk[] = [];
  let position = 0;
  for (let start = 0; start < allLines.length; start += step) {
    const windowLines = allLines.slice(start, start + codeChunkLines);
    const body = windowLines.join("\n");
    if (body.trim().length > 0) {
      chunks.push({
        id: randomUUID(),
        repo,
        path,
        type: "code",
        position,
        startLine: start + 1, // 1-based inclusive
        endLine: start + windowLines.length, // 1-based inclusive
        text: body,
      });
      position += 1;
    }
    if (start + codeChunkLines >= allLines.length) break; // last window reached the end
  }
  return chunks;
}
