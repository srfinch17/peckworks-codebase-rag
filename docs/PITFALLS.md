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

- **2026-07-08: `fetch failed` from the Qdrant client on Node 26 was a two-major-version undici mismatch.**
  - *Symptom:* `npm run ingest` failed instantly with `Failed to obtain server version ... fetch failed`, even though Qdrant was confirmed up (HTTP 200 from PowerShell, and a plain Node `fetch()` to the same URL, both worked).
  - *Root cause:* `@qdrant/js-client-rest` (latest, 1.18.0) depends on `undici@6` and builds an undici-6 `Agent` that it passes as the request `dispatcher` to Node's global `fetch`. Node 26 ships built-in `undici@8`, which rejects the v6 dispatcher with `UND_ERR_INVALID_ARG: invalid onError method`. Plain `fetch()` works because it uses the built-in dispatcher; only the client's custom Agent triggers it.
  - *Diagnosis tip:* the top-level error is a misleading `fetch failed`. The real cause is only in `err.cause.code` / `err.cause.message` - always inspect those before assuming a connectivity problem.
  - *Fix:* pin undici up to Node's major via an npm `overrides` block in package.json: `"overrides": { "undici": "^8.2.0" }`, then `npm install`. `checkCompatibility: false` does NOT help - every request uses the bad dispatcher, not just the version check.
  - *Red herring:* `localhost` vs `127.0.0.1` (IPv4/IPv6) was suspected first and is NOT the cause - Node `fetch` reached both fine. Do not chase it.

- **2026-07-08: Docker Desktop engine wedged during first-run setup (EOF / "other side closed").**
  - *Symptom:* the Qdrant container hung in `Created`/spinning state; `compose start` failed with `error during connect: ... EOF`; stray auto-named qdrant containers appeared.
  - *Contributing cause:* firing multiple concurrent Docker state-change commands (`compose up`, `docker start`) and killing them mid-operation left the engine in a bad state.
  - *Fix:* full reset - quit Docker Desktop, `wsl --shutdown`, reopen, wait for "Engine running", then `docker compose up -d --force-recreate`. Verify with an HTTP GET to `http://127.0.0.1:6333/readyz` (expect 200), not just the container's "started" state.
  - *Lesson:* do not fire overlapping Docker state-change commands. Run one, confirm it, then the next.
