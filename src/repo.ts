import { config } from "./config.js";

/**
 * Map a logical repo name to its Qdrant collection name. One collection per repo keeps
 * indexes isolated. Collection names are kept simple: lowercased, with any run of characters
 * outside [a-z0-9_] collapsed to a single underscore, and leading/trailing underscores trimmed.
 */
export function collectionFor(repo: string): string {
  const sanitized = repo
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (sanitized.length === 0) {
    throw new Error(`Repo name "${repo}" sanitizes to empty; pick a name with letters/digits.`);
  }
  return `${config.collectionPrefix}${sanitized}`;
}
