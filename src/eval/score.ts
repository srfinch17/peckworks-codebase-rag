/**
 * Pure scoring helpers for the retrieval eval. No I/O, no model calls: everything here is a
 * plain function of retrieved chunks (paths + scores) so it can be unit-tested in isolation.
 */

/**
 * Does a retrieved chunk's path count as the expected file?
 *
 * Chunk paths are stored forward-slash and repo-relative (see walk.ts). The expected path may
 * be a full repo-relative path or just a filename, and may use Windows separators, so we
 * normalize the expected side to forward slashes and accept either an exact match or a
 * path-boundary suffix match. The leading "/" on the suffix test is the guard that stops
 * "src/Mp4/NotMp4Writer.cs" from matching an expected "Mp4Writer.cs".
 */
export function pathMatches(chunkPath: string, expected: string): boolean {
  const exp = expected.replace(/\\/g, "/");
  return chunkPath === exp || chunkPath.endsWith("/" + exp);
}

/**
 * A "hit" for one question: did any retrieved path match any expected file? This is the yes/no
 * that the headline hit-rate counts up across the golden set.
 */
export function isHit(retrievedPaths: string[], expectFiles: string[]): boolean {
  return retrievedPaths.some((p) => expectFiles.some((e) => pathMatches(p, e)));
}
