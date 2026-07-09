import { readFileSync } from "node:fs";
import { z } from "zod";

/**
 * The golden set is the hand-validated answer key for the retrieval eval: a list of questions,
 * each tagged with the file(s) whose retrieval counts as correct, or marked as a question the
 * RAG should refuse. Unlike settings.ts (which treats a bad file as empty and never throws),
 * this loader throws loudly: a broken answer key must stop the eval, not silently score zero.
 */
const GoldenEntrySchema = z
  .object({
    id: z.string(),
    repo: z.string(),
    question: z.string(),
    kind: z.enum(["answerable", "refuse"]),
    expectFiles: z.array(z.string()).default([]),
    note: z.string().optional(),
  })
  .refine((e) => e.kind === "refuse" || e.expectFiles.length > 0, {
    message: "an 'answerable' entry must list at least one expected file",
  });

export type GoldenEntry = z.infer<typeof GoldenEntrySchema>;

/** Validate already-parsed data (pure: no file I/O, so it is unit-tested directly). */
export function parseGoldenSet(data: unknown): GoldenEntry[] {
  return z.array(GoldenEntrySchema).parse(data);
}

/** Read the golden JSON file from disk and validate it. Throws on a missing or malformed file. */
export function loadGoldenSet(filePath: string): GoldenEntry[] {
  return parseGoldenSet(JSON.parse(readFileSync(filePath, "utf8")));
}
