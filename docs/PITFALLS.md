# PITFALLS - peckworks-codebase-rag

Consult before touching ingest, chunking, or the Qdrant store. Append every real gotcha
(dated), the same discipline that made clipmeta easy to work in.

## Known limitations (by design, for now)

- **`.gitignore` support is intentionally partial.** We honor a built-in skip set
  (`node_modules`, `.git`, `bin`, `obj`, `dist`, `build`, `out`, `.vs`, `.vscode`, `.idea`,
  `packages`, `TestResults`, `.qdrant_storage`, `.cache`, `logs`) plus *simple* top-level
  `.gitignore` rules (plain names, trailing-slash directory entries, and `*.ext` suffix
  globs). We do **not** implement negation (`!`), `**`, path anchoring, or nested
  `.gitignore` files. This is a deliberate YAGNI cut: binaries are excluded anyway because
  ingest only includes known code/doc extensions. Revisit only if a real repo gets
  mis-indexed.

- **Line-window chunking can split a long function mid-body.** This is the Phase-1 baseline
  *on purpose*; Phase 2 (tree-sitter symbol-aware chunking) fixes it and we measure the
  hit-rate gain against this baseline. Don't "fix" it early: the baseline is the point.

- **`minScore` is tuned for prose (0.25).** Inherited from the document lab. It may
  mis-refuse (or under-refuse) on code until re-tuned against the clipmeta golden set in
  Phase 2. If the guardrail behaves oddly in the P1 end-to-end run, record the observed top
  scores here rather than blindly changing the number.

- **Embeddings come from a text model (MiniLM), used on code.** MiniLM was trained on
  natural language, not source. It still works, but a code-tuned or hosted embedder may
  retrieve better: the `Embedder` interface (`src/embed.ts`) is the swap point. Measure
  before swapping.

- **Re-ingesting upserts; it does not delete stale chunks.** If files are removed or
  renamed between ingests, their old chunks linger in the collection (point IDs are random
  UUIDs, so a changed file produces new points rather than replacing old ones). For a clean
  rebuild, drop/recreate the collection. A proper incremental re-index (delete-by-path
  before re-upsert) is a future improvement, not P1 scope.

## Gotchas
<!-- Append dated entries as they happen during implementation, e.g.:
- 2026-06-21: <what bit us> - <root cause> - <fix>.
-->
_(none yet, implementation starts next session)_
